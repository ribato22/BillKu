import next from "./.open-next/worker.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return next.fetch(request, env, ctx);
    }

    const origin = URL.parse(env.BACKEND_URL ?? "");
    const localHttp = origin?.protocol === "http:" && origin.hostname === "127.0.0.1";
    if (!origin || (origin.protocol !== "https:" && !localHttp) || origin.origin === url.origin) {
      return Response.json({ message: "BillKu API origin is unavailable" }, { status: 503 });
    }

    const target = new URL(origin.origin);
    target.pathname = url.pathname;
    target.search = url.search;

    try {
      return await fetch(new Request(target, request), { redirect: "manual", cache: "no-store" });
    } catch {
      return Response.json({ message: "BillKu API is unavailable" }, { status: 502 });
    }
  },
};
