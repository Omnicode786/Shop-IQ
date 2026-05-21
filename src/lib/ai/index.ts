import { createHash } from "node:crypto";
import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part
} from "@google/genai";

export type GeminiToolResult = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  response: Record<string, unknown>;
};

export type GeminiTaskClass = "light" | "standard" | "heavy";

export type GeminiToolTurnInput = {
  systemInstruction: string;
  userPrompt: string;
  history?: Content[];
  tools: FunctionDeclaration[];
  executeToolCall: (call: FunctionCall) => Promise<Record<string, unknown>>;
  taskClass?: GeminiTaskClass;
  cacheable?: boolean;
  cacheKey?: string;
};

export type GeminiToolTurnResult = {
  text: string;
  provider: "gemini";
  model: string;
  confidence: number;
  toolResults: GeminiToolResult[];
  usage: {
    cached: boolean;
    queued: boolean;
    keyId?: string;
  };
};

type GeminiResponseLite = {
  text?: string;
  functionCalls?: FunctionCall[];
  model: string;
  cached?: boolean;
  keyId?: string;
};

type KeyState = {
  id: string;
  apiKey: string;
  requests: number;
  successes: number;
  failures: number;
  quotaFailures: number;
  cooldownUntil: number;
  lastError?: string;
  lastUsedAt?: number;
};

type CacheEntry = {
  expiresAt: number;
  value: GeminiResponseLite;
};

type QueueJob<T> = {
  id: number;
  label: string;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  run: () => Promise<T>;
};

type UsageSnapshot = {
  provider: "gemini";
  configured: boolean;
  queue: { pending: number; active: number; concurrency: number };
  totals: {
    requests: number;
    successfulRequests: number;
    failedRequests: number;
    quotaFailures: number;
    cachedResponsesUsed: number;
  };
  models: {
    light: string;
    standard: string;
    heavy: string;
  };
  keys: Array<{
    id: string;
    status: "available" | "cooling_down";
    requests: number;
    successes: number;
    failures: number;
    quotaFailures: number;
    cooldownUntil: string | null;
    lastError?: string;
    lastUsedAt: string | null;
  }>;
  lastQuotaError: string | null;
};

class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiQuotaError";
  }
}

class GeminiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiKeyError";
  }
}

function env(name: string, fallback = "") {
  return (process.env[name] || fallback).trim().replace(/^['"]|['"]$/g, "");
}

function envInt(name: string, fallback: number, min = 1, max = 10_000_000) {
  const parsed = Number(env(name));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function unique<T>(items: T[]) {
  return [...new Set(items.filter(Boolean))];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function keyId(apiKey: string, index: number) {
  return `gemini-key-${index + 1}-${hashText(apiKey).slice(0, 8)}`;
}

function configuredKeys() {
  const multi = env("GEMINI_API_KEYS")
    .split(/[\n,;]+/)
    .map((item) => item.trim().replace(/^['"]+|['"]+$/g, "").trim())
    .filter(Boolean);
  const legacy = env("GEMINI_API_KEY").replace(/^['"]+|['"]+$/g, "").trim();
  return unique([...multi, legacy]);
}

function configuredKeySignature() {
  return hashText(configuredKeys().join("|"));
}

export function getGeminiModel(taskClass: GeminiTaskClass = "standard") {
  if (taskClass === "light") return env("GEMINI_MODEL_LIGHT", env("GEMINI_MODEL", "gemini-3.1-flash-lite-preview"));
  if (taskClass === "heavy") return env("GEMINI_MODEL_STRONG", env("GEMINI_MODEL", "gemini-3.1-pro-preview"));
  return env("GEMINI_MODEL_DEFAULT", env("GEMINI_MODEL", "gemini-3-flash-preview"));
}

function modelCandidates(taskClass: GeminiTaskClass) {
  const light = getGeminiModel("light");
  const standard = getGeminiModel("standard");
  const heavy = getGeminiModel("heavy");
  if (taskClass === "heavy") return unique([heavy, standard, light]);
  if (taskClass === "light") return unique([light, standard]);
  return unique([standard, light]);
}

function textFromResponse(response: { text?: string }) {
  const text = response.text?.trim();
  return text || "I could not produce a final answer from Gemini for this request.";
}

function safetySettings() {
  return [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }
  ];
}

function normalizeCall(call: FunctionCall) {
  return {
    id: call.id,
    name: String(call.name || ""),
    args: (call.args || {}) as Record<string, unknown>
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Gemini request failed.");
}

function errorStatus(error: unknown) {
  const record = error as Record<string, unknown>;
  return Number(record?.status || record?.statusCode || record?.code || 0);
}

function isQuotaOrRateLimit(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  const status = errorStatus(error);
  return status === 429 || message.includes("quota") || message.includes("rate limit") || message.includes("resource_exhausted") || message.includes("too many requests");
}

function isInvalidApiKey(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  const status = errorStatus(error);
  return status === 400 && (message.includes("api_key_invalid") || message.includes("api key not valid") || message.includes("invalid api key"));
}

function isModelFallbackError(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  const status = errorStatus(error);
  if (isInvalidApiKey(error)) return false;
  return status === 400 || status === 404 || message.includes("model") || message.includes("not found") || message.includes("unsupported");
}

function aiDebugLogsEnabled() {
  return env("AI_DEBUG_LOGS", "true").toLowerCase() !== "false";
}

function geminiLog(level: "info" | "warn" | "error", event: string, details: Record<string, unknown>) {
  if (!aiDebugLogsEnabled()) return;
  console[level](`[ShopIQ AI] ${event}`, details);
}

class GeminiRuntime {
  readonly keySignature: string;
  private keys: KeyState[];
  private queue: Array<QueueJob<unknown>> = [];
  private active = 0;
  private nextJobId = 1;
  private cache = new Map<string, CacheEntry>();
  private clients = new Map<string, GoogleGenAI>();
  private totals = {
    requests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    quotaFailures: 0,
    cachedResponsesUsed: 0
  };
  private lastQuotaError: string | null = null;

  constructor() {
    const keys = configuredKeys();
    this.keySignature = hashText(keys.join("|"));
    this.keys = keys.map((apiKey, index) => ({
      id: keyId(apiKey, index),
      apiKey,
      requests: 0,
      successes: 0,
      failures: 0,
      quotaFailures: 0,
      cooldownUntil: 0
    }));
  }

  private get concurrency() {
    return envInt("GEMINI_QUEUE_CONCURRENCY", 1, 1, 4);
  }

  private get cacheTtlMs() {
    return envInt("GEMINI_CACHE_TTL_MS", 5 * 60_000, 15_000, 60 * 60_000);
  }

  private get cacheMaxEntries() {
    return envInt("GEMINI_CACHE_MAX_ENTRIES", 120, 10, 2000);
  }

  private get keyCooldownMs() {
    return envInt("GEMINI_KEY_COOLDOWN_MS", 90_000, 5_000, 60 * 60_000);
  }

  private get invalidKeyCooldownMs() {
    return envInt("GEMINI_INVALID_KEY_COOLDOWN_MS", 60 * 60_000, 60_000, 24 * 60 * 60_000);
  }

  private get maxKeyAttempts() {
    return envInt("GEMINI_MAX_KEY_ATTEMPTS", Math.min(Math.max(this.keys.length, 1), 3), 1, 10);
  }

  private clientFor(key: KeyState) {
    const existing = this.clients.get(key.id);
    if (existing) return existing;
    const client = new GoogleGenAI({ apiKey: key.apiKey });
    this.clients.set(key.id, client);
    return client;
  }

  private cacheGet(cacheKey: string) {
    const hit = this.cache.get(cacheKey);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }
    this.totals.cachedResponsesUsed += 1;
    geminiLog("info", "Gemini cache hit", {
      cacheKey: hashText(cacheKey).slice(0, 10),
      model: hit.value.model,
      keyId: hit.value.keyId || "cached"
    });
    return { ...hit.value, cached: true };
  }

  private cacheSet(cacheKey: string, value: GeminiResponseLite) {
    if (this.cache.size >= this.cacheMaxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { value: { ...value, cached: false }, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private availableKey(excluded: Set<string>) {
    const now = Date.now();
    return this.keys
      .filter((key) => !excluded.has(key.id) && key.cooldownUntil <= now)
      .sort((a, b) => a.requests - b.requests || a.failures - b.failures)[0] || null;
  }

  private markFailure(key: KeyState, error: unknown, quota: boolean, invalidKey = false) {
    const message = errorMessage(error);
    key.failures += 1;
    key.lastError = message.slice(0, 220);
    this.totals.failedRequests += 1;
    if (invalidKey) {
      key.cooldownUntil = Date.now() + this.invalidKeyCooldownMs;
      return;
    }
    if (quota) {
      key.quotaFailures += 1;
      key.cooldownUntil = Date.now() + this.keyCooldownMs;
      this.totals.quotaFailures += 1;
      this.lastQuotaError = `${key.id}: ${key.lastError}`;
    }
  }

  private enqueue<T>(label: string, run: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ id: this.nextJobId++, label, resolve: resolve as (value: unknown) => void, reject, run: run as () => Promise<unknown> });
      this.drain();
    });
  }

  private drain() {
    while (this.active < this.concurrency && this.queue.length) {
      const job = this.queue.shift()!;
      this.active += 1;
      void job
        .run()
        .then(job.resolve)
        .catch(job.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }

  async generate(input: {
    label: string;
    taskClass: GeminiTaskClass;
    cacheable: boolean;
    cacheKey: string;
    payload: {
      contents: Content[];
      config: Record<string, unknown>;
    };
  }): Promise<GeminiResponseLite> {
    if (!this.keys.length) {
      throw new Error("Gemini is not configured. Add GEMINI_API_KEY or GEMINI_API_KEYS to your environment.");
    }

    if (input.cacheable) {
      const cached = this.cacheGet(input.cacheKey);
      if (cached) return cached;
    }

    return this.enqueue(input.label, async () => {
      let lastError: unknown = null;
      for (const model of modelCandidates(input.taskClass)) {
        const excluded = new Set<string>();
        const attempts = Math.min(this.keys.length, this.maxKeyAttempts);
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const key = this.availableKey(excluded);
          if (!key) {
            geminiLog("warn", "No available Gemini key for attempt", {
              job: input.label,
              model,
              attempt: attempt + 1,
              configuredKeys: this.keys.length,
              coolingDownKeys: this.keys.filter((item) => item.cooldownUntil > Date.now()).map((item) => item.id)
            });
            break;
          }
          excluded.add(key.id);
          key.requests += 1;
          key.lastUsedAt = Date.now();
          this.totals.requests += 1;
          geminiLog("info", "Trying Gemini provider key", {
            job: input.label,
            model,
            keyId: key.id,
            attempt: attempt + 1,
            maxAttempts: attempts,
            queuePending: this.queue.length,
            queueActive: this.active
          });
          try {
            const response = await this.clientFor(key).models.generateContent({
              model,
              contents: input.payload.contents,
              config: input.payload.config as any
            });
            const value: GeminiResponseLite = {
              text: response.text,
              functionCalls: JSON.parse(JSON.stringify(response.functionCalls || [])),
              model,
              keyId: key.id
            };
            key.successes += 1;
            this.totals.successfulRequests += 1;
            geminiLog("info", "Gemini provider key succeeded", {
              job: input.label,
              model,
              keyId: key.id,
              cached: false,
              requests: key.requests,
              successes: key.successes
            });
            if (input.cacheable) this.cacheSet(input.cacheKey, value);
            return value;
          } catch (error) {
            lastError = error;
            const quota = isQuotaOrRateLimit(error);
            const invalidKey = isInvalidApiKey(error);
            this.markFailure(key, error, quota, invalidKey);
            geminiLog(quota || invalidKey ? "warn" : "error", "Gemini provider key failed", {
              job: input.label,
              model,
              keyId: key.id,
              status: errorStatus(error) || "unknown",
              quota,
              invalidKey,
              cooldownUntil: key.cooldownUntil > Date.now() ? new Date(key.cooldownUntil).toISOString() : null,
              error: key.lastError
            });
            if (invalidKey) {
              await sleep(120);
              continue;
            }
            if (quota) {
              await sleep(Math.min(250 * 2 ** attempt, 1500));
              continue;
            }
            if (isModelFallbackError(error)) break;
            throw error;
          }
        }
      }

      if (isQuotaOrRateLimit(lastError)) {
        throw new GeminiQuotaError("Gemini quota is temporarily exhausted for the configured provider keys. Please try again after cooldown, reduce request volume, increase quota, or move to a paid tier.");
      }
      if (isInvalidApiKey(lastError)) {
        throw new GeminiKeyError("All configured Gemini API keys were rejected by Google. Check GEMINI_API_KEYS formatting, rotate invalid keys, and restart the server.");
      }
      throw lastError || new GeminiQuotaError("No Gemini provider key is currently available.");
    });
  }

  snapshot(): UsageSnapshot {
    const now = Date.now();
    return {
      provider: "gemini",
      configured: Boolean(this.keys.length),
      queue: { pending: this.queue.length, active: this.active, concurrency: this.concurrency },
      totals: { ...this.totals },
      models: {
        light: getGeminiModel("light"),
        standard: getGeminiModel("standard"),
        heavy: getGeminiModel("heavy")
      },
      keys: this.keys.map((key) => ({
        id: key.id,
        status: key.cooldownUntil > now ? "cooling_down" : "available",
        requests: key.requests,
        successes: key.successes,
        failures: key.failures,
        quotaFailures: key.quotaFailures,
        cooldownUntil: key.cooldownUntil > now ? new Date(key.cooldownUntil).toISOString() : null,
        lastError: key.lastError,
        lastUsedAt: key.lastUsedAt ? new Date(key.lastUsedAt).toISOString() : null
      })),
      lastQuotaError: this.lastQuotaError
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __shopiqGeminiRuntime: GeminiRuntime | undefined;
}

function runtime() {
  if (!globalThis.__shopiqGeminiRuntime || globalThis.__shopiqGeminiRuntime.keySignature !== configuredKeySignature()) {
    globalThis.__shopiqGeminiRuntime = new GeminiRuntime();
  }
  return globalThis.__shopiqGeminiRuntime;
}

function buildCacheKey(label: string, modelIntent: GeminiTaskClass, payload: unknown, extra?: string) {
  return hashText(`${label}:${modelIntent}:${extra || ""}:${stableStringify(payload)}`);
}

async function generateManaged(input: {
  label: string;
  taskClass: GeminiTaskClass;
  cacheable?: boolean;
  cacheKey?: string;
  contents: Content[];
  config: Record<string, unknown>;
}) {
  const payload = { contents: input.contents, config: input.config };
  return runtime().generate({
    label: input.label,
    taskClass: input.taskClass,
    cacheable: input.cacheable ?? true,
    cacheKey: input.cacheKey || buildCacheKey(input.label, input.taskClass, payload),
    payload
  });
}

export function getGeminiUsageSnapshot() {
  return runtime().snapshot();
}

export function isGeminiQuotaError(error: unknown) {
  return error instanceof GeminiQuotaError || isQuotaOrRateLimit(error);
}

export function isGeminiKeyError(error: unknown) {
  return error instanceof GeminiKeyError || isInvalidApiKey(error);
}

export async function runGeminiToolTurn(input: GeminiToolTurnInput): Promise<GeminiToolTurnResult> {
  const taskClass = input.taskClass || "standard";
  const contents: Content[] = [
    ...(input.history || []),
    { role: "user", parts: [{ text: input.userPrompt }] }
  ];

  const baseConfig = {
    systemInstruction: input.systemInstruction,
    temperature: taskClass === "heavy" ? 0.18 : 0.16,
    maxOutputTokens: taskClass === "light" ? 1200 : taskClass === "heavy" ? 3400 : 2200,
    safetySettings: safetySettings()
  };

  const first = await generateManaged({
    label: "tool-selection",
    taskClass,
    cacheable: input.cacheable ?? true,
    cacheKey: input.cacheKey ? `${input.cacheKey}:tool-selection` : undefined,
    contents,
    config: {
      ...baseConfig,
      tools: [{ functionDeclarations: input.tools }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO
        }
      }
    }
  });

  const calls = first.functionCalls || [];
  if (!calls.length) {
    return {
      text: textFromResponse(first),
      provider: "gemini",
      model: first.model,
      confidence: first.cached ? 0.86 : 0.82,
      toolResults: [],
      usage: { cached: Boolean(first.cached), queued: true, keyId: first.keyId }
    };
  }

  const toolResults: GeminiToolResult[] = [];
  for (const call of calls.slice(0, 4)) {
    const normalized = normalizeCall(call);
    if (!normalized.name) continue;
    try {
      const response = await input.executeToolCall(call);
      toolResults.push({ ...normalized, response });
    } catch (error) {
      toolResults.push({
        ...normalized,
        response: {
          ok: false,
          error: error instanceof Error ? error.message : "Tool execution failed."
        }
      });
    }
  }

  const modelParts: Part[] = calls.map((call) => ({ functionCall: call }));
  const toolParts: Part[] = toolResults.map((result) => ({
    functionResponse: {
      id: result.id,
      name: result.name,
      response: result.response
    }
  }));

  const final = await generateManaged({
    label: "tool-final-answer",
    taskClass,
    cacheable: input.cacheable ?? true,
    cacheKey: input.cacheKey ? `${input.cacheKey}:tool-final` : undefined,
    contents: [
      ...contents,
      { role: "model", parts: modelParts },
      { role: "user", parts: toolParts }
    ],
    config: {
      ...baseConfig,
      temperature: taskClass === "heavy" ? 0.16 : 0.14
    }
  });

  return {
    text: textFromResponse(final),
    provider: "gemini",
    model: final.model,
    confidence: final.cached ? 0.93 : 0.9,
    toolResults,
    usage: { cached: Boolean(first.cached || final.cached), queued: true, keyId: final.keyId || first.keyId }
  };
}
