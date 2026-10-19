import { createServerFn } from "@tanstack/react-start";
import { localSpeak, type CortexContext } from "@/legacy/browser-organism/language";
import { createIdentity } from "@/legacy/browser-organism/identity";

export const speakWithCortex = createServerFn({ method: "POST" })
  .validator((input: CortexContext) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    const identity = createIdentity();
    identity.traits = data.traits;
    identity.trust = data.trust;
    identity.subjectId = data.identity;

    if (!apiKey) {
      return { ok: true as const, text: localSpeak(data), backend: "local" as const };
    }

    const { buildSystemPrompt } = await import("@/legacy/browser-organism/language");
    const system = buildSystemPrompt(data, identity);
    const messages = [
      { role: "system", content: system },
      ...data.recent.map((m) => ({
        role: m.role === "kurisu" ? ("assistant" as const) : ("user" as const),
        content: m.text.slice(0, 1200),
      })),
      { role: "user" as const, content: data.user.slice(0, 4000) },
    ];

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          messages,
          max_tokens: 280,
          temperature: 0.7,
        }),
      });
      if (!res.ok) {
        return { ok: true as const, text: localSpeak(data), backend: "local" as const };
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) return { ok: true as const, text: localSpeak(data), backend: "local" as const };
      return { ok: true as const, text, backend: "grok" as const };
    } catch {
      return { ok: true as const, text: localSpeak(data), backend: "local" as const };
    }
  });
