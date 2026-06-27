import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";

// ─── AI chat proxy ───────────────────────────────────────────────────────────
// Keeps the OpenRouter / Gemini keys server-side. The browser only ever talks
// to this route. Supports multiple modes with tuned system prompts and an
// ordered list of free OpenRouter models with automatic fallback.

type ChatMode = "general" | "homework" | "coding" | "creative" | "recommend";
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
};

const VISION_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

function messageHasImage(m: ChatMessage): boolean {
  return Array.isArray(m.content) && m.content.some((p) => p.type === "image_url");
}

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  general:
    "You are Kyrox AI, a friendly, witty, and knowledgeable assistant built into the Kyrox media hub. You answer clearly and concisely using Markdown formatting. Be helpful, accurate, conversational, and occasionally add a touch of personality. If asked about movies, TV shows, anime, or manga, you can give enthusiastic recommendations. Keep responses well-structured but not overly formal.",

  homework:
    "You are Kyrox Tutor, a patient and encouraging teacher. Never just give the answer — walk through the reasoning step by step. Break complex problems into clear, manageable parts. Use Markdown with headings, bullet points, and math notation (LaTeX inline with \\(\\) or block with \\[\\]) where helpful. Ask check-in questions to confirm understanding. Celebrate when the student gets it right. Adapt your explanation style to the user's apparent age and knowledge level.",

  coding:
    "You are Kyrox Code, an elite software engineer and technical mentor. Write correct, idiomatic, production-quality code with proper error handling. Always use fenced code blocks with the correct language tag. Explain your approach concisely before the code, then walk through key decisions after. Consider edge cases, performance, and security. When debugging, think aloud step by step. Suggest relevant testing approaches. If the problem is complex, propose an architecture before diving into implementation.",

  creative:
    "You are Kyrox Creative, a imaginative writing partner and brainstorming companion. Help users craft stories, poems, scripts, characters, and world-building ideas. Offer constructive feedback with specific suggestions, not just praise. When generating creative content, use vivid language and show don't tell. Ask questions that deepen the creative work. Be encouraging but honest. Support various forms: short stories, poetry, song lyrics, dialogue, descriptions, and more.",

  recommend:
    "You are Kyrox Recommender, a passionate entertainment expert who knows anime, manga, manhwa, movies, and TV shows inside out. Based on what the user has enjoyed, suggest titles they'll love. Explain WHY each recommendation fits their taste. Know your classics and hidden gems across all genres. When asked, compare similar works, break down what makes a show/movie great, and help users discover their next obsession. Keep recommendations personalized and justified.",
};

const MODELS: Record<ChatMode, string[]> = {
  general: [
    "google/gemini-2.0-flash-exp:free",
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
  homework: [
    "google/gemini-2.0-flash-exp:free",
    "openai/gpt-oss-120b:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
  ],
  coding: [
    "qwen/qwen3-coder:free",
    "google/gemini-2.0-flash-exp:free",
    "openai/gpt-oss-120b:free",
  ],
  creative: [
    "google/gemini-2.0-flash-exp:free",
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
  recommend: [
    "google/gemini-2.0-flash-exp:free",
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
  ],
};

function hasContent(m: ChatMessage): boolean {
  if (!m) return false;
  if (typeof m.content === "string") return m.content.trim().length > 0;
  return Array.isArray(m.content) && m.content.length > 0;
}

function clampHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter(hasContent)
    .slice(-30)
    .map((m) => ({
      role: m.role,
      content:
        typeof m.content === "string" ? m.content.slice(0, 12000) : m.content,
    }));
}

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "AI is not configured on this server." }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: { mode?: string; messages?: ChatMessage[] };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const validModes: ChatMode[] = ["general", "homework", "coding", "creative", "recommend"];
        const mode: ChatMode = validModes.includes(body.mode as ChatMode)
          ? (body.mode as ChatMode)
          : "general";
        const history = clampHistory(body.messages || []);
        if (history.length === 0) {
          return new Response(
            JSON.stringify({ error: "No messages provided." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const messages: ChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPTS[mode] },
          ...history,
        ];

        const useVision = history.some(messageHasImage);
        const modelList = useVision ? VISION_MODELS : MODELS[mode];

        let lastError = "Unknown error";
        for (const model of modelList) {
          try {
            const upstream = await fetch(
              "https://openrouter.ai/api/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://haven.app",
                  "X-Title": "Kyrox AI",
                },
                body: JSON.stringify({
                  model,
                  messages,
                  stream: true,
                  temperature: mode === "coding" ? 0.2 : mode === "creative" ? 0.9 : 0.7,
                  max_tokens: mode === "creative" ? 4096 : 2048,
                }),
              },
            );

            if (!upstream.ok || !upstream.body) {
              lastError = `${model}: ${upstream.status} ${await upstream
                .text()
                .catch(() => "")}`.slice(0, 300);
              continue;
            }

            return new Response(upstream.body, {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Model": model,
              },
            });
          } catch (e) {
            lastError = `${model}: ${String(e)}`.slice(0, 300);
          }
        }

        return new Response(
          JSON.stringify({ error: "All AI models are busy. Try again shortly.", detail: lastError }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
