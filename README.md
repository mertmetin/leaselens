# LeaseLens 🔍

[![CI](https://github.com/mertmetin/leaselens/actions/workflows/ci.yml/badge.svg)](https://github.com/mertmetin/leaselens/actions/workflows/ci.yml)

**Paste an Ontario residential lease and see which clauses the law says don't count.**

**Try it:** https://mertmetin.github.io/leaselens/

Landlords often add "additional terms" to Ontario's standard lease that the *Residential Tenancies Act* makes void: no pets, damage deposits, late fees, required post-dated cheques, guest limits, entry without notice and more. Tenants sign them anyway because they don't know. LeaseLens flags them in seconds, explains each one in plain English, and links to the exact section of the law.

🔒 **Your lease never leaves your browser.** There's no server. The page's Content-Security-Policy sets `connect-src 'none'`, so the browser itself blocks any network request the page might try to make.

## What it checks

| Clause | Result | Law |
|---|---|---|
| "No pets" | Void | RTA s. 14 |
| Damage, security, pet or cleaning deposit | Void | RTA s. 105 (1) |
| Rent deposit over one month's rent | Void | RTA s. 106 (2) |
| No interest on the rent deposit | Void | RTA s. 106 (6) |
| Required post-dated cheques or automatic payments | Void | RTA s. 108 |
| Late fees and penalties | Void | RTA s. 134 (1) |
| Application, admin, move-in/out, cleaning or guest fees | Void | RTA s. 134 (1) |
| NSF fee above $20 plus the bank's charge | Void | O. Reg. 516/06 s. 17 |
| Non-refundable key deposit | Void | RTA s. 134 (1), O. Reg. 516/06 s. 17 |
| Key deposit (refundable) | Check: must not exceed replacement cost | O. Reg. 516/06 s. 17 |
| Bans or limits on guests | Void | Standard lease guide s. 15, RTA s. 4 |
| Landlord entry without 24 hours' written notice (8 a.m.–8 p.m.) | Void | RTA s. 27 |
| Tenant pays for all repairs, or "rented as is" | Void | RTA s. 20 |
| Tenant must move out when the term ends | Void | RTA s. 37, s. 38 |
| Landlord can end the tenancy at will | Void | RTA s. 37 |
| All remaining rent due on default ("acceleration clause") | Void | RTA s. 15 |
| Rent increases more often than every 12 months or with under 90 days' notice | Void | RTA s. 116, s. 119 |
| Blanket ban on subletting | Void | RTA s. 97 (2) |
| Ban on assigning the lease | Check | RTA s. 95 |
| Tenant waives rights under the Act | Void | RTA s. 4 (1) |
| "Adults only", "no children" and similar | Void | Ontario Human Rights Code |

It also recognises common clauses that **are** allowed (last month's rent deposit, tenant insurance, smoking rules, paying for damage the tenant causes, ordinary cleanliness), so the results aren't just red flags.

Every section reference was checked against the official text on [e-Laws](https://www.ontario.ca/laws/statute/06r17) (current to November 10, 2026), the [general regulation](https://www.ontario.ca/laws/regulation/060516), and Ontario's [guide to the standard lease](https://www.ontario.ca/page/guide-ontarios-standard-lease).

## Use it from Claude (MCP server)

The same rules engine also runs as a [Model Context Protocol](https://modelcontextprotocol.io) server, so Claude Code, Claude Desktop or any MCP client can check a lease, or run Ontario home-buying numbers, mid-conversation. Everything still runs on your machine: no tool makes a network request.

| Tool | What it does |
|---|---|
| `check_lease` | Lease text in; every void or questionable clause out, with the quoted words, an explanation and the section of the law |
| `list_rules`, `explain_rule` | What LeaseLens checks, and the law behind each rule, with links to the official text |
| `ontario_land_transfer_tax` | Ontario tax plus Toronto's municipal tax (graduated rates from April 1, 2026), first-time buyer refunds (up to $4,000 and $4,475) and non-resident taxes |
| `mortgage_payment` | Canadian fixed-rate payment with semi-annual compounding: monthly, bi-weekly, weekly or accelerated, with total interest and payoff time |

**Claude Code**

```bash
claude mcp add leaselens -- npx -y github:mertmetin/leaselens
```

**Claude Desktop** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "leaselens": { "command": "npx", "args": ["-y", "github:mertmetin/leaselens"] }
  }
}
```

Or from a clone: `npm install && npm run build:mcp`, then point your client at `node /path/to/leaselens/dist-mcp/leaselens-mcp.js`.

Then ask things like *"Check this lease for anything my landlord can't enforce"* or *"What's the land transfer tax on an $850,000 condo in Toronto for a first-time buyer, and the monthly payment with 20% down at 4.5%?"*

Land transfer tax rates were checked against [Ontario's](https://www.ontario.ca/document/land-transfer-tax/calculating-land-transfer-tax) and [Toronto's](https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/municipal-land-transfer-tax-mltt-rates-and-fees/) official pages in November 2026.

## How it works

```
src/
  rules.ts      26 rules (21 problems, 5 allowed clauses): pattern, severity,
                plain-English explanation, citations
  analyze.ts    splits a lease into paragraphs and sentences, runs every rule
  main.ts       the page: paste, results, highlights (DOM only, no innerHTML)
  finance.ts    land transfer tax brackets and Canadian mortgage maths
  mcp/          the MCP server (official TypeScript SDK) and its stdio entry point
test/
  rules.test.ts   136 tests: for every rule, clauses that must be flagged
                  and similar ones that must not
  finance.test.ts tax brackets worked by hand from the official rates, mortgage maths
  mcp.test.ts     end to end through a real MCP client
```

Rules are deliberately transparent pattern matchers rather than a black-box model, so every flag can be traced to a rule and a section of the law. Each rule has guards against common false alarms. For example, "tenant pays for **all** repairs" is void, but "tenant pays for damage **they cause**" is allowed (s. 34), and "the deposit will be **returned**" isn't a bounced cheque.

TypeScript, Vite and Vitest; the website has no runtime dependencies, and the MCP server is bundled into a single file. GitHub Actions runs type-checking, 161 tests and both builds on every push, and deploys `main` to GitHub Pages.

## Run it

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npm run build   # static site in dist/
```

## Not legal advice

LeaseLens spots common problem clauses; it can miss things and can't weigh your specific situation (for example, some rules differ for condos, care homes, co-ops and other special tenancies). For help, contact the [Landlord and Tenant Board](https://tribunalsontario.ca/ltb/) or a community legal clinic through [Steps to Justice](https://stepstojustice.ca/).

## License

MIT © Mert Metin
