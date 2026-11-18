type ShareholdingRecord = {
  financial_year?: unknown;
  year?: unknown;
  total_equity_shares?: unknown;
  total_preference_shares?: unknown;
  total_no_of_shares?: unknown;
  category?: unknown;
  others?: unknown;
  company?: unknown;
  individual?: unknown;
};

export function positiveNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Compare fiscal years consistently, including YYYY-YY and ISO year-end dates.
function financialYear(value: unknown): number {
  const text = String(value ?? "").trim();
  const range = text.match(/^(\d{4})[-/](\d{2}|\d{4})$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return end < 100 ? start + ((end - start % 100 + 100) % 100) : end;
  }
  const year = text.match(/^(\d{4})(?:$|-\d{2}-\d{2}$)/);
  return year ? Number(year[1]) : 0;
}

export function deriveTotalShares(
  majorShareholdings: ShareholdingRecord[] = [],
  summary: ShareholdingRecord[] = [],
): number {
  const candidates: { year: number; shares: number; direct: boolean }[] = [];
  for (const record of Array.isArray(summary) ? summary : []) {
    const shares = positiveNumber(record?.total_equity_shares);
    if (shares) candidates.push({ year: financialYear(record.financial_year), shares, direct: true });
  }
  for (const record of Array.isArray(majorShareholdings) ? majorShareholdings : []) {
    const estimates: number[] = [];
    for (const group of [record?.others, record?.company, record?.individual]) {
      if (!Array.isArray(group)) continue;
      for (const entry of group) {
        const shares = positiveNumber(entry?.no_of_shares);
        const percentage = positiveNumber(entry?.shareholding_percentage);
        if (!shares || !percentage || percentage > 100) continue;
        const total = positiveNumber(shares / (percentage / 100));
        if (total) estimates.push(total);
      }
    }
    if (!estimates.length) continue;
    estimates.sort((a, b) => a - b);
    const middle = Math.floor(estimates.length / 2);
    const median = estimates.length % 2
      ? estimates[middle]!
      : estimates[middle - 1]! / 2 + estimates[middle]! / 2;
    // Allow minor percentage rounding, but reject contradictory shareholder totals.
    if (estimates.some((estimate) => Math.abs(estimate - median) / median > 0.01)) continue;
    candidates.push({ year: financialYear(record.financial_year), shares: median, direct: false });
  }
  candidates.sort((a, b) => b.year - a.year || Number(b.direct) - Number(a.direct));
  return candidates[0]?.shares ?? 0;
}

/**
 * Derive Face Value (nominal value per equity share)
 * Priority:
 * 1. Explicitly configured face value on stock (if > 0)
 * 2. Latest nominal_amount_per_security from securities_allotment for equity instruments
 * 3. Fallback: historical balance sheet share capital ÷ total equity shares, or 10
 */
export function deriveFaceValue(
  configuredFaceValue?: unknown,
  securitiesAllotment: any[] = [],
  fallbackFaceValue?: unknown
): number | null {
  const conf = positiveNumber(configuredFaceValue);
  if (conf !== null) return conf;

  if (Array.isArray(securitiesAllotment) && securitiesAllotment.length > 0) {
    const equityAllotments = securitiesAllotment
      .filter((a) => /equity/i.test(a?.instrument ?? ""))
      .filter((a) => positiveNumber(a?.nominal_amount_per_security) !== null)
      .sort((a, b) =>
        String(b?.allotment_date ?? "").localeCompare(String(a?.allotment_date ?? ""))
      );

    const latestEquityNominal = positiveNumber(equityAllotments[0]?.nominal_amount_per_security);
    if (latestEquityNominal !== null) return latestEquityNominal;
  }

  const fallback = positiveNumber(fallbackFaceValue);
  if (fallback !== null) return fallback;

  return null;
}

/**
 * Derive Paid-up Equity Share Capital (excluding preference share capital)
 * Total paid-up capital minus preference share capital.
 */
export function derivePaidUpEquityCapital(
  totalPaidUpCapital?: unknown,
  shareholdingsSummary: any[] = [],
  shareholdings: any[] = [],
  securitiesAllotment: any[] = []
): number | null {
  const total = positiveNumber(totalPaidUpCapital);
  if (total === null) return null;

  let preferenceShares = 0;
  let preferenceNominal = 10;

  // 1. From shareholdings_summary (latest year)
  const summaries = Array.isArray(shareholdingsSummary) ? [...shareholdingsSummary] : [];
  summaries.sort((a, b) =>
    String(b?.financial_year || b?.year || "").localeCompare(String(a?.financial_year || a?.year || ""))
  );
  const latestSummary = summaries[0];

  if (latestSummary && positiveNumber(latestSummary.total_preference_shares)) {
    preferenceShares = Number(latestSummary.total_preference_shares) || 0;
  } else if (Array.isArray(shareholdings)) {
    const prefEntries = shareholdings.filter((s: any) => /preference/i.test(s?.category ?? ""));
    for (const p of prefEntries) {
      preferenceShares += Number(p?.total_no_of_shares) || 0;
    }
  }

  // 2. Add preference allotments made after the latest filing date
  const summaryDate = String(latestSummary?.financial_year || latestSummary?.year || "1970");
  if (Array.isArray(securitiesAllotment)) {
    for (const a of securitiesAllotment) {
      if (/preference/i.test(a?.instrument ?? "")) {
        const allotmentDate = String(a?.allotment_date || "");
        const shares = Number(a?.number_of_securities_allotted) || 0;
        const nominal = positiveNumber(a?.nominal_amount_per_security) || 10;
        preferenceNominal = nominal;
        if (allotmentDate > summaryDate) {
          preferenceShares += shares;
        }
      }
    }
  }

  const preferenceCapital = preferenceShares * preferenceNominal;
  const equityCapital = total - preferenceCapital;
  return equityCapital > 0 ? equityCapital : total;
}

/**
 * Outstanding shares = Paid-up equity share capital ÷ Face value
 */
export function deriveOutstandingShares(
  paidUpEquityCapital?: unknown,
  faceValue?: unknown,
  fallbackShares?: unknown
): number | null {
  const equityCap = positiveNumber(paidUpEquityCapital);
  const fv = positiveNumber(faceValue);

  if (equityCap !== null && fv !== null && fv > 0) {
    return Math.round(equityCap / fv);
  }

  return positiveNumber(fallbackShares);
}

/**
 * Market cap = Outstanding shares × Current share price
 * (or (Paid-up equity share capital ÷ Face value) × Current share price)
 */
export function calculateMarketCap(shares: unknown, price: unknown, fallback: unknown): number | null {
  const validShares = positiveNumber(shares);
  const validPrice = positiveNumber(price);
  const calculated = validShares && validPrice ? positiveNumber(validShares * validPrice) : null;
  return calculated ?? positiveNumber(fallback);
}

interface ShareBasisInput {
  configuredShares?: unknown;
  configuredFaceValue?: unknown;
  historicalShares?: unknown;
  historicalDate?: string | null;
  allotments?: any[];
  currentPaidUpCapital?: unknown;
  historicalPaidUpCapital?: unknown;
  shareholdingsSummary?: any[];
  shareholdings?: any[];
}

export function resolveShareBasis(input: ShareBasisInput) {
  const faceValue = deriveFaceValue(
    input.configuredFaceValue,
    input.allotments ?? [],
    input.historicalPaidUpCapital && input.historicalShares
      ? positiveNumber(Number(input.historicalPaidUpCapital) / Number(input.historicalShares))
      : 10
  ) ?? 10;

  // Derive Paid-up equity share capital (excluding preference shares)
  const paidUpEquityCapital = derivePaidUpEquityCapital(
    input.currentPaidUpCapital,
    input.shareholdingsSummary ?? [],
    input.shareholdings ?? [],
    input.allotments ?? []
  );

  // Outstanding shares = Paid-up equity share capital ÷ Face value
  const outstandingFromCapital = deriveOutstandingShares(
    paidUpEquityCapital,
    faceValue
  );

  if (outstandingFromCapital !== null) {
    return {
      shares: outstandingFromCapital,
      faceValue,
      paidUpEquityCapital,
      source: "paid_up_capital" as const,
      historicalIsStale: false,
      requiresVerification: false,
    };
  }

  // Fallback to configured or historical shares
  const configured = positiveNumber(input.configuredShares);
  const historical = positiveNumber(input.historicalShares);

  if (configured !== null) {
    return {
      shares: configured,
      faceValue,
      paidUpEquityCapital: null,
      source: "configured" as const,
      historicalIsStale: false,
      requiresVerification: false,
    };
  }

  if (historical !== null) {
    return {
      shares: historical,
      faceValue,
      paidUpEquityCapital: null,
      source: "historical" as const,
      historicalIsStale: false,
      requiresVerification: false,
    };
  }

  return {
    shares: null,
    faceValue,
    paidUpEquityCapital: null,
    source: "unavailable" as const,
    historicalIsStale: false,
    requiresVerification: false,
  };
}
