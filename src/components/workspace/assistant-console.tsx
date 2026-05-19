"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, Send, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FormattedAiContent } from "@/utils/ai-content";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id?: string;
  role: "USER" | "AI";
  content: string;
  fullContent?: string;
  action?: { label: string; href: string } | null;
  previewAction?: { type: string; payload: Record<string, any>; previewId: string } | null;
  isTyping?: boolean;
};

const USER_MESSAGE_LAND_MS = 420;

function actionLabel(type?: string) {
  if (type === "create_product") return "Product preview";
  if (type === "update_product") return "Product update";
  if (type === "create_customer") return "Customer preview";
  if (type === "update_customer") return "Customer update";
  if (type === "create_supplier") return "Supplier preview";
  if (type === "update_supplier") return "Supplier update";
  if (type === "create_payment") return "Payment preview";
  if (type === "create_invoice") return "Invoice preview";
  if (type === "create_purchase") return "Purchase preview";
  if (type === "create_staff") return "Staff preview";
  if (type === "update_staff") return "Staff update";
  return "Action preview";
}

export function AssistantConsole({ initialThreadId }: { initialThreadId?: string }) {
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [typingResponse, setTypingResponse] = useState(false);
  const [activeFocusMessageId, setActiveFocusMessageId] = useState<string | null>(null);
  const [resolvedPreviews, setResolvedPreviews] = useState<Set<string>>(new Set());
  const typingTimers = useRef<Set<number>>(new Set());
  const choreographyTimers = useRef<Set<number>>(new Set());
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const autoFollowRef = useRef(true);
  const userScrollIntentRef = useRef(false);
  const activeTypingMessageIdRef = useRef<string | null>(null);
  const programmaticScrollUntilRef = useRef(0);
  const scrollFrames = useRef<Set<number>>(new Set());
  const router = useRouter();
  const isBusy = loading || typingResponse;

  useEffect(() => {
    const timers = typingTimers.current;
    const choreography = choreographyTimers.current;
    const frames = scrollFrames.current;

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      choreography.forEach((timer) => window.clearTimeout(timer));
      choreography.clear();
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      frames.clear();
    };
  }, []);

  useEffect(() => {
    if (showThinking) scrollToConversationEnd("smooth");
  }, [showThinking]);

  function messageId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function scheduleTyping(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      typingTimers.current.delete(timer);
      callback();
    }, delay);
    typingTimers.current.add(timer);
  }

  function registerMessageNode(id?: string) {
    return (node: HTMLDivElement | null) => {
      if (!id) return;
      if (node) {
        messageRefs.current.set(id, node);
      } else {
        messageRefs.current.delete(id);
      }
    };
  }

  function waitForUserMessageLanding() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        choreographyTimers.current.delete(timer);
        resolve();
      }, USER_MESSAGE_LAND_MS);
      choreographyTimers.current.add(timer);
    });
  }

  function scrollToMessage(id: string, behavior: ScrollBehavior = "smooth") {
    if (!autoFollowRef.current) return;
    programmaticScrollUntilRef.current = Date.now() + (behavior === "smooth" ? 620 : 220);
    const firstFrame = window.requestAnimationFrame(() => {
      scrollFrames.current.delete(firstFrame);
      const secondFrame = window.requestAnimationFrame(() => {
        scrollFrames.current.delete(secondFrame);
        messageRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior });
      });
      scrollFrames.current.add(secondFrame);
    });
    scrollFrames.current.add(firstFrame);
  }

  function scrollToConversationEnd(behavior: ScrollBehavior = "smooth") {
    if (!autoFollowRef.current) return;
    programmaticScrollUntilRef.current = Date.now() + (behavior === "smooth" ? 700 : 260);
    const firstFrame = window.requestAnimationFrame(() => {
      scrollFrames.current.delete(firstFrame);
      const secondFrame = window.requestAnimationFrame(() => {
        scrollFrames.current.delete(secondFrame);
        const scrollArea = scrollAreaRef.current;
        if (!scrollArea || !autoFollowRef.current) {
          return;
        }
        const nextTop = scrollArea.scrollHeight;
        scrollArea.scrollTo({ top: nextTop, behavior });
        if (behavior !== "smooth") {
          scrollArea.scrollTop = scrollArea.scrollHeight;
        }
        bottomAnchorRef.current?.scrollIntoView({ block: "nearest", behavior });
      });
      scrollFrames.current.add(secondFrame);
    });
    scrollFrames.current.add(firstFrame);
  }

  function resetAutoFollow() {
    autoFollowRef.current = true;
    userScrollIntentRef.current = false;
    scrollToConversationEnd("auto");
  }

  function handleConversationScroll() {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea || (Date.now() < programmaticScrollUntilRef.current && !userScrollIntentRef.current)) return;
    const distanceFromBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight;
    const nearBottom = distanceFromBottom < 56;
    if (nearBottom) {
      autoFollowRef.current = true;
      userScrollIntentRef.current = false;
      return;
    }
    if (userScrollIntentRef.current) {
      autoFollowRef.current = false;
    }
  }

  function handleUserScrollIntent() {
    userScrollIntentRef.current = true;
  }

  function conversationContext() {
    return messages
      .map((message) => ({
        role: message.role,
        content: (message.fullContent || message.content).trim()
      }))
      .filter((message) => message.content.length > 0)
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 2200)
      }));
  }

  function typeAiMessage(message: Omit<ChatMessage, "id" | "role" | "isTyping">) {
    const id = messageId("ai");
    const fullContent = message.content || "No response returned.";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setTypingResponse(!reduceMotion);
    setActiveFocusMessageId(id);
    setMessages((current) => [
      ...current,
      { ...message, id, role: "AI", content: reduceMotion ? fullContent : "", fullContent, isTyping: !reduceMotion }
    ]);
    scrollToMessage(id, "smooth");
    if (reduceMotion) {
      setTypingResponse(false);
      return;
    }

    activeTypingMessageIdRef.current = id;
    const chunkSize = fullContent.length > 1600 ? 8 : fullContent.length > 900 ? 6 : fullContent.length > 420 ? 4 : 2;
    let cursor = 0;

    const tick = () => {
      cursor = Math.min(fullContent.length, cursor + chunkSize);
      setMessages((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                content: fullContent.slice(0, cursor),
                isTyping: cursor < fullContent.length
              }
            : item
        )
      );
      scrollToConversationEnd("auto");
      if (cursor < fullContent.length) {
        const typedChar = fullContent[cursor - 1] || "";
        const pause = typedChar === "\n" ? 68 : /[.!?;:]/.test(typedChar) ? 82 : 24 + Math.random() * 20;
        scheduleTyping(tick, pause);
      } else {
        activeTypingMessageIdRef.current = null;
        setTypingResponse(false);
        scrollToConversationEnd("smooth");
      }
    };

    scheduleTyping(tick, 180);
  }

  async function ask(prompt?: string) {
    const finalQuestion = prompt || question;
    if (!finalQuestion.trim() || isBusy) return;
    const userMessageId = messageId("user");
    const clientMessages = conversationContext();
    setLoading(true);
    setShowThinking(false);
    resetAutoFollow();
    setActiveFocusMessageId(userMessageId);
    setMessages((current) => [...current, { id: userMessageId, role: "USER", content: finalQuestion }]);
    scrollToMessage(userMessageId, "auto");
    setQuestion("");
    try {
      const responsePromise = fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, question: finalQuestion, clientMessages })
      })
        .then(async (response) => ({ ok: true as const, data: await response.json() }))
        .catch((error) => ({ ok: false as const, error }));
      await waitForUserMessageLanding();
      setShowThinking(true);
      const result = await responsePromise;
      if (!result.ok) throw result.error;
      const data = result.data;
      if (data.thread?.id) setThreadId(data.thread.id);
      setShowThinking(false);
      typeAiMessage({
        content: data.answer || data.error || "No response returned.",
        action: data.action || null,
        previewAction: data.previewAction || null
      });
      router.refresh();
    } catch {
      setShowThinking(false);
      typeAiMessage({ content: "## Assistant unavailable\n\nI could not complete that request right now. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function decidePreview(previewAction: NonNullable<ChatMessage["previewAction"]>, decision: "approve" | "cancel") {
    if (isBusy) return;
    const label = actionLabel(previewAction.type);
    const userText = decision === "approve" ? `Approved ${label}` : `Cancelled ${label}`;
    const userMessageId = messageId("user");
    const clientMessages = conversationContext();
    setLoading(true);
    setShowThinking(false);
    resetAutoFollow();
    setActiveFocusMessageId(userMessageId);
    setMessages((current) => [...current, { id: userMessageId, role: "USER", content: userText }]);
    scrollToMessage(userMessageId, "auto");
    try {
      const responsePromise = fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          question: userText,
          clientMessages,
          approval: { decision, previewId: previewAction.previewId }
        })
      })
        .then(async (response) => ({ ok: true as const, data: await response.json() }))
        .catch((error) => ({ ok: false as const, error }));
      await waitForUserMessageLanding();
      setShowThinking(true);
      const result = await responsePromise;
      if (!result.ok) throw result.error;
      const data = result.data;
      if (data.thread?.id) setThreadId(data.thread.id);
      setResolvedPreviews((current) => new Set(current).add(previewAction.previewId));
      setShowThinking(false);
      typeAiMessage({
        content: data.answer || data.error || "No response returned.",
        action: data.action || null,
        previewAction: data.previewAction || null
      });
      router.refresh();
    } catch {
      setShowThinking(false);
      typeAiMessage({ content: "## Assistant unavailable\n\nI could not complete that approval request right now. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const chips = [
    "Run a reorder plan from live stock",
    "Show the highest collection risks",
    "Find products with weak sales quality",
    "Prepare a cashflow risk brief",
    "Create customer: Bright Star School, phone 03001234567, address Gulberg Lahore, credit limit 250000",
    "Add product: HP EliteBook 840, category Laptops, cost 190000, sale price 225000, stock 8, low stock 3",
    "Search products named printer before preparing an invoice"
  ];

  return (
    <Card className="assistant-console overflow-hidden">
      <CardContent className="p-0">
        <div className="crud-header p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_45px_hsl(var(--primary)/0.25)]">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold tracking-normal">ShopIQ Gemini Agent</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Live Gemini assistance with role-aware ShopIQ tools, operating jobs, and confirmation-gated database actions.
                </p>
              </div>
            </div>
            <Badge variant="success" className="w-fit shrink-0">
              <Bot className="mr-1 size-3" />
              Gemini live
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button key={chip} type="button" className="assistant-chip" onClick={() => ask(chip)} disabled={isBusy}>
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={scrollAreaRef}
          onScroll={handleConversationScroll}
          onPointerDown={handleUserScrollIntent}
          onTouchMove={handleUserScrollIntent}
          onWheel={handleUserScrollIntent}
          className="flex max-h-[520px] flex-col gap-3 overflow-y-auto bg-muted/10 p-4"
        >
          {messages.length ? (
            messages.map((message, index) => {
              const previewResolved = message.previewAction ? resolvedPreviews.has(message.previewAction.previewId) : false;
              return (
                <div
                  key={message.id || `${message.role}-${index}`}
                  ref={registerMessageNode(message.id)}
                  className={cn(
                    "message-bubble message-enter",
                    message.role === "AI"
                      ? "message-enter-ai border-primary/20 bg-primary/5"
                      : "message-enter-user ml-auto max-w-[92%] border-border bg-background md:max-w-[78%]",
                    message.id === activeFocusMessageId && (message.role === "AI" ? "message-focus-ai" : "message-focus-user")
                  )}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{message.role === "AI" ? "ShopIQ Copilot" : "You"}</p>
                    {message.previewAction ? <Badge variant={previewResolved ? "secondary" : "warning"}>{previewResolved ? "Resolved preview" : actionLabel(message.previewAction.type)}</Badge> : null}
                    {message.action && !message.isTyping ? <Badge variant="success">Completed</Badge> : null}
                  </div>
                  <FormattedAiContent content={message.content} />
                  {message.isTyping ? <span className="typing-caret" aria-label="Assistant is typing" /> : null}
                  {message.previewAction && !previewResolved && !message.isTyping ? (
                    <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-muted-foreground">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <div>
                            <p className="font-medium text-foreground">Approval required before writing to the database</p>
                            <p className="mt-1 leading-6">
                              Review this preview carefully. The server will only execute it after you press approve or send a clear confirmation.
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button size="sm" onClick={() => decidePreview(message.previewAction!, "approve")} disabled={isBusy}>
                            <CheckCircle2 className="size-4" />
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => decidePreview(message.previewAction!, "cancel")} disabled={isBusy}>
                            <XCircle className="size-4" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {message.action && !message.isTyping ? (
                    <Button className="mt-4" asChild>
                      <Link href={message.action.href}>{message.action.label}</Link>
                    </Button>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="empty-state">Ask the Gemini agent to analyze live operations, search records, run reorder or collection jobs, or prepare validated actions for approval.</div>
          )}
          {showThinking ? (
            <div className="message-bubble message-enter message-enter-ai message-bubble-thinking border-primary/20 bg-primary/5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">ShopIQ Copilot</p>
                <Badge variant="secondary">Thinking</Badge>
              </div>
              <div className="typing-orbit" aria-label="Gemini is thinking">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
          <div ref={bottomAnchorRef} className="h-px shrink-0" aria-hidden="true" />
        </div>

        <div className="assistant-composer flex flex-col gap-3 border-t border-border/70 bg-background/60 p-4 sm:flex-row sm:items-end">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a business question or give a ShopIQ action..."
            rows={2}
            disabled={isBusy}
            className="min-h-[58px] max-h-[170px] resize-none rounded-2xl"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask();
              }
            }}
          />
          <Button className="assistant-send-button sm:min-h-[58px]" onClick={() => ask()} disabled={isBusy || !question.trim()}>
            <Send className="size-4" />
            {typingResponse ? "Typing..." : showThinking ? "Thinking..." : loading ? "Sending..." : "Ask"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
