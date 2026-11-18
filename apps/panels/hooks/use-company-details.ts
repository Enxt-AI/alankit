import { useQuery } from '@tanstack/react-query';

const STOCKS_SERVICE_URL = (
  process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL || 'http://127.0.0.1:3003'
).replace(/\/$/, '');

async function fetchCompanyDetails(cin: string): Promise<{ description: string | null }> {
  const res = await fetch(
    `${STOCKS_SERVICE_URL}/stocks/company/${encodeURIComponent(cin)}/details`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`Failed to fetch company details: ${res.status}`);
  const json = await res.json();
  const data = json.data ?? {};
  return {
    description:
      data.description?.desc_thousand_char ?? data.description ?? null,
  };
}

export function useCompanyDetails(cin: string | null | undefined) {
  const normalizedCin = cin?.toUpperCase();
  return useQuery({
    queryKey: ['companyDetails', normalizedCin],
    queryFn: () => fetchCompanyDetails(normalizedCin!),
    enabled: !!normalizedCin,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
