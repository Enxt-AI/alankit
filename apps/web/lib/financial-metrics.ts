/** Financial statement values preserve unknowns separately from reported zero. */
export type FinancialEntry = Record<string, any>;
export type MetricValue = number | null;
export interface MetricDef {
  label: string;
  isPercent?: boolean;
  isHeader?: boolean;
  isTotal?: boolean;
  getValue: (entry: FinancialEntry) => MetricValue;
}

export function readNumber(value: unknown): MetricValue {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function field(object: any, key: string): MetricValue {
  return readNumber(object?.[key]);
}
function sum(...values: MetricValue[]): MetricValue {
  if (values.some((value) => value === null)) return null;
  return readNumber(values.reduce<number>((total, value) => total + value!, 0));
}
function subtract(total: MetricValue, ...values: MetricValue[]): MetricValue {
  return sum(total, ...values.map((value) => (value === null ? null : -value)));
}
function margin(profit: MetricValue, revenue: MetricValue): MetricValue {
  return profit !== null && revenue !== null && revenue > 0
    ? readNumber((profit / revenue) * 100)
    : null;
}
const pnl = (e: FinancialEntry, key: string) => field(e.pnl?.lineItems, key);
const assets = (e: FinancialEntry, key: string) => field(e.bs?.assets, key);
const liabilities = (e: FinancialEntry, key: string) =>
  field(e.bs?.liabilities, key);
const cash = (e: FinancialEntry, key: string) => field(e.cash_flow, key);
const cwip = (e: FinancialEntry) =>
  field(e.bs?.subTotals, "capital_wip") ??
  assets(e, "tangible_assets_capital_work_in_progress");
const investments = (e: FinancialEntry) =>
  sum(assets(e, "noncurrent_investments"), assets(e, "current_investments"));
const borrowings = (e: FinancialEntry) =>
  sum(
    liabilities(e, "long_term_borrowings"),
    liabilities(e, "short_term_borrowings"),
  );
const header = (label: string): MetricDef => ({
  label,
  isHeader: true,
  getValue: () => null,
});
const pnlRow = (label: string, key: string): MetricDef => ({
  label,
  getValue: (e) => pnl(e, key),
});
const cashRow = (label: string, key: string, isTotal = false): MetricDef => ({
  label,
  isTotal,
  getValue: (e) => cash(e, key),
});
// Probe's named outflow fields are subtracted as supplied. Negative repayments
// represent a net inflow in the supplied response; taking abs would break totals.
const cashOutflow = (label: string, key: string): MetricDef => ({
  label,
  getValue: (e) => subtract(0, cash(e, key)),
});

export const PNL_METRICS: MetricDef[] = [
  pnlRow("Net Revenue", "net_revenue"),
  pnlRow("Cost of Materials Consumed", "total_cost_of_materials_consumed"),
  pnlRow("Purchases of Stock in Trade", "total_purchases_of_stock_in_trade"),
  pnlRow(
    "Change in Inventories",
    "total_changes_in_inventories_or_finished_goods",
  ),
  {
    label: "Gross Profit Margin",
    isPercent: true,
    getValue: (e) => field(e.ratios, "gross_profit_margin"),
  },
  pnlRow("Employee Benefits Expense", "total_employee_benefit_expense"),
  pnlRow("Other Expenses", "total_other_expenses"),
  pnlRow("EBITDA", "operating_profit"),
  {
    label: "EBITDA Margin",
    isPercent: true,
    getValue: (e) =>
      field(e.ratios, "ebitda_margin") ??
      margin(pnl(e, "operating_profit"), pnl(e, "net_revenue")),
  },
  pnlRow("Depreciation and Amortisation", "depreciation"),
  pnlRow("Other Income", "other_income"),
  pnlRow("Finance Costs", "interest"),
  pnlRow("EBIT", "profit_before_interest_and_tax"),
  {
    label: "EBIT Margin",
    isPercent: true,
    getValue: (e) =>
      margin(pnl(e, "profit_before_interest_and_tax"), pnl(e, "net_revenue")),
  },
  pnlRow("PBT", "profit_before_tax"),
  {
    label: "PBT Margin",
    isPercent: true,
    getValue: (e) => margin(pnl(e, "profit_before_tax"), pnl(e, "net_revenue")),
  },
  pnlRow("Tax Expense", "income_tax"),
  pnlRow("PAT", "profit_after_tax"),
  {
    label: "Net Profit Margin",
    isPercent: true,
    getValue: (e) =>
      field(e.ratios, "net_margin") ??
      margin(pnl(e, "profit_after_tax"), pnl(e, "net_revenue")),
  },
  // No reported EPS / weighted-average shares are supplied by this API mapping.
  // Current or year-end shareholding counts must not be used as historical EPS.
];

export const BS_METRICS: MetricDef[] = [
  header("Assets"),
  {
    label: "Net Fixed Assets",
    getValue: (e) => field(e.bs?.subTotals, "net_fixed_assets"),
  },
  { label: "Capital Work in Progress", getValue: cwip },
  { label: "Investments", getValue: investments },
  {
    label: "Trade Receivables",
    getValue: (e) => assets(e, "trade_receivables"),
  },
  { label: "Inventory", getValue: (e) => assets(e, "inventories") },
  {
    label: "Other Assets",
    getValue: (e) =>
      subtract(
        assets(e, "given_assets_total"),
        field(e.bs?.subTotals, "net_fixed_assets"),
        cwip(e),
        investments(e),
        assets(e, "trade_receivables"),
        assets(e, "inventories"),
      ),
  },
  {
    label: "Total Assets",
    isTotal: true,
    getValue: (e) => assets(e, "given_assets_total"),
  },
  header("Equity and Liabilities"),
  { label: "Share Capital", getValue: (e) => liabilities(e, "share_capital") },
  {
    label: "Reserves",
    getValue: (e) => liabilities(e, "reserves_and_surplus"),
  },
  { label: "Borrowings", getValue: borrowings },
  {
    label: "Trade Payables",
    getValue: (e) => liabilities(e, "trade_payables"),
  },
  {
    label: "Other Equity and Liabilities",
    getValue: (e) =>
      subtract(
        liabilities(e, "given_liabilities_total"),
        liabilities(e, "share_capital"),
        liabilities(e, "reserves_and_surplus"),
        borrowings(e),
        liabilities(e, "trade_payables"),
      ),
  },
  {
    label: "Total Equity and Liabilities",
    isTotal: true,
    getValue: (e) => liabilities(e, "given_liabilities_total"),
  },
];

export const CF_METRICS: MetricDef[] = [
  header("Operating Activities"),
  cashRow("PBT", "profit_before_tax"),
  cashRow(
    "Finance Cost and Depreciation Adjustments",
    "adjustment_for_finance_cost_and_depreciation",
  ),
  cashRow(
    "Current and Non-current Asset Adjustments",
    "adjustment_for_current_and_non_current_assets",
  ),
  cashRow(
    "Current and Non-current Liability Adjustments",
    "adjustment_for_current_and_non_current_liabilities",
  ),
  cashRow(
    "Other Operating Adjustments",
    "other_adjustments_in_operating_activities",
  ),
  cashRow(
    "Cash Flow From Operations",
    "cash_flows_from_used_in_operating_activities",
    true,
  ),
  header("Investing Activities"),
  cashOutflow("Purchases of Assets", "cash_outflow_from_purchase_of_assets"),
  cashRow("Sales of Assets", "cash_inflow_from_sale_of_assets"),
  cashRow("Income From Assets", "income_from_assets"),
  cashRow(
    "Other Investing Adjustments",
    "other_adjustments_in_investing_activities",
  ),
  cashRow(
    "Cash Flow From Investing",
    "cash_flows_from_used_in_investing_activities",
    true,
  ),
  header("Financing Activities"),
  cashRow(
    "Capital and Borrowing Proceeds",
    "cash_inflow_from_raisng_capital_and_borrowings",
  ),
  cashOutflow(
    "Capital and Borrowing Repayments",
    "cash_outflow_from_repayment_of_capital_and_borrowings",
  ),
  cashOutflow("Interest and Dividends Paid", "interest_and_dividends_paid"),
  cashRow(
    "Other Financing Adjustments",
    "other_adjustments_in_financing_activities",
  ),
  cashRow(
    "Cash Flow From Financing",
    "cash_flows_from_used_in_financing_activities",
    true,
  ),
  header("Cash Summary"),
  cashRow("Net Change in Cash", "incr_decr_in_cash_cash_equv", true),
  {
    label: "Implied Opening Cash",
    getValue: (e) =>
      subtract(
        cash(e, "cash_flow_statement_at_end_of_period"),
        cash(e, "incr_decr_in_cash_cash_equv"),
      ),
  },
  cashRow("Closing Cash", "cash_flow_statement_at_end_of_period"),
];

export function formatMetric(value: MetricValue, percent = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (percent) return `${value.toFixed(2)}%`;
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function metricChange(
  metric: MetricDef,
  current: FinancialEntry,
  previous?: FinancialEntry,
): MetricValue {
  if (
    !previous ||
    new Date(current.year).getUTCFullYear() -
      new Date(previous.year).getUTCFullYear() !==
      1
  )
    return null;
  const currentValue = metric.getValue(current),
    previousValue = metric.getValue(previous);
  if (currentValue === null || previousValue === null) return null;
  if (metric.isPercent) return readNumber(currentValue - previousValue);
  return previousValue === 0
    ? null
    : readNumber(
        ((currentValue - previousValue) / Math.abs(previousValue)) * 100,
      );
}

export function selectFinancialYears(
  entries: FinancialEntry[] | null | undefined,
  nature: string,
): FinancialEntry[] {
  const years = new Map<string, FinancialEntry>();
  for (const entry of entries ?? []) {
    if (
      entry?.nature !== nature ||
      !entry.year ||
      !Number.isFinite(Date.parse(entry.year))
    )
      continue;
    const previous = years.get(entry.year);
    // Prefer the most recently stated version; preserve input precedence on ties.
    if (
      !previous ||
      Date.parse(entry.stated_on) > Date.parse(previous.stated_on)
    )
      years.set(entry.year, entry);
  }
  return [...years.values()].sort(
    (a, b) => Date.parse(a.year) - Date.parse(b.year),
  );
}

export function hasOpeningCashMismatch(
  current: FinancialEntry,
  previous?: FinancialEntry,
): boolean {
  if (
    !previous ||
    new Date(current.year).getUTCFullYear() -
      new Date(previous.year).getUTCFullYear() !==
      1
  )
    return false;
  const opening = subtract(
    cash(current, "cash_flow_statement_at_end_of_period"),
    cash(current, "incr_decr_in_cash_cash_equv"),
  );
  const closing = cash(previous, "cash_flow_statement_at_end_of_period");
  return (
    opening !== null && closing !== null && Math.abs(opening - closing) > 1
  );
}
