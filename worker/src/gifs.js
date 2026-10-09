// The key is the URL path: apps/<slug>/<slug>.gif, or _goal.gif at the root.
// A rebuilt GIF is written back to the same key, so the edge hold is one
// minute. A burst of installs is then one bucket read per colo, and the
// next publish is what an install hash check sees. The browser fetch is
// no-store, so this hold is the edge, not the browser.
const HOLD_SECONDS = 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // www is a different origin, so a desktop opened there is a different
    // computer. This host only forwards to the apex.
    if (url.hostname === "www.gifos.app") {
      url.hostname = "gifos.app";
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    const key = gifKey(url.pathname);
    // A request that is not an app file is the rest of the site.
    if (!key) return fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const cacheKey = new Request(url.origin + "/" + key, { method: "GET" });
    if (request.method === "GET") {
      const hit = await caches.default.match(cacheKey);
      if (hit) return hit;
    }

    const obj = await env.GIFS.get(key);
    if (!obj) return new Response("not found", { status: 404 });

    const headers = new Headers();
    headers.set("content-type", "image/gif");
    headers.set("cache-control", "public, max-age=" + HOLD_SECONDS);
    if (obj.httpEtag) headers.set("etag", obj.httpEtag);
    if (obj.size != null) headers.set("content-length", String(obj.size));
    const resp = new Response(request.method === "HEAD" ? null : obj.body, {
      status: 200,
      headers,
    });
    if (request.method === "GET") {
      ctx.waitUntil(caches.default.put(cacheKey, resp.clone()));
    }
    return resp;
  },
};

function gifKey(pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (path.startsWith("/")) path = path.slice(1);
  if (!path.endsWith(".gif")) return null;
  if (path.includes("\\") || path.includes("\0")) return null;
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  return path;
}
