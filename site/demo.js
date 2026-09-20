/**
 * Static replay of a real `edgemirror pitch-demo` session
 * (local workerd + Cloudflare preview verified, labeled divergence).
 */
const LINES = [
  { text: "$ edgemirror pitch-demo", cls: "cmd", delay: 0 },
  { text: "", delay: 120 },
  { text: "═══ EdgeMirror pitch-demo ═══", delay: 80 },
  {
    text: "Isolated Worker · real local workerd · optional Cloudflare preview",
    cls: "dim",
    delay: 60,
  },
  { text: "", delay: 80 },
  { text: "1/5  Preparing local workerd…", delay: 220 },
  { text: "2/5  Executing local request…", delay: 180 },
  {
    text: "3/5  Cloudflare auth: wrangler OAuth config detected",
    delay: 160,
  },
  { text: "4/5  Attempting Cloudflare preview…", delay: 280 },
  { text: "5/5  Report", delay: 140 },
  { text: "", delay: 100 },
  { text: "Checks", delay: 60 },
  { text: "  [VERIFIED]  Local workerd", cls: "ok", delay: 100 },
  {
    text: "  [VERIFIED]  Cloudflare preview — edgemirror-tmp-*.workers.dev",
    cls: "ok",
    delay: 120,
  },
  { text: "", delay: 80 },
  { text: "Parity results", delay: 60 },
  {
    text: "  [DIVERGENT]  EM-DEMO-PITCH-001  POSSIBLE_RUNTIME_DIVERGENCE",
    cls: "div",
    delay: 140,
  },
  {
    text: '      Δ http.body: local="pitch-local-ok" remote="pitch-remote-divergent"',
    cls: "dim",
    delay: 100,
  },
  { text: "", delay: 80 },
  {
    text: "Elapsed ~7s · evidence written · throwaway Worker cleaned up",
    cls: "dim",
    delay: 120,
  },
];

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function play() {
  const out = document.getElementById("term-out");
  if (!out) return;

  if (reduceMotion()) {
    out.innerHTML = LINES.map((line) => {
      const cls = line.cls ? ` class="${line.cls}"` : "";
      return `<span${cls}>${escapeHtml(line.text)}</span>`;
    }).join("\n");
    return;
  }

  out.textContent = "";
  for (const line of LINES) {
    await wait(line.delay ?? 80);
    const span = document.createElement("span");
    if (line.cls) span.className = line.cls;
    span.textContent = line.text;
    out.appendChild(span);
    out.appendChild(document.createTextNode("\n"));
    out.parentElement?.scrollTo({ top: out.parentElement.scrollHeight });
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const io = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        play();
        io.disconnect();
        break;
      }
    }
  },
  { threshold: 0.35 },
);

const terminal = document.getElementById("terminal");
if (terminal) io.observe(terminal);
else play();
