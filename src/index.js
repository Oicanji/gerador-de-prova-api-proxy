const ALLOWED_PREFIXES = ["/api/v1/"];

function isAllowedPath(pathname) {
  if (pathname === "/health" || pathname === "/health/backend" || pathname === "/heath") {
    return true;
  }
  return ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

export default {
  async fetch(request, env) {
    const corsOrigin = (env.CORS_ORIGIN || "https://oicanji.github.io").trim();
    const cors = corsHeaders(corsOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (!isAllowedPath(url.pathname)) {
      return new Response(JSON.stringify({ error: "Not found." }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ status: "ok", layer: "worker" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const backend = (env.BACKEND_ORIGIN || "https://gerador-de-prova-backend.onrender.com").replace(
      /\/$/,
      ""
    );
    const backendPath =
      url.pathname === "/health/backend" ? "/health" : `${url.pathname}${url.search}`;
    const target = `${backend}${backendPath}`;

    const headers = new Headers(request.headers);
    headers.delete("host");
    const apiKey = request.headers.get("X-API-Key") || request.headers.get("x-api-key");
    if (apiKey) {
      headers.set("X-API-Key", apiKey);
    }
    const auth = request.headers.get("Authorization");
    if (auth) {
      headers.set("Authorization", auth);
    }

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    let backendResponse;
    try {
      backendResponse = await fetch(target, init);
    } catch {
      return new Response(JSON.stringify({ error: "Backend indisponivel." }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/heath" && backendResponse.status >= 300 && backendResponse.status < 400) {
      const loc = backendResponse.headers.get("Location");
      if (loc) {
        backendResponse = await fetch(loc, { method: request.method, headers, redirect: "follow" });
      }
    }

    const outHeaders = new Headers(backendResponse.headers);
    Object.entries(cors).forEach(([k, v]) => outHeaders.set(k, v));

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: outHeaders,
    });
  },
};
