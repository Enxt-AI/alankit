import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth-headers";
import { apiFetch } from "@/lib/api-fetch";

export interface RM {
  id: string;
  name: string;
  email: string;
  employeeId?: string | null;
  company?: string;
  status: string;
  createdAt: string;
  _count: { couponsGenerated: number };
}

export interface CreateRMPayload {
  name: string;
  email: string;
  employeeId: string;
  password: string;
  company?: string;
}

export interface UpdateRMEmployeeIdPayload {
  id: string;
  employeeId: string;
}

export async function fetchRMs(userType: string): Promise<RM[]> {
  const endpoint = userType === "branch" ? "/api/auth/branch/internal-rms" : "/api/auth/distributor/distributor-rms";
  const res = await apiFetch(endpoint, {
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch relationship managers");
  }
  const data = await res.json();
  return data.success ? (data.rms || []) : [];
}

export function useRMs(userType: string = "distributor") {
  return useQuery({
    queryKey: ["rms", userType],
    queryFn: () => fetchRMs(userType),
    staleTime: 30 * 1000,
  });
}

export function useCreateRM(userType: string = "distributor") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateRMPayload) => {
      const endpoint = userType === "branch" ? "/api/auth/branch/internal-rm" : "/api/auth/distributor/distributor-rm";
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get("content-type") || "";
      let data: any = null;
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
      }

      if (!res.ok || !data?.success) {
        const message = Array.isArray(data?.message)
          ? data.message.join(". ")
          : data?.message;
        throw new Error(
          message ||
          (res.status === 403
            ? "Permission denied (403): You don't have permission to perform this action"
            : `Failed to create Relationship Manager (${res.status})`)
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rms"] });
    },
  });
}

export function useDeleteBranchRM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/auth/branch/internal-rm/${encodeURIComponent(id)}/delete`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        const message = Array.isArray(data?.message) ? data.message.join(". ") : data?.message;
        throw new Error(message || `Failed to delete Relationship Manager (${res.status})`);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rms", "branch"] });
    },
  });
}

export function useUpdateRMEmployeeId(userType: string = "distributor") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employeeId }: UpdateRMEmployeeIdPayload) => {
      const endpoint =
        userType === "branch"
          ? `/api/auth/branch/internal-rm/${id}`
          : `/api/auth/distributor/distributor-rm/${id}`;
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ employeeId }),
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any = null;
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
      }

      if (!res.ok || !data?.success) {
        const message = Array.isArray(data?.message)
          ? data.message.join(". ")
          : data?.message;
        throw new Error(
          message ||
          (res.status === 403
            ? "Permission denied (403): You don't have permission to perform this action"
            : `Failed to update Employee ID (${res.status})`)
        );
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rms"] });
    },
  });
}
