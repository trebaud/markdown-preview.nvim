import { marked } from "marked";
import { watch } from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (!file || !(await Bun.file(file).exists())) {
  console.error(`usage: bun run server.ts <markdown-file>`);
  process.exit(1);
}
const dir = path.dirname(file);
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
const notify = () =>
  clients.forEach((c) => {
    try { c.enqueue("data: reload\n\n"); } catch { clients.delete(c); }
  });
let timer: Timer;
watch(file, () => {
  clearTimeout(timer);
  timer = setTimeout(notify, 50);
});

const web = path.join(import.meta.dir, "web");
const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const template = await Bun.file(path.join(web, "index.html")).text();
const shell = () => template.replace("{{title}}", escapeHtml(path.basename(file)));

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/")
      return new Response(shell(), { headers: { "content-type": "text/html" } });
    if (pathname === "/app.css" || pathname === "/app.js")
      return new Response(Bun.file(path.join(web, pathname)));
    if (pathname === "/content")
      return new Response(await marked.parse(await Bun.file(file).text()), {
        headers: { "content-type": "text/html" },
      });
    if (pathname === "/reload") {
      notify();
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
    const asset = Bun.file(path.join(dir, decodeURIComponent(pathname)));
    return (await asset.exists()) ? new Response(asset) : new Response("404", { status: 404 });
  },
});

console.log(`PORT:${server.port}`);
