const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", { status: 403 });
    }
    const headers = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers });
    if (!env.AI_API_URL || !env.AI_API_KEY || !env.AI_MODEL) {
      return Response.json({ error: "Server is not configured." }, { status: 503, headers });
    }
    try {
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 20) {
        return Response.json({ error: "Send between 1 and 20 messages." }, { status: 400, headers });
      }
      const messages = body.messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "").slice(0, 6000)
      }));
      const base = env.AI_API_URL.endsWith("/") ? env.AI_API_URL.slice(0, -1) : env.AI_API_URL;
      const upstream = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.AI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.AI_MODEL, messages, max_tokens: 700 })
      });
      const result = await upstream.json();
      if (!upstream.ok) return Response.json({ error: "AI provider request failed." }, { status: 502, headers });
      const reply = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
      if (!reply) return Response.json({ error: "The AI provider returned no text." }, { status: 502, headers });
      return Response.json({ reply: String(reply) }, { headers });
    } catch (error) {
      return Response.json({ error: "Invalid request or server error." }, { status: 400, headers });
    }
  }
};
