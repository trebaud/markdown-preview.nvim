import { marked } from "marked";
import { watch } from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (!file || !(await Bun.file(file).exists())) {
  console.error(`usage: bun run server.ts <markdown-file>`);
  process.exit(1);
}
const dir = path.dirname(file);
// Path of the originally previewed file, relative to `dir` and with forward
// slashes — this is the "home" page the client loads by default.
const home = path.relative(dir, path.resolve(file)).split(path.sep).join("/");
const isMarkdown = (p: string) => /\.(md|markdown)$/i.test(p);

marked.setOptions({ gfm: true });
const slug = (s: string) =>
  s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
marked.use({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

const clients = new Set<ReadableStreamDefaultController>();
// Broadcast a relative path (a file changed) or "*" (force reload). Each client
// only refreshes when the payload matches the page it is currently viewing.
const send = (data: string) =>
  clients.forEach((c) => {
    try { c.enqueue(`data: ${data}\n\n`); } catch { clients.delete(c); }
  });

const toRel = (abs: string) => path.relative(dir, abs).split(path.sep).join("/");

// Watch each file the moment it is first rendered, so edits to any linked page
// (not just the original) live-reload too.
const watched = new Set<string>();
function ensureWatch(abs: string) {
  if (watched.has(abs)) return;
  watched.add(abs);
  let timer: Timer;
  try {
    watch(abs, () => {
      clearTimeout(timer);
      timer = setTimeout(() => send(toRel(abs)), 50);
    });
  } catch {
    watched.delete(abs);
  }
}

const web = path.join(import.meta.dir, "web");
const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const template = await Bun.file(path.join(web, "index.html")).text();
const shell = (rel: string) =>
  template.replace("{{title}}", escapeHtml(path.basename(rel))).replace("{{home}}", escapeHtml(home));

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const { pathname, searchParams } = new URL(req.url);
    if (pathname === "/")
      return new Response(shell(home), { headers: { "content-type": "text/html" } });
    if (pathname === "/app.css" || pathname === "/app.js") {
      const filePath = path.join(web, pathname.slice(1));
      const contentType = pathname.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "text/javascript; charset=utf-8";
      return new Response(Bun.file(filePath), { headers: { "content-type": contentType } });
    }
    if (pathname === "/content") {
      const rel = searchParams.get("path") || home;
      const abs = path.resolve(dir, rel);
      const f = Bun.file(abs);
      if (!(await f.exists())) return new Response("404", { status: 404 });
      ensureWatch(abs);
      const text = await f.text();
      const html = isMarkdown(abs)
        ? await marked.parse(text)
        : `<pre class="raw">${escapeHtml(text)}</pre>`;
      return new Response(html, { headers: { "content-type": "text/html" } });
    }
    if (pathname === "/reload") {
      send("*");
      return new Response("ok");
    }
    if (pathname === "/events") {
      let ctrl: ReadableStreamDefaultController;
      return new Response(
        new ReadableStream({
          start(c) { ctrl = c; clients.add(c); },
          cancel() { clients.delete(ctrl); },
        }),
        { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } },
      );
    }
    const root = path.resolve(dir);
    const abs = path.resolve(root, "." + decodeURIComponent(pathname));
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (abs !== root && !abs.startsWith(prefix)) return new Response("403", { status: 403 });
    const asset = Bun.file(abs);
    // A direct browser navigation to a markdown file (reload, opened link in a
    // new tab, bookmark) boots the SPA, which renders it. Everything else —
    // images, raw `.txt`, etc. — is served as-is, as before.
    if (isMarkdown(abs) && (req.headers.get("accept") || "").includes("text/html"))
      return new Response(shell(toRel(abs)), { headers: { "content-type": "text/html" } });
    return new Response(asset);
  },
});

ensureWatch(path.resolve(file));
console.log(`PORT:${server.port}`);
