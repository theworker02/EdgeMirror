/**
 * Lightweight HTML builders for EdgeMirror UI primitives.
 * Prefer these for static dashboard / report HTML; keep evidence visible.
 */

import {
  STATUS_LABEL,
  statusClass,
  statusFromClassification,
  type EmStatus,
} from "./status.js";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderStatusBadge(status: EmStatus): string {
  return `<span class="${statusClass(status)}" role="status">${esc(STATUS_LABEL[status])}</span>`;
}

export function renderFindingCard(opts: {
  findingId: string;
  testId: string;
  classification: string;
  confidence: number;
  differences: Array<{ path: string; local: unknown; remote: unknown }>;
  demo?: boolean;
}): string {
  const status = opts.demo
    ? "DEMO"
    : statusFromClassification(opts.classification);
  const diffs = opts.differences
    .slice(0, 8)
    .map(
      (d) =>
        `<li><code>${esc(d.path)}</code> local=${esc(JSON.stringify(d.local))} remote=${esc(JSON.stringify(d.remote))}</li>`,
    )
    .join("");
  return `<article class="em-finding"${opts.demo ? ' data-demo="true"' : ""}>
  <div class="em-finding__head">
    <span class="em-finding__id">${esc(opts.findingId)}</span>
    <span>${renderStatusBadge(status)}</span>
  </div>
  <div class="em-finding__meta">test=${esc(opts.testId)} · classification=${esc(opts.classification)} · conf=${opts.confidence.toFixed(2)}</div>
  ${diffs ? `<ul class="em-finding__diffs">${diffs}</ul>` : ""}
</article>`;
}

export function renderMetric(label: string, value: string, hint?: string): string {
  return `<div class="em-metric">
  <div class="em-metric__label">${esc(label)}</div>
  <div class="em-metric__value">${esc(value)}</div>
  ${hint ? `<div class="em-metric__hint">${esc(hint)}</div>` : ""}
</div>`;
}

export function renderCompatibilityCell(
  state: "ok" | "fail" | "na",
  label: string,
): string {
  return `<span class="em-compat em-compat--${state}" title="${esc(label)}">${esc(label)}</span>`;
}

export function renderEvidencePanel(title: string, body: string): string {
  return `<section class="em-evidence">
  <h3 class="em-evidence__title">${esc(title)}</h3>
  <div class="em-evidence__body">${esc(body)}</div>
</section>`;
}

export function renderTraceDiff(local: string, remote: string): string {
  return `<div class="em-diff">
  <div class="em-diff__pane em-diff__pane--local"><div class="em-diff__label">Local</div>${esc(local)}</div>
  <div class="em-diff__pane em-diff__pane--remote"><div class="em-diff__label">Remote</div>${esc(remote)}</div>
</div>`;
}

export function renderCodeBlock(code: string): string {
  return `<pre class="em-code"><code>${esc(code)}</code></pre>`;
}

export function renderCommand(cmd: string): string {
  return `<code class="em-command">${esc(cmd)}</code>`;
}

export function renderRunTimeline(
  items: Array<{ at: string; label: string }>,
): string {
  const rows = items
    .map(
      (i) =>
        `<div class="em-timeline__item"><div class="em-timeline__time">${esc(i.at)}</div><div>${esc(i.label)}</div></div>`,
    )
    .join("");
  return `<div class="em-timeline">${rows}</div>`;
}

/** Visual stub only — does not imply Supercharger engine metrics. */
export function renderSuperchargerGauge(
  label: string,
  pct: number,
  note: string,
): string {
  const clamped = Math.max(0, Math.min(100, pct));
  return `<div class="em-gauge" style="--em-gauge-pct:${clamped}%">
  <div class="em-gauge__label"><span>${esc(label)}</span><span>${clamped}%</span></div>
  <div class="em-gauge__track"><div class="em-gauge__fill"></div></div>
  <div class="em-metric__hint">${esc(note)}</div>
</div>`;
}

export function renderDemoBanner(message: string): string {
  return `<div class="em-banner-demo" role="note">${esc(message)}</div>`;
}

export * from "./status.js";
