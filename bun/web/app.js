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
const content = document.getElementById("content");
const home = content.dataset.home || "";

// The page currently shown, as a path relative to the previewed file's dir.
// The browser URL is the source of truth so reload / back / forward all work.
function currentPath() {
  const p = decodeURIComponent(location.pathname);
  return p === "/" ? home : p.replace(/^\//, "");
}

async function load(scroll) {
  const path = currentPath();
  const html = await (await fetch("/content?path=" + encodeURIComponent(path))).text();
  const swap = () => {
    content.innerHTML = html;
    hljs.highlightAll();
    if (scroll) {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id) document.getElementById(id)?.scrollIntoView();
      else scrollTo(0, 0);
    }
  };
  document.startViewTransition ? document.startViewTransition(swap) : swap();
  // re-run an in-progress search against the freshly rendered content
  if (searchOpen) requestAnimationFrame(() => runSearch(input.value));
  document.title = path.split("/").pop() || "preview";
}

// Only refresh when the file that changed is the one we're looking at
// ("*" is a forced reload pinged by Neovim on save).
new EventSource("/events").onmessage = (e) => {
  if (e.data === "*" || e.data === currentPath()) load(false);
};

// Follow links to other markdown pages inside the preview; leave external links
// and non-markdown files (images, raw text, …) to the browser's default.
content.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest("a") : null;
  if (!a) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  if (!/\.(md|markdown)$/i.test(url.pathname)) return;
  e.preventDefault();
  if (url.pathname === location.pathname) {
    const id = decodeURIComponent(url.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
    return;
  }
  history.pushState(null, "", url.pathname + url.hash);
  load(true);
});
addEventListener("popstate", () => load(true));

/* ---- vim-style navigation ---- */
const LINE = 64;
let pendingG = 0;
const typing = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    openSearch();
    return;
  }
  if (searchOpen || typing(e.target) || e.metaKey || e.altKey) return;
  // Allow Ctrl-d / Ctrl-u for half-page scrolling, but keep other Ctrl shortcuts working.
  if (e.ctrlKey && e.key !== "d" && e.key !== "u") return;
  if (e.key === "/") { e.preventDefault(); openSearch(); return; }
  let handled = true;
  switch (e.key) {
    case "j": scrollBy({ top: LINE }); break;
    case "k": scrollBy({ top: -LINE }); break;
    case "l": scrollBy({ left: LINE }); break;
    case "h": scrollBy({ left: -LINE }); break;
    case "d": if (!e.ctrlKey) { handled = false; break; } scrollBy({ top: innerHeight / 2 }); break;
    case "u": if (!e.ctrlKey) { handled = false; break; } scrollBy({ top: -innerHeight / 2 }); break;
    case "G": scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); break;
    case "g":
      if (pendingG) { scrollTo({ top: 0, behavior: "smooth" }); pendingG = 0; }
      else { pendingG = 1; setTimeout(() => (pendingG = 0), 400); }
      break;
    default: handled = false;
  }
  if (handled) e.preventDefault();
});

/* ---- live search ---- */
const overlay = document.getElementById("search");
const input = document.getElementById("search-input");
const resultsEl = document.getElementById("search-results");
const countEl = document.getElementById("search-count");
let searchOpen = false;
let hits = [];
let active = -1;

function openSearch() {
  searchOpen = true;
  overlay.classList.add("open");
  input.focus();
  input.select();
  runSearch(input.value);
}
function closeSearch(keep) {
  searchOpen = false;
  overlay.classList.remove("open");
  input.blur();
  clearHits(keep);
}
function unwrap(m) {
  const p = m.parentNode;
  if (!p) return;
  p.replaceChild(document.createTextNode(m.textContent), m);
  p.normalize();
}
function clearHits(keep) {
  for (const m of content.querySelectorAll("mark.search-hit")) {
    if (m === keep) continue;
    unwrap(m);
  }
  hits = [];
  active = -1;
}
function blockOf(el) {
  let e = el.parentElement;
  while (e && e !== content && getComputedStyle(e).display === "inline") e = e.parentElement;
  return e || content;
}
function runSearch(q) {
  clearHits();
  resultsEl.innerHTML = "";
  q = q.trim();
  if (!q) { countEl.textContent = ""; return; }
  const needle = q.toLowerCase();
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const todo = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode())
    if (n.nodeValue.toLowerCase().includes(needle)) todo.push(n);
  for (const node of todo) {
    const text = node.nodeValue;
    const low = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let last = 0, pos;
    while ((pos = low.indexOf(needle, last)) !== -1) {
      if (pos > last) frag.appendChild(document.createTextNode(text.slice(last, pos)));
      const mark = document.createElement("mark");
      mark.className = "search-hit";
      mark.textContent = text.slice(pos, pos + q.length);
      frag.appendChild(mark);
      hits.push(mark);
      last = pos + q.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  countEl.textContent = hits.length ? hits.length + (hits.length === 1 ? " match" : " matches") : "no matches";
  if (!hits.length) {
    resultsEl.innerHTML = '<div class="search-empty">No matches found</div>';
    return;
  }
  hits.forEach((mark, i) => {
    const full = blockOf(mark).textContent.replace(/\s+/g, " ").trim();
    const at = full.toLowerCase().indexOf(needle);
    const start = Math.max(0, at - 32);
    const row = document.createElement("div");
    row.className = "search-result";
    row.append(document.createTextNode((start > 0 ? "…" : "") + full.slice(start, at)));
    const hl = document.createElement("mark");
    hl.textContent = full.slice(at, at + q.length);
    row.append(hl, document.createTextNode(full.slice(at + q.length)));
    row.onclick = () => { setActive(i); commit(); };
    resultsEl.appendChild(row);
  });
  setActive(0, false);
}
function setActive(i, scrollPage = true) {
  if (!hits.length) return;
  active = (i + hits.length) % hits.length;
  hits.forEach((m, j) => m.classList.toggle("active", j === active));
  const rows = resultsEl.children;
  for (let j = 0; j < rows.length; j++) rows[j].classList.toggle("active", j === active);
  countEl.textContent = active + 1 + " / " + hits.length;
  rows[active]?.scrollIntoView({ block: "nearest" });
  if (scrollPage) hits[active].scrollIntoView({ block: "center", behavior: "smooth" });
}
function commit() {
  if (active < 0) return closeSearch();
  const mark = hits[active];
  mark.classList.remove("active");
  mark.classList.add("pulse");
  setTimeout(() => unwrap(mark), 1800);
  closeSearch(mark);
  mark.scrollIntoView({ block: "center", behavior: "smooth" });
}
input.addEventListener("input", () => runSearch(input.value));
input.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Escape": e.preventDefault(); closeSearch(); break;
    case "Enter": e.preventDefault(); commit(); break;
    case "ArrowDown": e.preventDefault(); setActive(active + 1); break;
    case "ArrowUp": e.preventDefault(); setActive(active - 1); break;
    case "n": if (e.ctrlKey) { e.preventDefault(); setActive(active + 1); } break;
    case "p": if (e.ctrlKey) { e.preventDefault(); setActive(active - 1); } break;
    case "Tab": e.preventDefault(); setActive(active + (e.shiftKey ? -1 : 1)); break;
  }
});
overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeSearch(); });

load(true);
