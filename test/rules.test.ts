import { describe, expect, it } from "vitest";
import { analyze, splitClauses } from "../src/analyze";
import { RULES } from "../src/rules";

const ids = (text: string) => analyze(text).findings.map((f) => f.rule.id);

// For each rule: clauses that must be flagged, and similar ones that must not.
const CASES: Record<string, { flags: string[]; passes: string[] }> = {
  "no-pets": {
    flags: ["No pets are allowed in the unit.", "Pets are strictly prohibited.", "The Tenant shall not keep any animals."],
    passes: ["The tenant is responsible for any damage caused by a pet.", "Pet waste must be cleaned up promptly."],
  },
  "damage-deposit": {
    flags: ["A damage deposit of $500 is payable on signing.", "Tenant will pay a security deposit of $1,000.", "A pet deposit of $300 applies."],
    passes: ["Tenant will pay last month's rent as a rent deposit."],
  },
  "rent-deposit-too-high": {
    flags: ["Tenant shall pay the last two months of rent in advance.", "Two months' rent as a deposit is required."],
    passes: ["First and last month's rent is due on signing."],
  },
  "deposit-no-interest": {
    flags: ["The rent deposit will be held without interest.", "No interest will be paid on the deposit."],
    passes: ["Interest on the rent deposit is paid annually."],
  },
  "key-deposit-nonrefundable": {
    flags: ["A non-refundable key deposit of $100 is required."],
    passes: ["A refundable key deposit of $50 is required."],
  },
  "key-deposit": {
    flags: ["A refundable key deposit of $50 is required."],
    passes: ["The landlord will provide two keys."],
  },
  "post-dated-cheques": {
    flags: ["Tenant must provide 12 post-dated cheques.", "Rent shall be paid by pre-authorized debit."],
    passes: ["The tenant may pay by post-dated cheques if they wish.", "Rent is paid by e-transfer."],
  },
  "nsf-fee": {
    flags: ["A $50 fee applies to any NSF cheque.", "Returned cheques incur a charge of $35."],
    passes: [
      "A $20 administration charge applies to NSF cheques, plus bank charges.",
      // Regression: "returned" here is about a deposit, not a bounced cheque.
      "A damage deposit of $500 is payable on signing and will be returned at the end of the tenancy.",
    ],
  },
  "late-fee": {
    flags: ["A late fee of $50 applies after the 5th.", "Late rent incurs $10 per day.", "A penalty of $100 will be charged."],
    passes: ["Rent is due on the first day of each month."],
  },
  "other-fees": {
    flags: ["A $200 move-in fee is payable.", "An application fee of $50 is non-refundable.", "A cleaning fee will be charged on move-out."],
    passes: ["The tenant pays for electricity and internet."],
  },
  "no-guests": {
    flags: ["No overnight guests are permitted.", "Guests may not stay longer than three nights.", "Guests require written permission of the landlord."],
    passes: ["The tenant is responsible for the conduct of their guests."],
  },
  "entry-without-notice": {
    flags: ["The landlord may enter the unit at any time.", "The landlord may enter with 12 hours notice.", "Landlord may inspect without notice."],
    passes: [
      "The landlord may enter with 24 hours written notice between 8 a.m. and 8 p.m.",
      "The landlord may enter without notice in an emergency.",
    ],
  },
  "tenant-all-repairs": {
    flags: ["The tenant is responsible for all repairs and maintenance.", "The unit is rented as-is."],
    passes: ["The tenant is responsible for any damage caused by the tenant or their guests."],
  },
  "must-vacate-at-end": {
    flags: ["The tenant must vacate at the end of the term.", "This lease will automatically terminate at the end of the term without notice."],
    passes: ["The lease begins on September 1, 2026."],
  },
  "landlord-can-terminate": {
    flags: ["The landlord may terminate this lease with 30 days notice.", "The landlord reserves the right to end the tenancy at any time."],
    passes: ["The landlord may end the tenancy in accordance with the Residential Tenancies Act."],
  },
  acceleration: {
    flags: ["If rent is late, the entire remaining rent for the term becomes due immediately."],
    passes: ["Rent is payable monthly in advance."],
  },
  "rent-increase": {
    flags: ["The landlord may increase the rent at any time.", "Rent may increase every six months.", "The landlord will give 30 days notice of any rent increase."],
    passes: ["Rent increases will follow the Residential Tenancies Act with 90 days written notice."],
  },
  "no-sublet": {
    flags: ["Subletting is strictly prohibited.", "The tenant shall not sublet the unit."],
    passes: ["The tenant may sublet with the landlord's consent, which won't be unreasonably withheld."],
  },
  "no-assignment": {
    flags: ["The tenant shall not assign this lease."],
    passes: ["The landlord's address for notices is below."],
  },
  waiver: {
    flags: ["The tenant waives all rights under the Residential Tenancies Act.", "The tenant agrees not to apply to the Landlord and Tenant Board."],
    passes: ["Disputes may be brought to the Landlord and Tenant Board."],
  },
  discrimination: {
    flags: ["Adults only.", "No children allowed in the building."],
    passes: ["Children's toys must not be left in the hallway."],
  },
  "rent-deposit-ok": {
    flags: ["First and last month's rent is due on signing."],
    passes: ["Rent is $2,000 per month."],
  },
  "tenant-damage-ok": {
    flags: ["The tenant will pay for damage caused by the tenant's guests."],
    passes: ["Rent is $2,000 per month."],
  },
  "insurance-ok": { flags: ["The tenant must carry tenant insurance."], passes: ["Rent is $2,000 per month."] },
  "smoking-ok": { flags: ["No smoking is permitted in the unit."], passes: ["Rent is $2,000 per month."] },
  "cleanliness-ok": { flags: ["The tenant will keep the unit clean and tidy."], passes: ["Rent is $2,000 per month."] },
};

describe("every rule has examples", () => {
  it.each(RULES.map((r) => r.id))("%s", (id) => {
    expect(CASES[id], `add test cases for ${id}`).toBeDefined();
  });
});

describe.each(Object.entries(CASES))("%s", (id, { flags, passes }) => {
  it.each(flags)("flags: %s", (text) => {
    expect(ids(text)).toContain(id);
  });
  it.each(passes)("passes: %s", (text) => {
    expect(ids(text)).not.toContain(id);
  });
});

describe("every rule cites the law and explains itself", () => {
  it.each(RULES)("$id", (rule) => {
    expect(rule.law.length).toBeGreaterThan(0);
    expect(rule.law.every((c) => c.url.startsWith("https://"))).toBe(true);
    expect(rule.explanation.length).toBeGreaterThan(40);
  });
});

describe("splitting and reporting", () => {
  it("splits paragraphs and sentences", () => {
    const clauses = splitClauses("1. Rent is $2,000. It is due on the 1st.\n\n2. No pets.");
    expect(clauses.map((c) => [c.paragraph, c.text])).toEqual([
      [1, "1. Rent is $2,000."],
      [1, "It is due on the 1st."],
      [2, "2. No pets."],
    ]);
  });

  it("points at the matching words", () => {
    const [f] = analyze("The unit is lovely. No pets are allowed.").findings;
    expect(f.clause.text.slice(f.start, f.end)).toBe("No pets");
  });

  it("doesn't show an 'allowed' note on a clause that's also a problem", () => {
    const r = analyze("Tenant pays the last two months of rent as a rent deposit.");
    expect(r.findings.map((f) => f.rule.id)).toEqual(["rent-deposit-too-high"]);
  });

  it("counts by severity", () => {
    const r = analyze("No pets. A refundable key deposit of $50. No smoking is permitted.");
    expect(r.counts).toEqual({ void: 1, check: 1, ok: 1 });
  });
});
