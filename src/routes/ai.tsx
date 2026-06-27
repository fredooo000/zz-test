import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Send, User, Loader2, Sparkles, BookOpen, Code, Pen, Film, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "Kyrox AI — Chat" },
      { name: "description", content: "Chat with Kyrox AI — your media-savvy assistant." },
    ],
  }),
  component: AiPage,
});

type Mode = "general" | "homework" | "coding" | "creative" | "recommend";

const MODES: { value: Mode; label: string; icon: typeof Bot }[] = [
  { value: "general", label: "General", icon: Sparkles },
  { value: "homework", label: "Tutor", icon: BookOpen },
  { value: "coding", label: "Code", icon: Code },
  { value: "creative", label: "Creative", icon: Pen },
  { value: "recommend", label: "Recommend", icon: Film },
];

type Message = { role: "user" | "assistant"; content: string };

function AiPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey, I'm Kyrox AI. Ask me anything — about media, homework, coding, or just chat." },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("general");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);

    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const ac = new AbortController();
    setAbortController(ac);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI server error" }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || "";
            fullContent += delta;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { ...next[next.length - 1], content: fullContent };
              return next;
            });
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Something went wrong");
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `Error: ${err.message || "Unknown error"}` };
        return next;
      });
    } finally {
      setStreaming(false);
      setAbortController(null);
      inputRef.current?.focus();
    }
  };

  const stopStreaming = () => {
    abortController?.abort();
  };

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col max-w-3xl mx-auto min-h-[calc(100vh-12rem)] md:min-h-[calc(100vh-10rem)]"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4"
        >
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mb-1 flex items-center gap-2">
            <Bot className="size-7 text-brand" /> Kyrox AI
          </h1>
          <p className="text-slate-400 text-sm">Ask questions, get recommendations, or just chat.</p>
        </motion.div>

        {/* Mode selector */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 flex-wrap">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  mode === m.value ? "bg-brand text-white" : "glass text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="size-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="size-8 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="size-4 text-brand" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand text-white rounded-br-md"
                    : "glass text-slate-200 rounded-bl-md"
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-bg-primary [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_code]:text-brand [&_p]:my-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:my-0.5">
                  {msg.content ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : streaming && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1">
                      <span className="size-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : null}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
                  <User className="size-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 justify-center">
              <AlertTriangle className="size-3" /> {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-bg-primary pt-2 pb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask Kyrox AI ${mode !== "general" ? `(${mode} mode)` : "anything..."}`}
              disabled={streaming}
              className="flex-1 bg-surface/60 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand/50 focus:ring-4 focus:ring-brand/10 transition-all placeholder:text-slate-600 text-white disabled:opacity-50"
            />
            {streaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="size-11 shrink-0 grid place-items-center rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                <div className="size-4 bg-white rounded-sm" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="size-11 shrink-0 grid place-items-center rounded-2xl bg-brand text-white brand-glow hover:scale-105 transition-transform disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="size-4" />
              </button>
            )}
          </form>
          <p className="text-[10px] text-slate-600 text-center mt-2">
            Kyrox AI may produce inaccurate information. Responses are powered by OpenRouter.
          </p>
        </div>
      </motion.div>
    </AppShell>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const parts: { type: "text" | "code" | "bold" | "italic" | "link" | "list"; value: string }[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/```(\w*)\n([\s\S]*?)```/);
    if (codeMatch && codeMatch.index === 0) {
      parts.push({ type: "code", value: codeMatch[2] });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    const inlineCodeMatch = remaining.match(/^`([^`]+)`/);
    if (inlineCodeMatch) {
      parts.push({ type: "code", value: inlineCodeMatch[1] });
      remaining = remaining.slice(inlineCodeMatch[0].length);
      continue;
    }
    parts.push({ type: "text", value: remaining[0] });
    remaining = remaining.slice(1);
  }

  return (
    <>
      {content.split("\n").map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold text-white mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-base font-bold text-white mt-3 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold text-white mt-3 mb-1">{line.slice(2)}</h1>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-slate-200 ml-4 list-disc">{line.slice(2)}</li>;
        if (/^\d+\.\s/.test(line)) return <li key={i} className="text-slate-200 ml-4 list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
        if (line.startsWith("```") && line.endsWith("```")) return null;
        if (line.startsWith("> ")) return <blockquote key={i} className="border-l-2 border-brand/50 pl-3 text-slate-400 italic my-1">{line.slice(2)}</blockquote>;

        const rendered = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
          .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
          .replace(/`([^`]+)`/g, '<code class="text-brand bg-brand/10 px-1 rounded text-xs">$1</code>')
          .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-brand underline hover:text-brand/80">$1</a>');

        return <p key={i} className="text-slate-200 my-0.5" dangerouslySetInnerHTML={{ __html: rendered }} />;
      })}
    </>
  );
}
