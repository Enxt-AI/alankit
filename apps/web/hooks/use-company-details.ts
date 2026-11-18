import { useQuery } from "@tanstack/react-query";

export interface DirectorInfo {
  din: string;
  name: string;
  designation: string;
  appointment_date?: string;
}

export interface SignatoryInfo {
  name: string;
  designation?: string;
  pan?: string;
}

export interface CompanyDetails {
  description: string | null;
  directorNetwork: DirectorInfo[];
  authorizedSignatories: SignatoryInfo[];
}

async function fetchCompanyDetails(cin: string): Promise<CompanyDetails> {
  const res = await fetch(
    `/api/stocks/company/${encodeURIComponent(cin)}/details`
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch company details: ${res.status}`);
  }

  const json = await res.json();
  const data = json.data ?? {};

  return {
    description: data.description?.desc_thousand_char ?? data.description ?? null,
    directorNetwork: Array.isArray(data.director_network)
      ? data.director_network
      : [],
    authorizedSignatories: Array.isArray(data.authorized_signatories)
      ? data.authorized_signatories
      : [],
  };
}

export function useCompanyDetails(cin: string | null | undefined) {
  const normalizedCin = cin?.toUpperCase();
  return useQuery({
    queryKey: ["companyDetails", normalizedCin],
    queryFn: () => fetchCompanyDetails(normalizedCin!),
    enabled: !!normalizedCin,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
