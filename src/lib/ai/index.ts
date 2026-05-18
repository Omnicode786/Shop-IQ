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

export type GeminiToolTurnInput = {
  systemInstruction: string;
  userPrompt: string;
  history?: Content[];
  tools: FunctionDeclaration[];
  executeToolCall: (call: FunctionCall) => Promise<Record<string, unknown>>;
};

export type GeminiToolTurnResult = {
  text: string;
  provider: "gemini";
  model: string;
  confidence: number;
  toolResults: GeminiToolResult[];
};

function env(name: string, fallback = "") {
  return (process.env[name] || fallback).trim().replace(/^['"]|['"]$/g, "");
}

export function getGeminiModel() {
  return env("GEMINI_MODEL", "gemini-2.5-flash");
}

function geminiApiKey() {
  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Gemini is not configured. Add GEMINI_API_KEY to your environment.");
  }
  return apiKey;
}

function createClient() {
  return new GoogleGenAI({ apiKey: geminiApiKey() });
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

export async function runGeminiToolTurn(input: GeminiToolTurnInput): Promise<GeminiToolTurnResult> {
  const model = getGeminiModel();
  const ai = createClient();
  const contents: Content[] = [
    ...(input.history || []),
    { role: "user", parts: [{ text: input.userPrompt }] }
  ];

  const config = {
    systemInstruction: input.systemInstruction,
    temperature: 0.22,
    maxOutputTokens: 2800,
    safetySettings: safetySettings(),
    tools: [{ functionDeclarations: input.tools }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO
      }
    }
  };

  const first = await ai.models.generateContent({ model, contents, config });
  const calls = first.functionCalls || [];
  if (!calls.length) {
    return { text: textFromResponse(first), provider: "gemini", model, confidence: 0.82, toolResults: [] };
  }

  const toolResults: GeminiToolResult[] = [];
  for (const call of calls.slice(0, 6)) {
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

  const final = await ai.models.generateContent({
    model,
    contents: [
      ...contents,
      { role: "model", parts: modelParts },
      { role: "user", parts: toolParts }
    ],
    config: {
      systemInstruction: input.systemInstruction,
      temperature: 0.2,
      maxOutputTokens: 2800,
      safetySettings: safetySettings()
    }
  });

  return {
    text: textFromResponse(final),
    provider: "gemini",
    model,
    confidence: 0.9,
    toolResults
  };
}
