// The rules LeaseLens checks, each tied to the law that supports it.
//
// Sources, checked against the official text on e-Laws (current to
// November 10, 2026):
//   RTA  = Residential Tenancies Act, 2006, S.O. 2006, c. 17
//   Reg  = O. Reg. 516/06 (general regulation under the RTA)
//   Guide = Ontario's "Guide to Ontario's standard lease"
//
// Severity:
//   void   the clause is void (not legally binding) as written
//   check  may be fine, but the law limits it; worth a closer look
//   ok     a common clause that is allowed (shown so the results aren't
//          only red flags, and to avoid false alarms)

export type Severity = "void" | "check" | "ok";

export interface Citation {
  label: string;
  url: string;
}

export interface Hit {
  start: number;
  end: number;
}

export interface Rule {
  id: string;
  severity: Severity;
  title: string;
  explanation: string;
  law: Citation[];
  /** Returns the matched span in the clause, or null. */
  match: (clause: string) => Hit | null;
}

const RTA = "https://www.ontario.ca/laws/statute/06r17";
const REG = "https://www.ontario.ca/laws/regulation/060516";
const GUIDE = "https://www.ontario.ca/page/guide-ontarios-standard-lease";
const OHRC = "https://www.ohrc.on.ca/en/human-rights-and-rental-housing-brochure";

const rta = (section: string): Citation => ({ label: `RTA s. ${section}`, url: RTA });
const reg = (section: string): Citation => ({ label: `O. Reg. 516/06 s. ${section}`, url: REG });
const guide = (section: string): Citation => ({ label: `Standard lease guide, section ${section}`, url: GUIDE });

// ------------------------------------------------------------------ matchers

type Matcher = (clause: string) => Hit | null;

/** First match of any pattern. */
function anyOf(...patterns: RegExp[]): Matcher {
  return (clause) => {
    for (const p of patterns) {
      const re = new RegExp(p.source, p.flags.includes("i") ? p.flags : p.flags + "i");
      const m = re.exec(clause);
      if (m) return { start: m.index, end: m.index + m[0].length };
    }
    return null;
  };
}

/** Narrow a matcher: the clause must also contain `needs` and must not contain `unless`. */
function guarded(matcher: Matcher, opts: { needs?: RegExp; unless?: RegExp }): Matcher {
  return (clause) => {
    if (opts.needs && !opts.needs.test(clause)) return null;
    if (opts.unless && opts.unless.test(clause)) return null;
    return matcher(clause);
  };
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, sixty: 60, ninety: 90,
};

function toNumber(word: string): number {
  return /^\d+$/.test(word) ? Number(word) : (WORD_NUMBERS[word.toLowerCase()] ?? NaN);
}

const NUM = String.raw`(\d+|one|two|three|four|five|six|eight|ten|twelve|fifteen|twenty|thirty|sixty|ninety)`;
const MUST = /\b(must|shall|is required to|are required to|will be required|agrees? to (provide|pay)|required)\b/i;

// ------------------------------------------------------------------ rules

export const RULES: Rule[] = [
  {
    id: "no-pets",
    severity: "void",
    title: "“No pets” clause",
    explanation:
      "A lease term that prohibits animals in or around the building is void. (Condominium rules can still restrict pets in a condo unit, and a landlord can act if a pet causes damage, allergies or serious problems.)",
    law: [rta("14"), guide("15")],
    match: anyOf(
      /\bno\s+(pets?|animals?|dogs?|cats?)\b/,
      /\b(pets?|animals?|dogs?|cats?)\s+(are|is)\s+(strictly\s+)?(not\s+(permitted|allowed)|prohibited|forbidden|not\s+to\s+be\s+kept)/,
      /\b(shall|must|will)\s+not\s+(keep|have|bring)\s+(any\s+)?(pets?|animals?|dogs?|cats?)\b/,
      /\b(prohibit|forbid)(s|ed)?\s+(any\s+|all\s+)?(pets?|animals?)\b/,
    ),
  },
  {
    id: "damage-deposit",
    severity: "void",
    title: "Damage, security or pet deposit",
    explanation:
      "The only deposit a landlord may collect is a rent deposit (usually “last month’s rent”). Damage, security, cleaning and pet deposits aren’t allowed, and a rent deposit can’t be used as a damage deposit.",
    law: [rta("105 (1)"), guide("8")],
    match: anyOf(/\b(damage|security|cleaning|pet|furniture|appliance)\s+deposit\b/),
  },
  {
    id: "rent-deposit-too-high",
    severity: "void",
    title: "Rent deposit above one month",
    explanation:
      "A rent deposit can’t be more than one month’s rent (or one rent period, if shorter). Anything above that isn’t allowed.",
    law: [rta("106 (2)")],
    match: anyOf(
      new RegExp(String.raw`\blast\s+(two|three|2|3)\s+months`),
      new RegExp(String.raw`\b(two|three|2|3)\s+months['’]?\s+(of\s+)?rent\s+(as\s+(a\s+)?|in\s+)?(deposit|advance|security)`),
      new RegExp(String.raw`\bdeposit\s+(equal\s+to|of)\s+(two|three|2|3)\s+months`),
    ),
  },
  {
    id: "deposit-no-interest",
    severity: "void",
    title: "No interest on the rent deposit",
    explanation:
      "The landlord must pay interest on the rent deposit every year, at the provincial rent-increase guideline rate. A clause saying no interest will be paid is void.",
    law: [rta("106 (6)")],
    match: anyOf(
      /\b(no|without)\s+interest\b[^.]*\bdeposit/,
      /\bdeposit\b[^.]*\b(no|without)\s+interest\b/,
      /\binterest\b[^.]*\b(will|shall)\s+not\s+be\s+paid/,
    ),
  },
  {
    id: "key-deposit-nonrefundable",
    severity: "void",
    title: "Non-refundable key or fob deposit",
    explanation:
      "The Act bans key deposits in general; the regulation only allows a refundable one, no higher than the expected direct cost of replacing the key, fob or card.",
    law: [rta("134 (1)"), reg("17, para. 3")],
    match: guarded(anyOf(/\b(key|fob|access card|remote|entry card)s?\b[^.]*\bdeposit|\bdeposit\b[^.]*\b(key|fob|access card)s?\b/), {
      needs: /non[-\s]?refundable|not\s+(be\s+)?refund(ed|able)/i,
    }),
  },
  {
    id: "key-deposit",
    severity: "check",
    title: "Key or fob deposit",
    explanation:
      "Allowed only if it’s refundable and no more than the expected direct cost of replacing the key, fob or card.",
    law: [rta("134 (1)"), reg("17, para. 3")],
    match: guarded(anyOf(/\b(key|fob|access card|entry card)s?\b[^.]*\bdeposit|\bdeposit\b[^.]*\b(key|fob|access card)s?\b/), {
      unless: /non[-\s]?refundable|not\s+(be\s+)?refund(ed|able)/i,
    }),
  },
  {
    id: "post-dated-cheques",
    severity: "void",
    title: "Required post-dated cheques or automatic payments",
    explanation:
      "Neither the landlord nor the lease can require post-dated cheques, pre-authorized debits, automatic credit-card charges or any other automatic payment. Tenants can choose to offer them, but can’t be made to.",
    law: [rta("108")],
    match: guarded(
      anyOf(/\bpost[-\s]?dated\s+cheques?\b/, /\b(pre[-\s]?authori[sz]ed|automatic|auto)\s+(payments?|debits?|withdrawals?|deposits?|charges?)\b/, /\bpad\b/),
      { needs: MUST, unless: /\b(may|optional|if the tenant (chooses|wishes|prefers))\b/i },
    ),
  },
  {
    id: "nsf-fee",
    severity: "void",
    title: "NSF fee above the limit",
    explanation:
      "For a bounced (NSF) cheque, the landlord can charge what their bank actually charged plus an administration fee of at most $20.",
    law: [rta("134 (1)"), reg("17, paras. 4–5")],
    match: (clause) => {
      // "returned" alone isn't enough: deposits get "returned" too.
      const nsf = /\b(nsf|n\.s\.f\.|insufficient\s+funds|(returned|bounced|dishonou?red|rejected)\s+(cheques?|checks?|payments?|e-?transfers?))\b/i;
      if (!nsf.test(clause)) return null;
      const re = /\$\s?(\d+(?:\.\d{2})?)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(clause))) {
        if (Number(m[1]) > 20) return { start: m.index, end: m.index + m[0].length };
      }
      return null;
    },
  },
  {
    id: "late-fee",
    severity: "void",
    title: "Late-payment fee or penalty",
    explanation:
      "Landlords can’t charge penalties, late fees or similar amounts beyond rent. (Bounced-cheque costs are the one narrow exception, capped by regulation.)",
    law: [rta("134 (1)")],
    match: anyOf(
      /\blate\s+(payment\s+)?(fee|charge|penalt(y|ies))\b/,
      /\b(penalty|fine)\s+(of\s+)?\$\s?\d+/,
      /\$\s?\d+(\.\d{2})?\s+(per|a|each)\s+day\b[^.]*\b(late|after|overdue)/,
      /\b(late|overdue)\b[^.]*\$\s?\d+(\.\d{2})?\s+(per|a|each)\s+day\b/,
    ),
  },
  {
    id: "other-fees",
    severity: "void",
    title: "Extra fees beyond rent",
    explanation:
      "Apart from rent, a landlord can’t charge fees, premiums, commissions or similar amounts (for example application, administration, move-in, move-out or cleaning fees) unless the regulation specifically allows them.",
    law: [rta("134 (1)"), guide("15")],
    match: anyOf(
      /\b(application|administration|admin|processing|move[-\s]?in|move[-\s]?out|cleaning|lease\s+preparation|booking|holding)\s+(fee|charge)s?\b/,
      /\b(guest|visitor)\s+(fee|charge)s?\b/,
    ),
  },
  {
    id: "no-guests",
    severity: "void",
    title: "Restrictions on guests",
    explanation:
      "A lease term that doesn’t allow guests, roommates or additional occupants is void, and the landlord can’t charge extra for guests.",
    law: [guide("15"), rta("4 (1)"), rta("134 (1)")],
    match: anyOf(
      /\bno\s+(overnight\s+)?(guests?|visitors?)\b/,
      /\b(guests?|visitors?)\s+(are|is)\s+(not\s+(permitted|allowed)|prohibited)/,
      /\b(guests?|visitors?)\b[^.]*\b(may\s+not|cannot|can['’]t|shall\s+not)\s+(stay|remain|sleep)/,
      new RegExp(String.raw`\b(guests?|visitors?)\b[^.]*\b(longer\s+than|more\s+than|exceed(ing)?)\s+${NUM}\s+(consecutive\s+)?(nights?|days?)`),
      /\b(guests?|visitors?)\b[^.]*\b(written\s+)?(permission|consent|approval)\s+of\s+the\s+landlord/,
    ),
  },
  {
    id: "entry-without-notice",
    severity: "void",
    title: "Landlord entry without proper notice",
    explanation:
      "Apart from emergencies and a few listed situations, the landlord must give at least 24 hours’ written notice stating the reason, the day and a time between 8 a.m. and 8 p.m.",
    law: [rta("27 (1) and (3)"), rta("26")],
    match: (clause) => {
      if (!/\b(enter|entry|access|inspect)/i.test(clause)) return null;
      const loose = anyOf(
        /\b(at\s+any\s+time|any\s*time|at\s+all\s+times|whenever\s+(it|the\s+landlord))\b/,
        /\bwithout\s+(any\s+|prior\s+|advance\s+)?(written\s+)?notice\b/,
      )(clause);
      if (loose && !/\bemergenc/i.test(clause.slice(Math.max(0, loose.start - 40), loose.end + 40))) return loose;
      const short = new RegExp(String.raw`\b${NUM}\s+hours?['’]?\s+(written\s+|prior\s+|advance\s+)?notice`, "i").exec(clause);
      if (short && toNumber(short[1]) < 24) return { start: short.index, end: short.index + short[0].length };
      return null;
    },
  },
  {
    id: "tenant-all-repairs",
    severity: "void",
    title: "Tenant responsible for all repairs",
    explanation:
      "The landlord must keep the unit and building in good repair and meet health, safety and maintenance standards, even if the tenant knew about a problem when signing (so “as is” doesn’t get around it). Tenants only pay for undue damage they, other occupants or their guests cause.",
    law: [rta("20 (1)–(2)"), rta("34"), guide("13")],
    match: guarded(
      anyOf(
        /\btenant\b[^.]*\b(responsible|liable)\s+for\s+(all|any|every)\s+(repairs?|maintenance)/,
        /\btenant\b[^.]*\b(pay|cover)\s+(for\s+)?(all|any)\s+(repairs?|maintenance)/,
        /\b(all|any)\s+(repairs?|maintenance)\b[^.]*\b(tenant['’]s\s+responsibility|responsibility\s+of\s+the\s+tenant|at\s+the\s+tenant['’]s\s+(expense|cost))/,
        /\b(rented|accepts?|leased|taken)\s+(the\s+(unit|premises|property)\s+)?(on\s+an\s+|in\s+)?["“]?as[-\s]is["”]?/,
      ),
      { unless: /\b(caused\s+by|due\s+to|resulting\s+from)\b[^.]*\b(tenant|occupant|guest)|\b(negligen|wilful|willful|undue\s+damage)/i },
    ),
  },
  {
    id: "must-vacate-at-end",
    severity: "void",
    title: "Tenant must move out when the term ends",
    explanation:
      "When a fixed-term lease ends and nobody gives proper notice, it automatically continues month-to-month on the same terms. Tenants don’t have to sign a new lease or move out.",
    law: [rta("38 (1)"), rta("37 (1)"), guide("4")],
    match: anyOf(
      /\b(must|shall|will|agrees?\s+to)\s+(vacate|move\s+out|leave|deliver\s+up\s+possession)\b[^.]*\b(end|expiry|expiration|termination|conclusion)\s+of\s+(the\s+|this\s+)?(lease|term|tenancy|agreement)/,
      /\b(lease|tenancy|agreement)\b[^.]*\b(automatically|shall)\s+(terminate|end|expire)s?\b[^.]*\b(without\s+(further\s+)?notice|at\s+the\s+end\s+of\s+the\s+term)/,
      /\bwill\s+not\s+(be\s+)?(renew(ed)?|continue)\s+(on\s+a\s+)?month[-\s]to[-\s]month/,
    ),
  },
  {
    id: "landlord-can-terminate",
    severity: "void",
    title: "Landlord can end the tenancy at will",
    explanation:
      "A tenancy can only be ended as the Act allows: with a valid reason, the proper form and notice period, and often an order from the Landlord and Tenant Board. A clause letting the landlord end the lease on short notice or for any reason is void.",
    law: [rta("37 (1)"), rta("4 (1)")],
    match: guarded(
      anyOf(
        /\blandlord\s+(may|can|reserves\s+the\s+right\s+to|shall\s+have\s+the\s+right\s+to)\s+(terminate|end|cancel)\b/,
        /\b(terminate|end|cancel)\s+(this\s+)?(lease|tenancy|agreement)\s+(at\s+any\s+time|for\s+any\s+reason)/,
      ),
      { unless: /\bin\s+accordance\s+with\s+the\s+(Residential\s+Tenancies\s+)?Act\b|\bas\s+permitted\s+by\s+(law|the\s+Act)\b/i },
    ),
  },
  {
    id: "acceleration",
    severity: "void",
    title: "All remaining rent due on default",
    explanation:
      "An “acceleration clause”, which makes the rest of the term’s rent (or a set sum) due if the tenant pays late or breaks another term, is void.",
    law: [rta("15")],
    match: anyOf(
      /\b(remaining|balance\s+of\s+the|entire|all\s+(the\s+)?(remaining|future))\s+rent\b[^.]*\b(due|payable|owing)\b/,
      /\brent\s+for\s+the\s+(remainder|balance|rest)\s+of\s+the\s+(term|lease)\b[^.]*\b(due|payable)/,
    ),
  },
  {
    id: "rent-increase",
    severity: "void",
    title: "Rent increases outside the rules",
    explanation:
      "Rent can go up only once every 12 months, with at least 90 days’ written notice on the proper form. For most units first occupied before November 15, 2018, the increase is also capped at the yearly guideline.",
    law: [rta("116 (1)"), rta("119 (1)"), rta("6.1 (2)")],
    match: (clause) => {
      if (!/\b(increase|raise)\b/i.test(clause) || !/\brent\b/i.test(clause)) return null;
      const bad = anyOf(
        /\b(at\s+any\s+time|any\s*time|without\s+(any\s+)?notice|at\s+the\s+landlord['’]s\s+discretion)\b/,
        /\b(every|each)\s+(six|6|three|3|four|4)\s+months\b/,
        /\b(monthly|quarterly|semi-?annually|twice\s+(a|per)\s+year)\b/,
      )(clause);
      if (bad) return bad;
      const days = new RegExp(String.raw`\b${NUM}\s+days?['’]?\s+(written\s+|prior\s+|advance\s+)?notice`, "i").exec(clause);
      if (days && toNumber(days[1]) < 90) return { start: days.index, end: days.index + days[0].length };
      return null;
    },
  },
  {
    id: "no-sublet",
    severity: "void",
    title: "Blanket ban on subletting",
    explanation:
      "Subletting needs the landlord’s consent, but the landlord can’t refuse it arbitrarily or unreasonably, so a lease can’t ban subletting outright.",
    law: [rta("97 (2)"), guide("14")],
    match: anyOf(
      /\b(no|not)\s+(sublet(ting)?|subleas(e|ing))\b/,
      /\b(sublet(ting)?|subleas(e|ing))\b[^.]*\b(is|are)\s+(strictly\s+)?(not\s+(permitted|allowed)|prohibited|forbidden)/,
      /\b(shall|must|will|may)\s+not\s+(sublet|sublease)\b/,
    ),
  },
  {
    id: "no-assignment",
    severity: "check",
    title: "Ban on assigning the lease",
    explanation:
      "Assigning the lease needs the landlord’s consent, and the Act sets out what happens when a landlord refuses, including the tenant’s right to end the tenancy in some cases. A lease clause can’t take those rights away.",
    law: [rta("95"), rta("4 (1)"), guide("14")],
    match: anyOf(
      /\b(shall|must|will|may)\s+not\s+assign\b/,
      /\bassignment\b[^.]*\b(is|are)\s+(strictly\s+)?(not\s+(permitted|allowed)|prohibited|forbidden)/,
    ),
  },
  {
    id: "waiver",
    severity: "void",
    title: "Tenant gives up rights under the Act",
    explanation:
      "A lease can’t take away a right or responsibility under the Residential Tenancies Act. Any term inconsistent with the Act or its regulations is void, including a promise not to apply to the Landlord and Tenant Board.",
    law: [rta("4 (1)"), guide("About the standard lease")],
    match: anyOf(
      /\bwaive[sd]?\b[^.]*\b(rights?|Residential\s+Tenancies\s+Act|RTA|Landlord\s+and\s+Tenant\s+Board|LTB)\b/,
      /\b(not|never)\s+(to\s+)?(apply|file|go)\s+to\s+the\s+(Landlord\s+and\s+Tenant\s+Board|LTB)\b/,
      /\b(Residential\s+Tenancies\s+Act|RTA)\b[^.]*\b(does\s+not|shall\s+not|will\s+not)\s+apply\b/,
    ),
  },
  {
    id: "discrimination",
    severity: "void",
    title: "Possible discrimination",
    explanation:
      "Ontario’s Human Rights Code protects tenants from discrimination, including because of family status, age, receipt of public assistance and other grounds. Terms like “no children” or “adults only” are generally not allowed (limited exceptions exist, such as some seniors’ housing).",
    law: [{ label: "Ontario Human Rights Code", url: OHRC }],
    match: anyOf(
      /\bno\s+(children|kids|babies|families|students|seniors)\b/,
      /\badults?\s+only\b/,
      /\b(children|kids)\s+(are|is)\s+(not\s+(permitted|allowed)|prohibited)/,
      /\bno\s+(one|tenants?)\s+(on|receiving)\s+(social\s+assistance|ontario\s+works|odsp|welfare)/,
    ),
  },

  // ---------------------------------------------------------------- allowed

  {
    id: "rent-deposit-ok",
    severity: "ok",
    title: "Last month’s rent deposit",
    explanation:
      "A rent deposit of up to one month’s rent is allowed if collected at the start. It must be applied to the last month of the tenancy, and earns yearly interest at the guideline rate.",
    law: [rta("106 (1), (2), (6), (10)"), guide("8")],
    match: guarded(anyOf(/\b(last|first\s+and\s+last)\s+month['’]?s?\s+rent\b/, /\brent\s+deposit\b/), {
      unless: /\b(two|three|2|3)\s+months|\bdamage\b|\bsecurity\s+deposit\b/i,
    }),
  },
  {
    id: "tenant-damage-ok",
    severity: "ok",
    title: "Tenant pays for damage they cause",
    explanation:
      "Tenants are responsible for repairing undue damage caused on purpose or through negligence by them, another occupant, or someone they let in.",
    law: [rta("34"), guide("13")],
    match: guarded(anyOf(/\b(damage|damages)\b[^.]*\b(caused\s+by|due\s+to|resulting\s+from)\b[^.]*\b(tenant|occupant|guest)/, /\bundue\s+damage\b/), {}),
  },
  {
    id: "insurance-ok",
    severity: "ok",
    title: "Tenant insurance required",
    explanation:
      "The landlord and tenant can agree that the tenant must carry liability insurance, with proof provided on request.",
    law: [guide("11")],
    match: anyOf(/\b(tenant['’]?s?|liability|contents|renter['’]?s?)\s+insurance\b/),
  },
  {
    id: "smoking-ok",
    severity: "ok",
    title: "Smoking rules",
    explanation:
      "A landlord and tenant can agree to rules about smoking in the unit. (Smoking is already banned by provincial law in indoor common areas of multi-unit buildings.)",
    law: [guide("10")],
    match: anyOf(/\b(no\s+smoking|smoking\s+(is\s+)?(not\s+(permitted|allowed)|prohibited))\b/, /\bshall\s+not\s+smoke\b/),
  },
  {
    id: "cleanliness-ok",
    severity: "ok",
    title: "Tenant keeps the unit clean",
    explanation: "Tenants are responsible for ordinary cleanliness of the unit, unless the lease makes the landlord responsible.",
    law: [rta("33"), guide("13")],
    match: anyOf(/\b(keep|maintain)\s+the\s+(unit|premises|apartment|rental\s+unit)\s+(in\s+a\s+)?(clean|tidy)/, /\bordinary\s+cleanliness\b/),
  },
];

export const SEVERITY_ORDER: Severity[] = ["void", "check", "ok"];

export const STANDARD_LEASE_NOTE: Citation[] = [rta("12.1 (1)"), guide("About the standard lease")];
