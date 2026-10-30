import { connection } from "next/server";

/**
 * Menu photos. MediaAsset.url and menu `image` fields are paths like
 * `/media/croque.jpg` on the Core API; the browser never talks to the Core
 * API, so the BFF streams them from there. next/image resizes the result.
 *
 * OPEN QUESTION (docs/backlog-pending.md): the contract does not define where
 * media is served. Until it does, it comes from CORE_MEDIA_URL (the mock's own
 * port, since Prism rejects paths outside the contract), else CORE_API_URL.
 */
function mediaBase(): string | undefined {
  return process.env.CORE_MEDIA_URL ?? process.env.CORE_API_URL;
}

export async function GET(_request: Request, { params }: RouteContext<"/media/[...path]">) {
  await connection();
  const { path } = await params;
  const base = mediaBase();
  if (!base || path.some((part) => part === ".." || part.includes("/"))) {
    return new Response(null, { status: 404 });
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${base}/media/${path.map(encodeURIComponent).join("/")}`);
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
