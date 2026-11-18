import { useQuery } from "@tanstack/react-query";

export function useCompanyDocument(cin: string | undefined | null, docId: string | null) {
  return useQuery({
    queryKey: ['company-document', cin, docId],
    queryFn: async () => {
      if (!cin || !docId) {
        throw new Error('CIN and Document ID are required');
      }

      // We explicitly pass headers to ask for the blob/pdf
      const response = await fetch(`/api/stocks/company/${encodeURIComponent(cin)}/documents?docId=${encodeURIComponent(docId)}`, {
        headers: {
            "Accept": "application/pdf"
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      // The new route handler proxy returns raw binary
      const blob = await response.blob();
      
      // Create a temporary object URL that the browser can use to download or display
      return URL.createObjectURL(blob);
    },
    // Only attempt the fetch when both dependencies are specifically set
    enabled: !!cin && !!docId,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
