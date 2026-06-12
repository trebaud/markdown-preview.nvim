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

const shell = () => `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${path.basename(file)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>
<style>
:root {
  color-scheme: light dark;
  --bg: light-dark(oklch(98.5% 0.004 80), oklch(20% 0.012 260));
  --fg: light-dark(oklch(26% 0.015 260), oklch(88% 0.01 260));
  --muted: light-dark(oklch(52% 0.015 260), oklch(66% 0.015 260));
  --line: light-dark(oklch(91% 0.008 260), oklch(30% 0.015 260));
  --surface: light-dark(oklch(96.3% 0.006 80), oklch(24.5% 0.012 260));
  --accent: light-dark(oklch(50% 0.16 258), oklch(74% 0.13 258));
  --tok-key: light-dark(oklch(48% 0.13 305), oklch(76% 0.12 305));
  --tok-str: light-dark(oklch(48% 0.13 150), oklch(76% 0.12 150));
  --tok-num: light-dark(oklch(48% 0.13 75), oklch(76% 0.12 75));
  --tok-fn: light-dark(oklch(48% 0.13 258), oklch(76% 0.12 258));
}
[data-theme="light"] { color-scheme: light }
[data-theme="dark"] { color-scheme: dark }
* { box-sizing: border-box }
::selection { background: color-mix(in oklch, var(--accent) 22%, transparent) }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font: 16px/1.7 ui-sans-serif, -apple-system, "Inter", system-ui, sans-serif;
  font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased;
}
main { max-width: 70ch; margin: 0 auto; padding: clamp(2rem, 6vw, 4.5rem) 1.5rem 6rem }
html { scroll-behavior: smooth }
h1, h2, h3, h4 { line-height: 1.25; letter-spacing: -0.02em; margin: 2.2em 0 0.6em; text-wrap: balance; scroll-margin-top: 1.5rem }
h1 { font-size: clamp(1.9rem, 4vw, 2.4rem); margin-top: 0; padding-bottom: 0.4em; border-bottom: 1px solid var(--line) }
h2 { font-size: clamp(1.4rem, 3vw, 1.6rem) }
h3 { font-size: 1.2rem }
p, ul, ol { margin: 0.9em 0 }
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 3px }
a:hover { text-decoration-thickness: 2px }
strong { font-weight: 650 }
li { margin: 0.3em 0 }
li::marker { color: var(--muted) }
input[type="checkbox"] { accent-color: var(--accent); margin-right: 0.45em }
li:has(> input:checked) { color: var(--muted); text-decoration: line-through oklch(from var(--muted) l c h / 0.5) }
blockquote {
  margin: 1.2em 0; padding: 0.1em 1.2em; color: var(--muted);
  border-left: 3px solid var(--accent);
  background: color-mix(in oklch, var(--accent) 5%, transparent); border-radius: 0 8px 8px 0;
}
code { font: 0.875em/1.65 ui-monospace, "SF Mono", "JetBrains Mono", monospace }
:not(pre) > code { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 0.1em 0.4em }
pre { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 1rem 1.2rem; overflow-x: auto }
pre code { background: none; border: 0; padding: 0 }
table { border-collapse: collapse; width: 100%; margin: 1.2em 0; font-size: 0.95em }
th { text-align: left; font-weight: 600; color: var(--muted); font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em }
th, td { padding: 0.55em 0.9em; border-bottom: 1px solid var(--line) }
tbody tr:hover { background: color-mix(in oklch, var(--surface) 60%, transparent) }
img { max-width: 100%; border-radius: 10px; box-shadow: 0 1px 2px oklch(0% 0 0 / 0.08), 0 4px 16px oklch(0% 0 0 / 0.06) }
hr { border: 0; border-top: 1px solid var(--line); margin: 2.5em 0 }
.hljs-keyword, .hljs-built_in, .hljs-type, .hljs-meta { color: var(--tok-key) }
.hljs-string, .hljs-regexp, .hljs-attr { color: var(--tok-str) }
.hljs-number, .hljs-literal, .hljs-symbol { color: var(--tok-num) }
.hljs-title, .hljs-function, .hljs-name, .hljs-section { color: var(--tok-fn) }
.hljs-comment { color: var(--muted); font-style: italic }
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 150ms }
#theme {
  position: fixed; top: 1rem; right: 1rem; width: 38px; height: 38px;
  display: grid; place-items: center; cursor: pointer;
  background: var(--surface); color: var(--muted);
  border: 1px solid var(--line); border-radius: 50%;
  transition: color 150ms, box-shadow 150ms, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
#theme:hover { color: var(--accent); transform: scale(1.08); box-shadow: 0 2px 10px oklch(0% 0 0 / 0.12) }
#theme:active { transform: scale(0.94) }
#theme .moon { display: none }
[data-theme="dark"] #theme .sun { display: none }
[data-theme="dark"] #theme .moon { display: block }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) #theme .sun { display: none }
  :root:not([data-theme]) #theme .moon { display: block }
}
</style>
</head>
<body>
<button id="theme" aria-label="Toggle theme">
<svg class="sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"/></svg>
<svg class="moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
</button>
<main id="content"></main>
<script>
const root = document.documentElement;
if (localStorage.theme) root.dataset.theme = localStorage.theme;
document.getElementById("theme").onclick = () => {
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  const swap = () => { root.dataset.theme = localStorage.theme = next; };
  document.startViewTransition ? document.startViewTransition(swap) : swap();
};
let firstRender = true;
async function refresh() {
  const html = await (await fetch("/content")).text();
  const swap = () => {
    document.getElementById("content").innerHTML = html;
    hljs.highlightAll();
    if (firstRender && location.hash) {
      firstRender = false;
      document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    }
    firstRender = false;
  };
  document.startViewTransition ? document.startViewTransition(swap) : swap();
}
new EventSource("/events").onmessage = refresh;
refresh();
</script>
</body>
</html>`;

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/")
      return new Response(shell(), { headers: { "content-type": "text/html" } });
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
