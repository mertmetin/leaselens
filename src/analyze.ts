// Split a lease into clauses and run every rule over each one.
import { RULES, type Rule, type Severity } from "./rules";

export interface Clause {
  /** 1-based paragraph number in the pasted text. */
  paragraph: number;
  text: string;
}

export interface Finding {
  rule: Rule;
  clause: Clause;
  start: number;
  end: number;
}

export interface Report {
  clauses: Clause[];
  findings: Finding[];
  counts: Record<Severity, number>;
}

/**
 * Paragraphs first (blank lines or numbered items), then sentences, so a
 * finding points at the sentence that triggered it rather than a whole page.
 */
export function splitClauses(text: string): Clause[] {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n|\n(?=\s*(?:\d{1,3}[.)]|\(?[a-z]\)|[•\-*])\s)/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  const clauses: Clause[] = [];
  paragraphs.forEach((p, i) => {
    // Split after . ! ? when the next sentence starts with a capital, digit or
    // bracket, then glue lone numbering ("1.", "a)", "12.3") back onto what follows.
    const parts = p.split(/(?<=[.!?])\s+(?=[A-Z0-9(“"])/).map((s) => s.trim()).filter(Boolean);
    const merged: string[] = [];
    for (const part of parts) {
      const prev = merged.at(-1);
      if (prev !== undefined && /^(\d{1,3}(\.\d{1,3})*|[a-z])[.)]?$/i.test(prev)) merged[merged.length - 1] = `${prev} ${part}`;
      else merged.push(part);
    }
    for (const text of merged) clauses.push({ paragraph: i + 1, text });
  });
  return clauses;
}

export function analyze(text: string, rules: Rule[] = RULES): Report {
  const clauses = splitClauses(text);
  const findings: Finding[] = [];
  for (const clause of clauses) {
    const seen = new Set<string>();
    for (const rule of rules) {
      const hit = rule.match(clause.text);
      if (!hit || seen.has(rule.id)) continue;
      seen.add(rule.id);
      findings.push({ rule, clause, start: hit.start, end: hit.end });
    }
  }
  // A clause flagged as a problem shouldn't also show a green "allowed" note
  // for the same topic (e.g. a too-large deposit described as "last month's rent").
  const flagged = new Set(findings.filter((f) => f.rule.severity !== "ok").map((f) => f.clause));
  const kept = findings.filter((f) => f.rule.severity !== "ok" || !flagged.has(f.clause));

  const counts: Record<Severity, number> = { void: 0, check: 0, ok: 0 };
  for (const f of kept) counts[f.rule.severity] += 1;
  return { clauses, findings: kept, counts };
}
