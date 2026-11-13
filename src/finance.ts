// Ontario home-buying maths: land transfer tax and mortgage payments.
//
// Rates checked against the official pages (November 2026):
//   Ontario LTT:  https://www.ontario.ca/document/land-transfer-tax/calculating-land-transfer-tax
//   Ontario first-time buyer refund (max $4,000, proportional to the
//                 first-time buyers' share):
//                 https://www.ontario.ca/document/land-transfer-tax/land-transfer-tax-refunds-first-time-homebuyers
//   Toronto MLTT (graduated rates from April 1, 2026), rebate up to $4,475:
//                 https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/
//   NRST 25% (Ontario), MNRST 10% (Toronto) for foreign buyers.

export interface Bracket {
  /** Upper bound of the bracket in dollars (Infinity for the last one). */
  upTo: number;
  rate: number;
}

const ONTARIO_BASE: Bracket[] = [
  { upTo: 55_000, rate: 0.005 },
  { upTo: 250_000, rate: 0.01 },
  { upTo: 400_000, rate: 0.015 },
  { upTo: Infinity, rate: 0.02 },
];
// Over $2M, 2.5% applies only to land with one or two single-family residences.
const ONTARIO_RESIDENTIAL: Bracket[] = [
  { upTo: 55_000, rate: 0.005 },
  { upTo: 250_000, rate: 0.01 },
  { upTo: 400_000, rate: 0.015 },
  { upTo: 2_000_000, rate: 0.02 },
  { upTo: Infinity, rate: 0.025 },
];
const TORONTO_RESIDENTIAL: Bracket[] = [
  { upTo: 55_000, rate: 0.005 },
  { upTo: 250_000, rate: 0.01 },
  { upTo: 400_000, rate: 0.015 },
  { upTo: 2_000_000, rate: 0.02 },
  { upTo: 3_000_000, rate: 0.025 },
  { upTo: 4_000_000, rate: 0.044 },
  { upTo: 5_000_000, rate: 0.0545 },
  { upTo: 10_000_000, rate: 0.065 },
  { upTo: 20_000_000, rate: 0.0755 },
  { upTo: Infinity, rate: 0.086 },
];
const TORONTO_OTHER = ONTARIO_BASE;

export const ONTARIO_FIRST_TIME_MAX = 4_000;
export const TORONTO_FIRST_TIME_MAX = 4_475;
export const ONTARIO_NRST = 0.25;
export const TORONTO_MNRST = 0.1;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function bracketTax(value: number, brackets: Bracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of brackets) {
    if (value <= lower) break;
    tax += (Math.min(value, upTo) - lower) * rate;
    lower = upTo;
  }
  return round2(tax);
}

export interface LandTransferInput {
  price: number;
  /** In the City of Toronto (adds the municipal land transfer tax). */
  toronto?: boolean;
  /** The land has one or two single-family residences (a typical home or condo). */
  singleFamily?: boolean;
  /** Share of ownership held by qualifying first-time buyers, 0 to 1. */
  firstTimeBuyerShare?: number;
  /** A foreign national, foreign corporation or taxable trustee is buying. */
  foreignBuyer?: boolean;
}

export interface LandTransferResult {
  provincialTax: number;
  provincialRefund: number;
  municipalTax: number;
  municipalRebate: number;
  nonResidentTax: number;
  total: number;
  notes: string[];
}

export function landTransferTax(input: LandTransferInput): LandTransferResult {
  const { price, toronto = false, singleFamily = true, foreignBuyer = false } = input;
  const share = Math.min(1, Math.max(0, input.firstTimeBuyerShare ?? 0));
  if (!(price >= 0) || !Number.isFinite(price)) throw new RangeError("price must be a non-negative number");

  const provincialTax = bracketTax(price, singleFamily ? ONTARIO_RESIDENTIAL : ONTARIO_BASE);
  const provincialRefund = round2(Math.min(provincialTax, ONTARIO_FIRST_TIME_MAX) * share);
  const municipalTax = toronto ? bracketTax(price, singleFamily ? TORONTO_RESIDENTIAL : TORONTO_OTHER) : 0;
  // Toronto's rebate is applied only when every buyer is a first-time buyer;
  // partial-ownership rules aren't modelled.
  const municipalRebate = toronto && share === 1 && singleFamily ? Math.min(municipalTax, TORONTO_FIRST_TIME_MAX) : 0;
  const nonResidentTax = foreignBuyer && singleFamily ? round2(price * (ONTARIO_NRST + (toronto ? TORONTO_MNRST : 0))) : 0;

  const notes = [
    "Estimate only. Tax is on the value of the consideration (usually the price, excluding HST on new homes).",
  ];
  if (share > 0) notes.push("First-time buyer refunds have eligibility rules (age, residence, no prior home owned).");
  if (toronto && share > 0 && share < 1) notes.push("Toronto's rebate with partial first-time ownership isn't calculated here.");
  if (foreignBuyer) notes.push("Non-resident speculation taxes have exemptions (e.g. some permanent residents, refugees).");

  const total = round2(provincialTax - provincialRefund + municipalTax - municipalRebate + nonResidentTax);
  return { provincialTax, provincialRefund, municipalTax, municipalRebate, nonResidentTax, total, notes };
}

// ------------------------------------------------------------------ mortgages

export type Frequency = "monthly" | "semi-monthly" | "bi-weekly" | "weekly" | "accelerated bi-weekly" | "accelerated weekly";

const PER_YEAR: Record<Frequency, number> = {
  monthly: 12,
  "semi-monthly": 24,
  "bi-weekly": 26,
  weekly: 52,
  "accelerated bi-weekly": 26,
  "accelerated weekly": 52,
};

export interface MortgageInput {
  principal: number;
  /** Nominal annual rate, e.g. 0.05 for 5%. */
  annualRate: number;
  amortizationYears: number;
  frequency?: Frequency;
}

export interface MortgageResult {
  payment: number;
  paymentsPerYear: number;
  totalPayments: number;
  totalInterest: number;
  payoffYears: number;
  notes: string[];
}

/**
 * Canadian fixed-rate mortgages compound semi-annually (Interest Act), so the
 * periodic rate is derived from the semi-annual rate rather than rate / 12.
 * Accelerated payments are the monthly payment divided by 2 or 4, paid 26
 * or 52 times a year, which pays the mortgage off sooner.
 */
export function mortgagePayment(input: MortgageInput): MortgageResult {
  const { principal, annualRate, amortizationYears, frequency = "monthly" } = input;
  if (!(principal > 0) || !(amortizationYears > 0) || !(annualRate >= 0)) {
    throw new RangeError("principal and amortization must be positive, rate non-negative");
  }
  const perYear = PER_YEAR[frequency];
  const periodicRate = (n: number) => (1 + annualRate / 2) ** (2 / n) - 1;
  const level = (n: number) => {
    const i = periodicRate(n);
    const count = amortizationYears * n;
    return i === 0 ? principal / count : (principal * i) / (1 - (1 + i) ** -count);
  };

  const payment = frequency.startsWith("accelerated") ? level(12) / (frequency === "accelerated bi-weekly" ? 2 : 4) : level(perYear);

  // Count the payments needed to clear the balance (accelerated plans finish early).
  const i = periodicRate(perYear);
  let balance = principal;
  let count = 0;
  let paid = 0;
  while (balance > 0.005 && count < amortizationYears * perYear + 1) {
    const interest = balance * i;
    const thisPayment = Math.min(payment, balance + interest);
    balance = balance + interest - thisPayment;
    paid += thisPayment;
    count += 1;
  }

  return {
    payment: round2(payment),
    paymentsPerYear: perYear,
    totalPayments: count,
    totalInterest: round2(paid - principal),
    payoffYears: Math.round((count / perYear) * 10) / 10,
    notes: [
      "Fixed-rate payment with semi-annual compounding (the Canadian standard). Excludes property tax and mortgage insurance.",
    ],
  };
}
