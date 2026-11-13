// LeaseLens as an MCP server: the same rules engine as the website, exposed
// as tools an AI agent (Claude Code, Claude Desktop, any MCP client) can call.
// Everything runs locally; no tool makes a network request.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyze } from "../analyze";
import { landTransferTax, mortgagePayment } from "../finance";
import { RULES } from "../rules";

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data as Record<string, unknown>,
});

const READ_ONLY = { readOnlyHint: true, openWorldHint: false, idempotentHint: true } as const;

export function createServer(version = "1.0.0"): McpServer {
  const server = new McpServer(
    { name: "leaselens", version },
    {
      instructions:
        "Tools for Ontario, Canada residential tenancies and home buying. check_lease flags lease clauses that the " +
        "Residential Tenancies Act makes void, with citations. Results are informational, not legal or financial advice; " +
        "say so when relaying them, and point people to the Landlord and Tenant Board or a legal clinic for their situation.",
    },
  );

  server.registerTool(
    "check_lease",
    {
      title: "Check an Ontario lease",
      description:
        "Scan the text of an Ontario residential lease (or its additional terms) for clauses the Residential Tenancies " +
        "Act makes void, such as no-pets rules, damage deposits, late fees, required post-dated cheques, guest limits, " +
        "entry without notice and early rent increases. Returns each finding with the quoted clause, a plain-English " +
        "explanation and the section of the law.",
      inputSchema: {
        text: z.string().min(1).max(200_000).describe("The lease text, or the part to check"),
        include_allowed: z.boolean().default(false).describe("Also list common clauses that are allowed"),
      },
      annotations: READ_ONLY,
    },
    async ({ text, include_allowed }) => {
      const report = analyze(text);
      const findings = report.findings
        .filter((f) => include_allowed || f.rule.severity !== "ok")
        .map((f) => ({
          rule: f.rule.id,
          severity: f.rule.severity,
          title: f.rule.title,
          paragraph: f.clause.paragraph,
          clause: f.clause.text,
          matched: f.clause.text.slice(f.start, f.end),
          explanation: f.rule.explanation,
          law: f.rule.law.map((c) => c.label),
        }));
      return json({
        summary: { void: report.counts.void, check: report.counts.check, allowed: report.counts.ok },
        findings,
        disclaimer: "Pattern-based check of common clauses; not legal advice and may miss things.",
      });
    },
  );

  server.registerTool(
    "list_rules",
    {
      title: "List LeaseLens rules",
      description: "List every clause type LeaseLens checks, with its severity and the law behind it.",
      annotations: READ_ONLY,
    },
    async () =>
      json({
        rules: RULES.map((r) => ({ id: r.id, severity: r.severity, title: r.title, law: r.law.map((c) => c.label) })),
      }),
  );

  server.registerTool(
    "explain_rule",
    {
      title: "Explain a LeaseLens rule",
      description: "Explain one rule in plain English, with citations and links to the official text.",
      inputSchema: {
        id: z.enum(RULES.map((r) => r.id) as [string, ...string[]]).describe("Rule id from list_rules"),
      },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const r = RULES.find((x) => x.id === id)!;
      return json({ id: r.id, severity: r.severity, title: r.title, explanation: r.explanation, law: r.law });
    },
  );

  server.registerTool(
    "ontario_land_transfer_tax",
    {
      title: "Ontario land transfer tax",
      description:
        "Estimate Ontario land transfer tax for a purchase, with Toronto's municipal tax (graduated rates from April 1, " +
        "2026), first-time buyer refunds (Ontario up to $4,000, Toronto up to $4,475) and non-resident speculation taxes.",
      inputSchema: {
        price: z.number().nonnegative().describe("Purchase price in Canadian dollars"),
        toronto: z.boolean().default(false).describe("Property is in the City of Toronto"),
        single_family: z
          .boolean()
          .default(true)
          .describe("Land has one or two single-family residences (a typical house or condo unit)"),
        first_time_buyer_share: z
          .number()
          .min(0)
          .max(1)
          .default(0)
          .describe("Share of ownership held by qualifying first-time buyers (1 = all buyers)"),
        foreign_buyer: z.boolean().default(false).describe("Buyer is a foreign national or foreign corporation"),
      },
      annotations: READ_ONLY,
    },
    async (a) =>
      json(
        landTransferTax({
          price: a.price,
          toronto: a.toronto,
          singleFamily: a.single_family,
          firstTimeBuyerShare: a.first_time_buyer_share,
          foreignBuyer: a.foreign_buyer,
        }),
      ),
  );

  server.registerTool(
    "mortgage_payment",
    {
      title: "Canadian mortgage payment",
      description:
        "Calculate a fixed-rate Canadian mortgage payment (semi-annual compounding), total interest and payoff time, " +
        "for monthly, bi-weekly, weekly or accelerated schedules.",
      inputSchema: {
        principal: z.number().positive().describe("Amount borrowed, in dollars"),
        annual_rate_percent: z.number().min(0).max(30).describe("Nominal annual interest rate, e.g. 4.79"),
        amortization_years: z.number().positive().max(40).default(25),
        frequency: z
          .enum(["monthly", "semi-monthly", "bi-weekly", "weekly", "accelerated bi-weekly", "accelerated weekly"])
          .default("monthly"),
      },
      annotations: READ_ONLY,
    },
    async (a) =>
      json(
        mortgagePayment({
          principal: a.principal,
          annualRate: a.annual_rate_percent / 100,
          amortizationYears: a.amortization_years,
          frequency: a.frequency,
        }),
      ),
  );

  return server;
}
