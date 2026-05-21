import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import {
  executePendingAiAction,
  findLatestPendingAiAction,
  isAiCancel,
  isAiConfirm,
  runShopIqAgentTurn,
  type PendingAiActionMetadata
} from "@/lib/ai/shopiq-agent";
import { isGeminiKeyError, isGeminiQuotaError } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { can, isManagerOrAdmin } from "@/lib/permissions";

function compactToolResults(results: Array<{ name: string; args: Record<string, unknown>; response: Record<string, unknown> }>) {
  return results.slice(0, 8).map((result) => ({
    name: result.name,
    args: result.args,
    ok: result.response.ok !== false,
    pendingAction: result.response.pendingAction || undefined,
    validationError: result.response.validationError || undefined,
    error: result.response.error || undefined,
    keys: Object.keys(result.response).slice(0, 10)
  }));
}

function assistantThreadWhere(user: { id: string; shopId: string; role: string }, threadId?: string) {
  const where: Prisma.AssistantThreadWhereInput = { shopId: user.shopId };
  if (threadId) where.id = threadId;
  if (!isManagerOrAdmin(user.role)) where.createdById = user.id;
  return where;
}

function geminiConfigError(error: unknown) {
  return error instanceof Error && error.message.includes("GEMINI_API_KEY");
}

function aiRequestTimeoutMs() {
  const parsed = Number(process.env.AI_REQUEST_TIMEOUT_MS || 55_000);
  if (!Number.isFinite(parsed)) return 55_000;
  return Math.min(Math.max(Math.floor(parsed), 10_000), 180_000);
}

function withAiTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("The AI service did not respond in time. Please try again in a moment."));
    }, aiRequestTimeoutMs());

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

async function cleanupFailedTurn(createdThreadId: string | null, createdMessageIds: string[]) {
  try {
    if (createdThreadId) {
      await prisma.assistantThread.delete({ where: { id: createdThreadId } });
      return;
    }
    if (createdMessageIds.length) {
      await prisma.assistantMessage.deleteMany({ where: { id: { in: createdMessageIds } } });
    }
  } catch (cleanupError) {
    console.warn("[ShopIQ AI] Failed to clean up an incomplete assistant turn.", cleanupError);
  }
}

function clientConversationHistory(body: unknown) {
  const messages = (body as { clientMessages?: unknown })?.clientMessages;
  if (!Array.isArray(messages)) return [];
  return messages
    .flatMap((message) => {
      if (!message || typeof message !== "object") return [];
      const record = message as Record<string, unknown>;
      const role = record.role === "USER" ? "USER" : record.role === "AI" ? "AI" : null;
      const content = typeof record.content === "string" ? record.content.trim() : "";
      if (!role || !content) return [];
      return [{ role, content: content.slice(0, 2200) }];
    })
    .slice(-12);
}

function cleanThreadTitle(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>\[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseShort(value: string) {
  const lowerWords = new Set(["a", "an", "and", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);
  return value
    .split(" ")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && lowerWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function buildThreadTitle(text: string) {
  const cleaned = cleanThreadTitle(text);
  const lower = cleaned.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\b(reorder|restock|low stock|stock risk)\b/, "Reorder & Stock Review"],
    [/\b(customer dues|pending|receivable|collection|collect)\b/, "Customer Dues Follow-up"],
    [/\b(sales|revenue|earning|income|profit)\b/, "Sales & Revenue Question"],
    [/\b(invoice|billing|bill|receipt)\b/, "Billing Help"],
    [/\b(payment|paid|cash|bank|jazzcash|easypaisa)\b/, "Payment Review"],
    [/\b(product|inventory|sku|item)\b/, "Inventory Question"],
    [/\b(supplier|purchase|payable)\b/, "Supplier & Purchase Review"],
    [/\b(staff|member|employee|manager|cashier)\b/, "Staff Management"],
    [/\b(image|photo|screenshot|picture)\b/, "Image Context Review"]
  ];
  const matched = patterns.find(([pattern]) => pattern.test(lower));
  if (matched) return matched[1];
  const compact = cleaned
    .replace(/^(please|can you|could you|tell me|show me|find|what is|what are|how much|i need|help me)\b/i, "")
    .trim();
  const title = titleCaseShort((compact || cleaned || "ShopIQ Chat").split(" ").slice(0, 7).join(" "));
  return title.length > 52 ? `${title.slice(0, 49).trim()}...` : title || "ShopIQ Chat";
}

function normalizeMessageRole(role: string) {
  const normalized = role.toUpperCase();
  return normalized === "USER" ? "USER" : "AI";
}

function previewActionFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  if (record.status !== "pending" || !record.pendingAction || !record.previewId) return null;
  return {
    type: String(record.pendingAction),
    payload: typeof record.payload === "object" && record.payload && !Array.isArray(record.payload) ? (record.payload as Record<string, unknown>) : {},
    previewId: String(record.previewId)
  };
}

function actionFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const action = (metadata as Record<string, unknown>).action;
  if (!action || typeof action !== "object" || Array.isArray(action)) return null;
  const record = action as Record<string, unknown>;
  if (typeof record.label !== "string" || typeof record.href !== "string") return null;
  return { label: record.label, href: record.href };
}

function serializeMessage(message: { id: string; role: string; content: string; metadata: Prisma.JsonValue | null; createdAt: Date }) {
  return {
    id: message.id,
    role: normalizeMessageRole(message.role),
    content: message.content,
    fullContent: message.content,
    createdAt: message.createdAt.toISOString(),
    action: actionFromMetadata(message.metadata),
    previewAction: previewActionFromMetadata(message.metadata)
  };
}

function serializeThread(thread: { id: string; title: string; mode: string; createdAt: Date; updatedAt: Date; messages?: Array<{ content: string; createdAt: Date }>; _count?: { messages: number } }) {
  const last = thread.messages?.[0];
  return {
    id: thread.id,
    title: thread.title,
    mode: thread.mode,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messageCount: thread._count?.messages ?? 0,
    lastMessage: last?.content || "",
    lastMessageAt: last?.createdAt?.toISOString() || thread.updatedAt.toISOString()
  };
}

async function touchThread(threadId: string) {
  return prisma.assistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
}

async function threadSummary(threadId: string) {
  return prisma.assistantThread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
      _count: { select: { messages: true } }
    }
  });
}

async function jsonWithThread(threadId: string, payload: Record<string, unknown>) {
  await touchThread(threadId);
  const thread = await threadSummary(threadId);
  return NextResponse.json({ ...payload, thread: thread ? serializeThread(thread) : undefined });
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "assistant", "read")) return forbidden();

    const url = new URL(request.url);
    const threadId = url.searchParams.get("threadId");

    if (threadId) {
      const thread = await prisma.assistantThread.findFirst({
        where: assistantThreadWhere(user, threadId),
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          _count: { select: { messages: true } }
        }
      });
      if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      const touchedThread = await touchThread(thread.id);
      return NextResponse.json({
        thread: serializeThread({ ...thread, updatedAt: touchedThread.updatedAt, messages: thread.messages.slice(-1) }),
        messages: thread.messages.map(serializeMessage)
      });
    }

    const threads = await prisma.assistantThread.findMany({
      where: assistantThreadWhere(user),
      orderBy: { updatedAt: "desc" },
      take: 60,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, createdAt: true } },
        _count: { select: { messages: true } }
      }
    });

    return NextResponse.json({ threads: threads.map(serializeThread) });
  } catch (error) {
    return apiError(error, "Assistant history is temporarily unavailable.", 502);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "assistant", "create")) return forbidden();

    const url = new URL(request.url);
    const threadId = url.searchParams.get("threadId");
    if (!threadId) return NextResponse.json({ error: "Thread id is required." }, { status: 400 });

    const thread = await prisma.assistantThread.findFirst({
      where: assistantThreadWhere(user, threadId),
      select: { id: true }
    });
    if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

    await prisma.assistantThread.delete({ where: { id: thread.id } });
    return NextResponse.json({ ok: true, deletedThreadId: thread.id });
  } catch (error) {
    return apiError(error, "Assistant thread could not be deleted.", 502);
  }
}

export async function POST(request: Request) {
  let createdThreadId: string | null = null;
  const createdMessageIds: string[] = [];
  let shouldCleanupIncompleteTurn = true;

  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "assistant", "create")) return forbidden();

    const body = await request.json();
    const approvalDecision = body?.approval?.decision === "approve" ? "approve" : body?.approval?.decision === "cancel" ? "cancel" : null;
    const approvalPreviewId = body?.approval?.previewId ? String(body.approval.previewId) : "";
    const text = String(body?.question || (approvalDecision === "approve" ? "Approved action" : approvalDecision === "cancel" ? "Cancelled action" : "")).trim();
    if (!text) return NextResponse.json({ error: "Question is required." }, { status: 400 });

    let thread = body?.threadId ? await prisma.assistantThread.findFirst({ where: assistantThreadWhere(user, String(body.threadId)) }) : null;
    if (!thread) {
      thread = await prisma.assistantThread.create({
        data: {
          shopId: user.shopId,
          createdById: user.id,
          title: buildThreadTitle(text),
          mode: "GEMINI_AGENT"
        }
      });
      createdThreadId = thread.id;
    }

    const recentBefore = await prisma.assistantMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
      take: 8
    });

    const userMessage = await prisma.assistantMessage.create({
      data: { threadId: thread.id, authorId: user.id, role: "USER", content: text }
    });
    createdMessageIds.push(userMessage.id);

    if (approvalDecision === "cancel" || (!approvalDecision && isAiCancel(text))) {
      const pending = await findLatestPendingAiAction(thread.id);
      if (pending) {
        const metadata = pending.metadata as PendingAiActionMetadata;
        if (approvalPreviewId && metadata.previewId !== approvalPreviewId) {
          const answer = "## Preview Changed\n\nThat approval request no longer matches the latest pending action. Please review the newest preview before cancelling it.";
          const aiMessage = await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
          createdMessageIds.push(aiMessage.id);
          const response = await jsonWithThread(thread.id, { answer });
          shouldCleanupIncompleteTurn = false;
          return response;
        }
        await prisma.assistantMessage.update({
          where: { id: pending.id },
          data: { metadata: { ...metadata, status: "cancelled", cancelledAt: new Date().toISOString() } as Prisma.InputJsonValue }
        });
      }
      const answer = "## Preview Cancelled\n\nNo database record was changed. Ask me to prepare another ShopIQ action whenever you are ready.";
      const aiMessage = await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
      createdMessageIds.push(aiMessage.id);
      const response = await jsonWithThread(thread.id, { answer });
      shouldCleanupIncompleteTurn = false;
      return response;
    }

    if (approvalDecision === "approve" || (!approvalDecision && isAiConfirm(text))) {
      const pending = await findLatestPendingAiAction(thread.id);
      if (!pending) {
        const answer = "## Nothing Pending\n\nI do not have a pending ShopIQ action to confirm. Ask me to prepare an action first, and I will show a validated preview before anything is written.";
        const aiMessage = await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
        createdMessageIds.push(aiMessage.id);
        const response = await jsonWithThread(thread.id, { answer });
        shouldCleanupIncompleteTurn = false;
        return response;
      }

      const metadata = pending.metadata as PendingAiActionMetadata;
      if (approvalPreviewId && metadata.previewId !== approvalPreviewId) {
        const answer = "## Preview Changed\n\nThat approval request no longer matches the latest pending action. Please review the newest preview before approving it.";
        const aiMessage = await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
        createdMessageIds.push(aiMessage.id);
        const response = await jsonWithThread(thread.id, { answer });
        shouldCleanupIncompleteTurn = false;
        return response;
      }
      const result = await executePendingAiAction(user, metadata.pendingAction!, metadata.payload || {});
      await prisma.assistantMessage.update({
        where: { id: pending.id },
        data: { metadata: { ...metadata, status: "executed", executedAt: new Date().toISOString() } as Prisma.InputJsonValue }
      });
      const aiMessage = await prisma.assistantMessage.create({
        data: {
          threadId: thread.id,
          role: "AI",
          content: result.answer,
          metadata: result.action ? ({ action: result.action } as Prisma.InputJsonValue) : undefined
        }
      });
      createdMessageIds.push(aiMessage.id);
      const response = await jsonWithThread(thread.id, { answer: result.answer, action: result.action });
      shouldCleanupIncompleteTurn = false;
      return response;
    }

    const persistedHistory = recentBefore.reverse().map((message) => ({ role: message.role, content: message.content }));
    const visibleHistory = clientConversationHistory(body);
    const result = await withAiTimeout(runShopIqAgentTurn({
      user,
      question: text,
      recentMessages: visibleHistory.length ? visibleHistory : persistedHistory
    }));

    const metadata: PendingAiActionMetadata = {
      provider: result.provider,
      model: result.model,
      toolResults: compactToolResults(result.toolResults)
    };
    if (result.pendingAction) {
      metadata.pendingAction = result.pendingAction.type;
      metadata.status = "pending";
      metadata.payload = result.pendingAction.payload;
      metadata.previewId = result.pendingAction.previewId;
      metadata.reason = result.pendingAction.reason;
    }
    if (result.action) metadata.action = result.action;

    const aiMessage = await prisma.assistantMessage.create({
      data: { threadId: thread.id, role: "AI", content: result.answer, metadata: metadata as Prisma.InputJsonValue }
    });
    createdMessageIds.push(aiMessage.id);

    const response = await jsonWithThread(thread.id, { answer: result.answer, previewAction: result.pendingAction, action: result.action });
    shouldCleanupIncompleteTurn = false;
    return response;
  } catch (error) {
    if (shouldCleanupIncompleteTurn) await cleanupFailedTurn(createdThreadId, createdMessageIds);

    if (geminiConfigError(error)) {
      return NextResponse.json(
        { error: "Gemini is not configured. Add GEMINI_API_KEY or GEMINI_API_KEYS to .env and restart the server. No mock AI fallback is enabled." },
        { status: 503 }
      );
    }
    if (isGeminiQuotaError(error)) {
      return NextResponse.json(
        { error: "Gemini quota is temporarily exhausted for the configured provider keys. Please try again after cooldown, reduce request volume, or increase your Gemini quota/paid tier." },
        { status: 429 }
      );
    }
    if (isGeminiKeyError(error)) {
      return NextResponse.json(
        { error: "Gemini rejected all configured API keys. Check GEMINI_API_KEYS formatting, remove invalid keys, rotate exposed keys, and restart the server." },
        { status: 503 }
      );
    }
    return apiError(error, "AI assistant is temporarily unavailable.", 502);
  }
}
