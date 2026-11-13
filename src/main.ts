import { analyze, type Finding } from "./analyze";
import { EXAMPLE_LEASE } from "./example";
import { SEVERITY_ORDER, type Severity } from "./rules";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lease = $<HTMLTextAreaElement>("lease");
const summary = $("summary");
const findingsList = $("findings");
const empty = $("empty");

const LABELS: Record<Severity, { title: string; badge: string }> = {
  void: { title: "Likely void", badge: "Void" },
  check: { title: "Worth checking", badge: "Check" },
  ok: { title: "Allowed", badge: "Allowed" },
};

// Everything is built with DOM nodes and textContent, never innerHTML, so
// pasted text can't inject markup into the page.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function quote(f: Finding): HTMLElement {
  const { text } = f.clause;
  return el(
    "blockquote",
    { className: "clause" },
    text.slice(0, f.start),
    el("mark", { className: f.rule.severity }, text.slice(f.start, f.end)),
    text.slice(f.end),
  );
}

function card(f: Finding): HTMLElement {
  const law = el("p", { className: "law" });
  f.rule.law.forEach((c, i) => {
    if (i) law.append(" · ");
    law.append(el("a", { href: c.url, target: "_blank", rel: "noopener" }, c.label));
  });
  return el(
    "li",
    { className: `finding ${f.rule.severity}` },
    el(
      "div",
      { className: "finding-head" },
      el("span", { className: `badge ${f.rule.severity}` }, LABELS[f.rule.severity].badge),
      el("h3", {}, f.rule.title),
      el("span", { className: "para" }, `¶ ${f.clause.paragraph}`),
    ),
    quote(f),
    el("p", { className: "why" }, f.rule.explanation),
    law,
  );
}

function render(): void {
  const text = lease.value.trim();
  findingsList.replaceChildren();
  summary.replaceChildren();
  empty.hidden = Boolean(text);
  if (!text) return;

  const report = analyze(text);
  const sorted = [...report.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.rule.severity) - SEVERITY_ORDER.indexOf(b.rule.severity) || a.clause.paragraph - b.clause.paragraph,
  );

  for (const sev of SEVERITY_ORDER) {
    summary.append(
      el("div", { className: `stat ${sev}` }, el("strong", {}, String(report.counts[sev])), el("span", {}, LABELS[sev].title)),
    );
  }
  if (!sorted.length) {
    findingsList.append(
      el("li", { className: "nothing" }, "No common problem clauses found. That’s a good sign, but LeaseLens can’t catch everything."),
    );
  }
  sorted.forEach((f) => findingsList.append(card(f)));
}

let timer: number | undefined;
lease.addEventListener("input", () => {
  window.clearTimeout(timer);
  timer = window.setTimeout(render, 150);
});
$("example").addEventListener("click", () => {
  lease.value = EXAMPLE_LEASE;
  render();
  lease.focus();
});
$("clear").addEventListener("click", () => {
  lease.value = "";
  render();
  lease.focus();
});

render();
