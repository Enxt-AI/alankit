import { useQuery } from "@tanstack/react-query";

// Helper to deeply normalize object keys from snake_case to camelCase for the UI
function normalizeFinancials(arr: any[]) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    const newItem = { ...item };
    if (newItem.pnl) {
      newItem.pnl = { ...newItem.pnl };
      if (newItem.pnl.line_items) newItem.pnl.lineItems = newItem.pnl.line_items;
      if (newItem.pnl.sub_totals) newItem.pnl.subTotals = newItem.pnl.sub_totals;
      
      // Map NBFC fields to standard fields
      if (newItem.pnl.lineItems) {
        if (newItem.pnl.lineItems.net_revenue === undefined && newItem.pnl.lineItems.revenue !== undefined) {
           newItem.pnl.lineItems.net_revenue = newItem.pnl.lineItems.revenue;
        }
      }
    }
    if (newItem.bs) {
      newItem.bs = { ...newItem.bs };
      if (newItem.bs.line_items) newItem.bs.lineItems = newItem.bs.line_items;
      if (newItem.bs.sub_totals) newItem.bs.subTotals = newItem.bs.sub_totals;
    }
    return newItem;
  });
}

async function fetchFinancials(cin: string) {
  if (!cin) {
    throw new Error("CIN is required");
  }

  const res = await fetch(
    `/api/stocks/company/${encodeURIComponent(cin)}/details`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch financials: ${res.status}`);
  }

  const json = await res.json();
  const data = json?.data ?? {};

  // Probe42 provides normal companies under `financials` and NBFCs under `nbfc_financials`.
  // We normalize the snake_case fields that the frontend expects in camelCase.
  const financials = normalizeFinancials(data.companyDetails?.financials || data.financials || []);
  const nbfcFinancials = normalizeFinancials(data.companyDetails?.nbfc_financials || data.nbfc_financials || []);
  
  const combinedFinancials = [...financials, ...nbfcFinancials];

  return {
    financials: combinedFinancials.length > 0 ? combinedFinancials : null,
    shareholdings: data.companyDetails?.shareholdings || data.shareholdings || [],
    shareholdingsSummary: data.companyDetails?.shareholdings_summary || data.shareholdings_summary || [],
    shareholdingsMoreThanFivePercent: data.companyDetails?.shareholdings_more_than_five_percent || data.shareholdings_more_than_five_percent || [],
    securitiesAllotment: data.companyDetails?.securities_allotment || data.securities_allotment || [],
    paidUpCapital: data.companyDetails?.company?.paid_up_capital || data.company?.paid_up_capital || null,
    financialParameters: data.companyDetails?.financial_parameters || data.financial_parameters || [],
  };
}

export function useFinancials(cin: string | null | undefined) {
  return useQuery({
    queryKey: ["financials", cin],
    queryFn: () => fetchFinancials(cin!),
    enabled: !!cin,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}