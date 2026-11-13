// __ASSETS__ is replaced by scripts/build.mjs; all bytes come from public/.
const assets = __ASSETS__;

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const asset = assets[path];
    if (!asset) return new Response("Not found", { status: 404 });
    const headers = {
      "Content-Type": asset.type,
      "Cache-Control": path.endsWith(".html") ? "no-cache" : "public, max-age=3600, must-revalidate",
      ETag: asset.etag,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    };
    if (request.headers.get("If-None-Match") === asset.etag) return new Response(null, { status: 304, headers });
    const body = request.method === "HEAD" ? null : Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0));
    return new Response(body, { headers });
  },
};
