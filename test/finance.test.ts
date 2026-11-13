import { describe, expect, it } from "vitest";
import { bracketTax, landTransferTax, mortgagePayment } from "../src/finance";

describe("Ontario land transfer tax", () => {
  // Worked by hand from the official brackets:
  //   55,000 × 0.5% = 275; 195,000 × 1% = 1,950; 150,000 × 1.5% = 2,250
  it.each([
    [55_000, 275],
    [250_000, 2_225],
    [400_000, 4_475],
    [500_000, 6_475], // + 100,000 × 2%
    [2_000_000, 36_475], // + 1,600,000 × 2%
    [2_500_000, 48_975], // + 500,000 × 2.5% (one or two single-family residences)
  ])("price %i → %i", (price, tax) => {
    expect(landTransferTax({ price }).provincialTax).toBe(tax);
  });

  it("charges 2% above $2M when the land isn't one or two single-family homes", () => {
    expect(landTransferTax({ price: 2_500_000, singleFamily: false }).provincialTax).toBe(46_475);
  });

  it("first-time buyers pay nothing up to about $368,000 (the $4,000 refund)", () => {
    // Ontario rounds this to "$368,000"; the exact tax there is $3,995, fully refunded.
    const at368 = landTransferTax({ price: 368_000, firstTimeBuyerShare: 1 });
    expect(at368.provincialTax).toBe(3_995);
    expect(at368.provincialRefund).toBe(3_995);
    expect(at368.total).toBe(0);
    // Above the zero point, the refund caps at $4,000.
    const at600 = landTransferTax({ price: 600_000, firstTimeBuyerShare: 1 });
    expect(at600.provincialRefund).toBe(4_000);
    expect(at600.total).toBe(at600.provincialTax - 4_000);
    expect(bracketTax(368_333.33, [{ upTo: 55_000, rate: 0.005 }, { upTo: 250_000, rate: 0.01 }, { upTo: Infinity, rate: 0.015 }])).toBe(4_000);
  });

  it("refund is proportional to the first-time buyers' share", () => {
    expect(landTransferTax({ price: 600_000, firstTimeBuyerShare: 0.5 }).provincialRefund).toBe(2_000);
  });
});

describe("Toronto municipal land transfer tax", () => {
  it("matches the provincial tax below $2M and adds the rebate", () => {
    const r = landTransferTax({ price: 800_000, toronto: true, firstTimeBuyerShare: 1 });
    expect(r.municipalTax).toBe(r.provincialTax);
    expect(r.municipalRebate).toBe(4_475);
    expect(r.total).toBe(r.provincialTax - 4_000 + r.municipalTax - 4_475);
  });

  it("uses the graduated luxury rates from April 1, 2026", () => {
    // to $2M: 36,475; $2–3M at 2.5%: 25,000; $3–4M at 4.40%: 44,000; $4–5M at 5.45%: 54,500
    expect(landTransferTax({ price: 5_000_000, toronto: true }).municipalTax).toBe(159_975);
  });

  it("caps non-single-family properties at 2%", () => {
    expect(landTransferTax({ price: 5_000_000, toronto: true, singleFamily: false }).municipalTax).toBe(96_475);
  });

  it("adds 25% NRST and 10% MNRST for foreign buyers", () => {
    expect(landTransferTax({ price: 1_000_000, toronto: true, foreignBuyer: true }).nonResidentTax).toBe(350_000);
  });

  it("rejects nonsense", () => {
    expect(() => landTransferTax({ price: -1 })).toThrow(RangeError);
  });
});

describe("mortgage payments (semi-annual compounding)", () => {
  it("$500,000 at 5% over 25 years is about $2,908 a month", () => {
    const r = mortgagePayment({ principal: 500_000, annualRate: 0.05, amortizationYears: 25 });
    expect(r.payment).toBeCloseTo(2908.02, 0);
    expect(r.totalPayments).toBe(300);
    expect(r.totalInterest).toBeCloseTo(2908.02 * 300 - 500_000, -2);
  });

  it("is lower than a naive rate/12 calculation", () => {
    const naiveI = 0.05 / 12;
    const naive = (500_000 * naiveI) / (1 - (1 + naiveI) ** -300);
    expect(mortgagePayment({ principal: 500_000, annualRate: 0.05, amortizationYears: 25 }).payment).toBeLessThan(naive);
  });

  it("accelerated bi-weekly is half the monthly payment and pays off years sooner", () => {
    const monthly = mortgagePayment({ principal: 500_000, annualRate: 0.05, amortizationYears: 25 });
    const acc = mortgagePayment({ principal: 500_000, annualRate: 0.05, amortizationYears: 25, frequency: "accelerated bi-weekly" });
    expect(acc.payment).toBeCloseTo(monthly.payment / 2, 1);
    expect(acc.payoffYears).toBeLessThan(23);
    expect(acc.totalInterest).toBeLessThan(monthly.totalInterest);
  });

  it("handles a 0% rate", () => {
    expect(mortgagePayment({ principal: 120_000, annualRate: 0, amortizationYears: 10 }).payment).toBe(1000);
  });
});
