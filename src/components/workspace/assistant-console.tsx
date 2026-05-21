"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, Clock3, Loader2, MessageSquareText, PanelLeftClose, PanelLeftOpen, Plus, Search, Send, Sparkles, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormattedAiContent } from "@/utils/ai-content";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id?: string;
  role: "USER" | "AI";
  content: string;
  fullContent?: string;
  action?: { label: string; href: string } | null;
  previewAction?: { type: string; payload: Record<string, any>; previewId: string } | null;
  isTyping?: boolean;
  restored?: boolean;
};

type ChatThread = {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  lastMessageAt?: string;
};

const USER_MESSAGE_LAND_MS = 440;
const AI_REQUEST_TIMEOUT_MS = 55_000;

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

function threadTime(value?: string) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat("en", { month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" }).format(date);
}

function shortPreview(value?: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "No messages yet";
  return text.length > 92 ? `${text.slice(0, 89).trim()}...` : text;
}

function assistantUnavailableMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "## Assistant not responding\n\nThe AI service did not respond in time. I stopped waiting so you are not stuck here. Please try again in a moment.";
  }
  const message = error instanceof Error ? error.message : "";
  return `## Assistant unavailable\n\n${message || "The AI service is not working right now."}`;
}

async function fetchAssistantJson(input: RequestInfo | URL, init?: RequestInit, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Assistant request failed.");
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

export function AssistantConsole({ initialThreadId }: { initialThreadId?: string }) {
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadSearch, setThreadSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadLoadingId, setThreadLoadingId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [removingThreadIds, setRemovingThreadIds] = useState<Set<string>>(new Set());
  const [promotedThreadId, setPromotedThreadId] = useState<string | null>(null);
  const [chatStackAnimationKey, setChatStackAnimationKey] = useState(0);
  const [threadOpening, setThreadOpening] = useState(false);
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
  const historyListRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const threadRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingHistorySnapshotRef = useRef<Map<string, DOMRect>>(new Map());
  const autoFollowRef = useRef(true);
  const userScrollIntentRef = useRef(false);
  const activeTypingMessageIdRef = useRef<string | null>(null);
  const programmaticScrollUntilRef = useRef(0);
  const scrollFrames = useRef<Set<number>>(new Set());
  const router = useRouter();
  const isBusy = loading || typingResponse || Boolean(threadLoadingId) || Boolean(deletingThreadId);
  const activeThread = threads.find((thread) => thread.id === threadId);

  const filteredThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) => `${thread.title} ${thread.lastMessage || ""}`.toLowerCase().includes(query));
  }, [threadSearch, threads]);

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
    void loadThreads(initialThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function prefersReducedMotion() {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function registerThreadRow(id: string) {
    return (node: HTMLDivElement | null) => {
      if (node) {
        threadRowRefs.current.set(id, node);
        return;
      }
      threadRowRefs.current.delete(id);
    };
  }

  function captureHistoryPositions() {
    pendingHistorySnapshotRef.current = new Map();
    threadRowRefs.current.forEach((node, id) => {
      pendingHistorySnapshotRef.current.set(id, node.getBoundingClientRect());
    });
  }

  function animateHistoryScrollToTop(duration = 470) {
    const list = historyListRef.current;
    if (!list) return;
    const start = list.scrollTop;
    if (start <= 1) {
      list.scrollTop = 0;
      return;
    }
    if (prefersReducedMotion()) {
      list.scrollTop = 0;
      return;
    }

    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      scrollFrames.current.delete(frame);
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      list.scrollTop = start * (1 - eased);
      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
        scrollFrames.current.add(frame);
      }
    };
    frame = window.requestAnimationFrame(step);
    scrollFrames.current.add(frame);
  }

  function playHistoryStackAnimation(promotedId: string) {
    const snapshot = pendingHistorySnapshotRef.current;
    pendingHistorySnapshotRef.current = new Map();
    const reduceMotion = prefersReducedMotion();

    if (!reduceMotion) {
      threadRowRefs.current.forEach((node, id) => {
        const before = snapshot.get(id);
        if (!before) return;
        const after = node.getBoundingClientRect();
        const deltaY = before.top - after.top;
        if (Math.abs(deltaY) < 1) return;

        node.animate(
          [
            { offset: 0, transform: `translate3d(0, ${deltaY}px, 0) scale(${id === promotedId ? 0.986 : 1})`, opacity: id === promotedId ? 0.82 : 1 },
            { offset: 0.62, transform: "translate3d(0, -2px, 0) scale(1.003)", opacity: 1 },
            { offset: 1, transform: "translate3d(0, 0, 0) scale(1)", opacity: 1 }
          ],
          {
            duration: id === promotedId ? 470 : 410,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
          }
        );
      });
    }

    animateHistoryScrollToTop(reduceMotion ? 0 : 470);
  }

  function scheduleHistoryStackAnimation(promotedId: string) {
    const firstFrame = window.requestAnimationFrame(() => {
      scrollFrames.current.delete(firstFrame);
      const secondFrame = window.requestAnimationFrame(() => {
        scrollFrames.current.delete(secondFrame);
        playHistoryStackAnimation(promotedId);
      });
      scrollFrames.current.add(secondFrame);
    });
    scrollFrames.current.add(firstFrame);
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
        if (!scrollArea || !autoFollowRef.current) return;
        scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior });
        if (behavior !== "smooth") scrollArea.scrollTop = scrollArea.scrollHeight;
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
    if (userScrollIntentRef.current) autoFollowRef.current = false;
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

  function upsertThread(thread?: ChatThread) {
    if (!thread?.id) return;
    setThreads((current) => {
      const without = current.filter((item) => item.id !== thread.id);
      return [thread, ...without].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }

  function toggleHistoryPanel() {
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches;
    if (isMobile) {
      setHistoryOpen((open) => !open);
      return;
    }
    setHistoryCollapsed((collapsed) => !collapsed);
  }

  function closeHistoryPanel() {
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches;
    if (isMobile) {
      setHistoryOpen(false);
      return;
    }
    setHistoryCollapsed(true);
  }

  function clearActiveThreadIfDeleted(id: string) {
    if (threadId !== id) return;
    setThreadId(undefined);
    setMessages([]);
    setResolvedPreviews(new Set());
    setQuestion("");
    setShowThinking(false);
    setTypingResponse(false);
    setActiveFocusMessageId(null);
    resetAutoFollow();
  }

  async function deleteThread(id: string) {
    if (isBusy) return;
    setDeletingThreadId(id);
    try {
      const response = await fetch(`/api/ai/chat?threadId=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete assistant thread.");
      setDeleteConfirmId(null);
      setRemovingThreadIds((current) => new Set(current).add(id));
      const timer = window.setTimeout(() => {
        choreographyTimers.current.delete(timer);
        setThreads((current) => current.filter((thread) => thread.id !== id));
        setRemovingThreadIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        clearActiveThreadIfDeleted(id);
      }, 260);
      choreographyTimers.current.add(timer);
      toast.success("Chat history deleted.");
      router.refresh();
    } catch {
      toast.error("That chat history could not be deleted.");
    } finally {
      setDeletingThreadId(null);
    }
  }

  async function loadThreads(threadToLoad?: string) {
    setThreadsLoading(true);
    try {
      const response = await fetch("/api/ai/chat", { method: "GET" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load assistant history.");
      setThreads(Array.isArray(data.threads) ? data.threads : []);
      if (threadToLoad) await loadThread(threadToLoad, { silent: true });
    } catch {
      toast.error("Assistant history could not be loaded.");
    } finally {
      setThreadsLoading(false);
    }
  }

  async function loadThread(id: string, options: { silent?: boolean } = {}) {
    if (isBusy && !options.silent) return;
    const shouldAnimateHistoryMove = !options.silent && threads.some((thread) => thread.id === id);
    if (shouldAnimateHistoryMove) captureHistoryPositions();
    setThreadLoadingId(id);
    setShowThinking(false);
    setTypingResponse(false);
    setActiveFocusMessageId(null);
    try {
      const response = await fetch(`/api/ai/chat?threadId=${encodeURIComponent(id)}`, { method: "GET" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load thread.");
      const restoredMessages = (Array.isArray(data.messages) ? data.messages : []).map((message: ChatMessage) => ({
        ...message,
        restored: true,
        isTyping: false,
        fullContent: message.fullContent || message.content
      }));
      if (data.thread) upsertThread(data.thread);
      if (shouldAnimateHistoryMove) scheduleHistoryStackAnimation(data.thread?.id || id);
      setThreadId(data.thread?.id || id);
      setMessages(restoredMessages);
      setResolvedPreviews(new Set());
      setHistoryOpen(false);
      setPromotedThreadId(data.thread?.id || id);
      setChatStackAnimationKey((key) => key + 1);
      setThreadOpening(true);
      const timer = window.setTimeout(() => {
        choreographyTimers.current.delete(timer);
        setThreadOpening(false);
        setPromotedThreadId(null);
      }, 560);
      choreographyTimers.current.add(timer);
      resetAutoFollow();
      window.setTimeout(() => scrollToConversationEnd("auto"), 0);
    } catch {
      pendingHistorySnapshotRef.current = new Map();
      toast.error("That assistant thread could not be opened.");
    } finally {
      setThreadLoadingId(null);
    }
  }

  function newChat() {
    if (isBusy) return;
    setThreadId(undefined);
    setMessages([]);
    setResolvedPreviews(new Set());
    setQuestion("");
    setShowThinking(false);
    setActiveFocusMessageId(null);
    setDeleteConfirmId(null);
    setPromotedThreadId(null);
    setThreadOpening(false);
    setHistoryOpen(false);
    resetAutoFollow();
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
      const responsePromise = fetchAssistantJson("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, question: finalQuestion, clientMessages })
      }, AI_REQUEST_TIMEOUT_MS)
        .then((data) => ({ ok: true as const, data }))
        .catch((error) => ({ ok: false as const, error }));
      await waitForUserMessageLanding();
      setShowThinking(true);
      const result = await responsePromise;
      if (!result.ok) throw result.error;
      const data = result.data;
      if (data.thread?.id) {
        setThreadId(data.thread.id);
        upsertThread(data.thread);
      }
      setShowThinking(false);
      typeAiMessage({
        content: data.answer || data.error || "No response returned.",
        action: data.action || null,
        previewAction: data.previewAction || null
      });
      router.refresh();
    } catch (error) {
      setShowThinking(false);
      setMessages((current) => current.filter((message) => message.id !== userMessageId));
      toast.error("The AI assistant is not working right now.");
      typeAiMessage({ content: assistantUnavailableMessage(error) });
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
      const responsePromise = fetchAssistantJson("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          question: userText,
          clientMessages,
          approval: { decision, previewId: previewAction.previewId }
        })
      }, AI_REQUEST_TIMEOUT_MS)
        .then((data) => ({ ok: true as const, data }))
        .catch((error) => ({ ok: false as const, error }));
      await waitForUserMessageLanding();
      setShowThinking(true);
      const result = await responsePromise;
      if (!result.ok) throw result.error;
      const data = result.data;
      if (data.thread?.id) {
        setThreadId(data.thread.id);
        upsertThread(data.thread);
      }
      setResolvedPreviews((current) => new Set(current).add(previewAction.previewId));
      setShowThinking(false);
      typeAiMessage({
        content: data.answer || data.error || "No response returned.",
        action: data.action || null,
        previewAction: data.previewAction || null
      });
      router.refresh();
    } catch (error) {
      setShowThinking(false);
      setMessages((current) => current.filter((message) => message.id !== userMessageId));
      toast.error("The AI assistant is not working right now.");
      typeAiMessage({ content: assistantUnavailableMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  const chips = [
    { label: "Reorder plan", prompt: "Run a reorder plan from live stock" },
    { label: "Collection risks", prompt: "Show the highest collection risks" },
    { label: "Weak sellers", prompt: "Find products with weak sales quality" },
    { label: "Cashflow brief", prompt: "Prepare a cashflow risk brief" },
    { label: "Create customer", prompt: "Create customer: Bright Star School, phone 03001234567, address Gulberg Lahore, credit limit 250000" },
    { label: "Add product", prompt: "Add product: HP EliteBook 840, category Laptops, cost 190000, sale price 225000, stock 8, low stock 3" },
    { label: "Search printer", prompt: "Search products named printer before preparing an invoice" }
  ];

  return (
    <Card className="assistant-console assistant-thread-console overflow-hidden">
      <CardContent className="h-full min-h-0 p-0">
        <div className={cn("assistant-thread-layout", historyCollapsed && "is-history-collapsed")}>
          <aside className={cn("assistant-thread-sidebar", historyOpen && "is-open", historyCollapsed && "is-collapsed")}>
            <div className="assistant-thread-sidebar-head">
              <div>
                <p className="assistant-thread-kicker">History</p>
                <h3>Conversations</h3>
              </div>
              <div className="assistant-thread-head-actions">
                <Button type="button" size="sm" onClick={newChat} disabled={isBusy}>
                  <Plus className="size-4" />
                  New
                </Button>
                <Button type="button" variant="outline" size="icon" className="assistant-thread-collapse-button" onClick={closeHistoryPanel} title="Collapse chat history">
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>
            </div>
            <label className="assistant-thread-search">
              <Search className="size-4" />
              <Input value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="Search chats" />
            </label>
            <div ref={historyListRef} className="assistant-thread-list" aria-label="Assistant chat history" aria-busy={threadsLoading || undefined}>
              {threadsLoading ? (
                <>
                  <div className="assistant-thread-loading-note">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading conversations
                  </div>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="assistant-thread-skeleton">
                      <span className="assistant-thread-skeleton-icon" />
                      <span className="assistant-thread-skeleton-copy">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  ))}
                </>
              ) : filteredThreads.length ? (
                filteredThreads.map((thread) => {
                  const confirmingDelete = deleteConfirmId === thread.id;
                  const removing = removingThreadIds.has(thread.id);
                  const deleting = deletingThreadId === thread.id;
                  return (
                    <div
                      key={thread.id}
                      ref={registerThreadRow(thread.id)}
                      className={cn(
                        "assistant-thread-row",
                        thread.id === threadId && "is-active",
                        promotedThreadId === thread.id && "is-promoted",
                        confirmingDelete && "is-confirming-delete",
                        removing && "is-removing"
                      )}
                    >
                  <button
                    type="button"
                    className="assistant-thread-item"
                    onClick={() => loadThread(thread.id)}
                    disabled={(isBusy && threadLoadingId !== thread.id) || removing}
                  >
                    <span className="assistant-thread-icon">
                      {threadLoadingId === thread.id ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <strong>{thread.title}</strong>
                      <small>{shortPreview(thread.lastMessage)}</small>
                      <em>
                        <Clock3 className="size-3" />
                        {threadTime(thread.lastMessageAt || thread.updatedAt)}
                        {thread.messageCount ? ` • ${thread.messageCount} messages` : ""}
                      </em>
                    </span>
                  </button>
                      <div className="assistant-thread-actions">
                        {confirmingDelete ? (
                          <>
                            <button type="button" className="assistant-thread-confirm-delete" onClick={() => deleteThread(thread.id)} disabled={isBusy}>
                              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : "Delete"}
                            </button>
                            <button type="button" className="assistant-thread-cancel-delete" onClick={() => setDeleteConfirmId(null)} disabled={deleting}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="assistant-thread-delete"
                            onClick={() => setDeleteConfirmId(thread.id)}
                            disabled={isBusy || removing}
                            aria-label={`Delete ${thread.title}`}
                            title="Delete chat history"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="assistant-thread-empty">No saved conversations yet.</div>
              )}
            </div>
          </aside>

          <button
            type="button"
            className={cn("assistant-history-backdrop", historyOpen && "is-open")}
            onClick={() => setHistoryOpen(false)}
            aria-label="Close chat history"
            tabIndex={historyOpen ? 0 : -1}
          />

          <section key={chatStackAnimationKey} className={cn("assistant-chat-panel", threadOpening && "is-thread-opening")}>
            <div className="assistant-chat-header">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  className="assistant-history-toggle"
                  onClick={toggleHistoryPanel}
                  aria-label={historyCollapsed ? "Expand chat history" : "Toggle chat history"}
                  title={historyCollapsed ? "Expand chat history" : "Toggle chat history"}
                >
                  {historyCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                </button>
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_18px_45px_hsl(var(--primary)/0.25)]">
                  <Sparkles className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold tracking-normal">{activeThread?.title || "New ShopIQ chat"}</p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Live Gemini assistance with role-aware ShopIQ tools, saved history, and confirmation-gated database actions.
                  </p>
                </div>
              </div>
              <Badge variant="success" className="w-fit shrink-0">
                <Bot className="mr-1 size-3" />
                Gemini live
              </Badge>
            </div>

            <div className="assistant-chip-row">
              {chips.map((chip) => (
                <button key={chip.label} type="button" className="assistant-chip" onClick={() => ask(chip.prompt)} disabled={isBusy} title={chip.prompt}>
                  {chip.label}
                </button>
              ))}
            </div>

            <div
              ref={scrollAreaRef}
              onScroll={handleConversationScroll}
              onPointerDown={handleUserScrollIntent}
              onTouchMove={handleUserScrollIntent}
              onWheel={handleUserScrollIntent}
              className="assistant-message-scroll"
            >
              {messages.length ? (
                messages.map((message, index) => {
                  const previewResolved = message.previewAction ? resolvedPreviews.has(message.previewAction.previewId) : false;
                  return (
                    <div
                      key={message.id || `${message.role}-${index}`}
                      ref={registerMessageNode(message.id)}
                      style={{ "--message-delay": `${Math.min(index, 7) * 22}ms` } as CSSProperties}
                      className={cn(
                        "message-bubble",
                        !message.restored && "message-enter",
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
                          {message.action.href.startsWith("/api/")
                            ? <a href={message.action.href}>{message.action.label}</a>
                            : <Link href={message.action.href}>{message.action.label}</Link>}
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="assistant-welcome-state">
                  <Sparkles className="size-8" />
                  <h3>Start a saved ShopIQ conversation</h3>
                  <p>Ask about earnings, dues, inventory risks, billing work, or prepare a database action that requires your approval before writing.</p>
                </div>
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
                placeholder={threadId ? "Continue this saved conversation..." : "Ask a question to create a new saved chat..."}
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
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
