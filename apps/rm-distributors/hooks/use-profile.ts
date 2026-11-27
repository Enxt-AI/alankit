import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth-headers";
import { apiFetch } from "@/lib/api-fetch";

export interface BranchClassificationDetails {
  classification?: string | null;
  classificationLabel?: string | null;
  zone?: string | null;
  zonalHead?: string | null;
  areaManager?: string | null;
  branchManager?: string | null;
  territory?: string | null;
  territoryHead?: string | null;
  reportingManager?: string | null;
}

export interface UserProfile {
  name: string;
  email: string;
  type?: string;
  branchName?: string;
  classification?: BranchClassificationDetails;
}

export function usePortalProfile(portalType: "branch" | "distributor" | "rm") {
  return useQuery({
    queryKey: ["profile", portalType],
    queryFn: async (): Promise<UserProfile> => {
      let endpoint = "/api/auth/distributor/verify";
      if (portalType === "branch") endpoint = "/api/auth/branch/verify";
      if (portalType === "rm") endpoint = "/api/auth/rm/verify";

      const res = await apiFetch(endpoint, {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      if (portalType === "rm") {
        if (data.success && data.rm) {
          const branchOrNetwork =
            data.rm.branch?.name || data.rm.distributor?.name;
          return {
            name: data.rm.name,
            email: data.rm.email,
            type:
              data.rm.type === "INTERNAL_RM"
                ? "Internal Relationship Manager"
                : "Distributor Relationship Manager",
            branchName:
              branchOrNetwork ||
              (data.rm.type === "DISTRIBUTOR_RM"
                ? " Distributor Partner"
                : " Global Securities Ltd."),
          };
        }
      } else {
        if (data.success && (data.distributor || data.branch)) {
          const entity = data.distributor || data.branch;
          return {
            name: entity.name,
            email: entity.email,
            branchName: entity.name,
            ...(data.branch
              ? {
                  classification: {
                    classification: entity.classification,
                    classificationLabel: entity.classificationLabel,
                    zone: entity.zone,
                    zonalHead: entity.zonalHead,
                    areaManager: entity.areaManager,
                    branchManager: entity.branchManager,
                    territory: entity.territory,
                    territoryHead: entity.territoryHead,
                    reportingManager: entity.reportingManager,
                  },
                }
              : {}),
          };
        }
      }

      throw new Error(`Unexpected payload format: ${JSON.stringify(data)}`);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
