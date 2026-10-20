import { apiEventStream } from "@/lib/api";

// Relays the API's live event stream to the browser, so the API key stays on the server.
// Behind the same password gate as the pages (proxy.ts).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let upstream: Response;
  try {
    upstream = await apiEventStream("/events", request.signal);
  } catch {
    return new Response("The scraper API is unreachable.", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("The live event stream is unavailable.", { status: upstream.status === 200 ? 502 : upstream.status });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables response buffering in nginx-like reverse proxies.
      "X-Accel-Buffering": "no",
    },
  });
}
