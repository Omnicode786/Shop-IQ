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
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";

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

function geminiConfigError(error: unknown) {
  return error instanceof Error && error.message.includes("GEMINI_API_KEY");
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

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "assistant", "create")) return forbidden();

    const body = await request.json();
    const approvalDecision = body?.approval?.decision === "approve" ? "approve" : body?.approval?.decision === "cancel" ? "cancel" : null;
    const approvalPreviewId = body?.approval?.previewId ? String(body.approval.previewId) : "";
    const text = String(body?.question || (approvalDecision === "approve" ? "Approved action" : approvalDecision === "cancel" ? "Cancelled action" : "")).trim();
    if (!text) return NextResponse.json({ error: "Question is required." }, { status: 400 });

    let thread = body?.threadId ? await prisma.assistantThread.findFirst({ where: { id: String(body.threadId), shopId: user.shopId } }) : null;
    if (!thread) {
      thread = await prisma.assistantThread.create({
        data: {
          shopId: user.shopId,
          createdById: user.id,
          title: text.slice(0, 80) || "ShopIQ AI Agent",
          mode: "GEMINI_AGENT"
        }
      });
    }

    const recentBefore = await prisma.assistantMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
      take: 8
    });

    await prisma.assistantMessage.create({
      data: { threadId: thread.id, authorId: user.id, role: "USER", content: text }
    });

    if (approvalDecision === "cancel" || (!approvalDecision && isAiCancel(text))) {
      const pending = await findLatestPendingAiAction(thread.id);
      if (pending) {
        const metadata = pending.metadata as PendingAiActionMetadata;
        if (approvalPreviewId && metadata.previewId !== approvalPreviewId) {
          const answer = "## Preview Changed\n\nThat approval request no longer matches the latest pending action. Please review the newest preview before cancelling it.";
          await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
          return NextResponse.json({ thread, answer });
        }
        await prisma.assistantMessage.update({
          where: { id: pending.id },
          data: { metadata: { ...metadata, status: "cancelled", cancelledAt: new Date().toISOString() } as Prisma.InputJsonValue }
        });
      }
      const answer = "## Preview Cancelled\n\nNo database record was changed. Ask me to prepare another ShopIQ action whenever you are ready.";
      await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
      return NextResponse.json({ thread, answer });
    }

    if (approvalDecision === "approve" || (!approvalDecision && isAiConfirm(text))) {
      const pending = await findLatestPendingAiAction(thread.id);
      if (!pending) {
        const answer = "## Nothing Pending\n\nI do not have a pending ShopIQ action to confirm. Ask me to prepare an action first, and I will show a validated preview before anything is written.";
        await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
        return NextResponse.json({ thread, answer });
      }

      const metadata = pending.metadata as PendingAiActionMetadata;
      if (approvalPreviewId && metadata.previewId !== approvalPreviewId) {
        const answer = "## Preview Changed\n\nThat approval request no longer matches the latest pending action. Please review the newest preview before approving it.";
        await prisma.assistantMessage.create({ data: { threadId: thread.id, role: "AI", content: answer } });
        return NextResponse.json({ thread, answer });
      }
      const result = await executePendingAiAction(user, metadata.pendingAction!, metadata.payload || {});
      await prisma.assistantMessage.update({
        where: { id: pending.id },
        data: { metadata: { ...metadata, status: "executed", executedAt: new Date().toISOString() } as Prisma.InputJsonValue }
      });
      await prisma.assistantMessage.create({
        data: {
          threadId: thread.id,
          role: "AI",
          content: result.answer,
          metadata: result.action ? ({ action: result.action } as Prisma.InputJsonValue) : undefined
        }
      });
      return NextResponse.json({ thread, answer: result.answer, action: result.action });
    }

    const persistedHistory = recentBefore.reverse().map((message) => ({ role: message.role, content: message.content }));
    const visibleHistory = clientConversationHistory(body);
    const result = await runShopIqAgentTurn({
      user,
      question: text,
      recentMessages: visibleHistory.length ? visibleHistory : persistedHistory
    });

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

    await prisma.assistantMessage.create({
      data: { threadId: thread.id, role: "AI", content: result.answer, metadata: metadata as Prisma.InputJsonValue }
    });

    return NextResponse.json({ thread, answer: result.answer, previewAction: result.pendingAction });
  } catch (error) {
    if (geminiConfigError(error)) {
      return NextResponse.json(
        { error: "Gemini is not configured. Add GEMINI_API_KEY to .env and restart the server. No mock AI fallback is enabled." },
        { status: 503 }
      );
    }
    return apiError(error, "AI assistant is temporarily unavailable.", 502);
  }
}
