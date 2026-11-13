// End to end through a real MCP client, over an in-memory transport.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/mcp/server";

let client: Client;

beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverSide);
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientSide);
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const res = await client.callTool({ name, arguments: args });
  expect(res.isError ?? false).toBe(false);
  return res.structuredContent as Record<string, any>;
}

describe("leaselens MCP server", () => {
  it("lists its tools, all read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "check_lease", "explain_rule", "list_rules", "mortgage_payment", "ontario_land_transfer_tax",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it("check_lease flags void clauses with citations", async () => {
    const r = await call("check_lease", { text: "1. No pets allowed.\n\n2. A late fee of $50 applies." });
    expect(r.summary.void).toBe(2);
    expect(r.findings.map((f: any) => f.rule)).toEqual(["no-pets", "late-fee"]);
    expect(r.findings[0].law).toContain("RTA s. 14");
    expect(r.findings[0].matched).toBe("No pets");
  });

  it("check_lease hides allowed clauses unless asked", async () => {
    const text = "No smoking is permitted in the unit.";
    expect((await call("check_lease", { text })).findings).toHaveLength(0);
    expect((await call("check_lease", { text, include_allowed: true })).findings[0].rule).toBe("smoking-ok");
  });

  it("explain_rule returns the explanation and links", async () => {
    const r = await call("explain_rule", { id: "post-dated-cheques" });
    expect(r.law[0].label).toBe("RTA s. 108");
    expect(r.law[0].url).toMatch(/^https:\/\/www\.ontario\.ca\/laws/);
  });

  it("explain_rule rejects unknown ids", async () => {
    const res = await client.callTool({ name: "explain_rule", arguments: { id: "nope" } });
    expect(res.isError).toBe(true);
  });

  it("land transfer tax for a Toronto first-time buyer", async () => {
    const r = await call("ontario_land_transfer_tax", { price: 800_000, toronto: true, first_time_buyer_share: 1 });
    expect(r.provincialTax).toBe(12_475);
    expect(r.total).toBe(12_475 - 4_000 + 12_475 - 4_475);
  });

  it("mortgage payment takes a percentage", async () => {
    const r = await call("mortgage_payment", { principal: 500_000, annual_rate_percent: 5 });
    expect(r.payment).toBeCloseTo(2908.02, 0);
  });
});
