import { useState, useEffect, useCallback } from "react";
import { isAxiosError } from "axios";
import { notify } from "@/components/ui/floating-notification";

import { authApi } from "@/lib/api-client";

// Data Types
export interface NetworkUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  status: "ACTIVE" | "INACTIVE";
  type?: "INTERNAL_RM" | "DISTRIBUTOR_RM";
  parentName?: string;
  parentId?: string;
  conversionsCount?: number;
  totalRevenue?: number;
  // Branch classification (branches only)
  classification?: BranchClassification | null;
  classificationLabel?: string | null;
}

export type BranchClassification = "EQUITY" | "DISTRIBUTION" | "WEALTH" | "STOXKART" | "OTHER";

export interface BranchClassificationPayload {
  classification?: BranchClassification;
  classificationLabel?: string;
  zone?: string;
  zonalHead?: string;
  areaManager?: string;
  branchManager?: string;
  territory?: string;
  territoryHead?: string;
  reportingManager?: string;
}

// Use relative path to leverage Next.js rewrites/proxy configuration
const API_BASE = "/auth/admin";

export function useDistributors() {
  const [data, setData] = useState<NetworkUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDistributors = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authApi.get(`${API_BASE}/distributors`);
      const result = response.data;

      if (result.success && result.distributors) {
        setData(result.distributors);
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        console.error("Network error fetching distributors:", err);
        notify.error("Failed to connect to auth server");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDistributors();
  }, [fetchDistributors]);

  const createDistributor = async (payload: Omit<NetworkUser, "id" | "createdAt" | "status"> & { password?: string }) => {
    try {
      const response = await authApi.post(`${API_BASE}/distributors`, payload);
      
      const result = response.data;
      if (result.success) {
        notify.success("Distributor created successfully");
        fetchDistributors();
        return { success: true, distributor: result.distributor };
      } else {
        notify.error(result.message || "Failed to create distributor");
        return { success: false, message: result.message || "Failed to create distributor" };
      }
    } catch (err) {
      console.error("Error creating distributor", err);
      notify.error("Network error while creating distributor");
      return { success: false, message: "Network error while creating distributor" };
    }
  };

  const deleteDistributor = async (id: string) => {
    try {
      const response = await authApi.delete(`${API_BASE}/distributors/${id}`);
      const result = response.data;
      if (result.success) {
        notify.success("Distributor deleted successfully");
        fetchDistributors();
        return { success: true };
      } else {
        notify.error(result.message || "Failed to delete distributor");
        return { success: false, message: result.message || "Failed to delete distributor" };
      }
    } catch (err: any) {
      console.error("Error deleting distributor", err);
      const msg = err?.response?.data?.message || "Failed to delete distributor";
      notify.error(msg);
      return { success: false, message: msg };
    }
  };

  const updateDistributor = async (id: string, payload: Pick<NetworkUser, "name" | "email">) => {
    try {
      const response = await authApi.patch(`${API_BASE}/distributors/${id}`, payload);
      const result = response.data;
      if (result.success && result.distributor) {
        setData((distributors) => distributors.map((distributor) => distributor.id === id ? result.distributor : distributor));
        notify.success("Distributor updated successfully");
        return { success: true };
      }
      const message = result.message || "Failed to update distributor";
      return { success: false, message: Array.isArray(message) ? message.join(". ") : message };
    } catch (err) {
      const message = (isAxiosError(err) && err.response?.data?.message) || "Failed to update distributor. Please try again.";
      return { success: false, message: Array.isArray(message) ? message.join(". ") : message };
    }
  };

  return { data, isLoading, refetch: fetchDistributors, createDistributor, deleteDistributor, updateDistributor };
}

export function useBranches() {
  const [data, setData] = useState<NetworkUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authApi.get(`${API_BASE}/branches`);
      
      const result = response.data;

      if (result.success && result.branches) {
        setData(result.branches);
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        console.error("Network error fetching branches:", err);
        notify.error("Failed to connect to auth server");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const createBranch = async (payload: Omit<NetworkUser, "id" | "createdAt" | "status"> & { password?: string } & BranchClassificationPayload) => {
    try {
      const response = await authApi.post(`${API_BASE}/branches`, payload);
      
      const result = response.data;
      if (result.success) {
        notify.success("Branch created successfully");
        fetchBranches();
        return { success: true, branch: result.branch };
      } else {
        notify.error(result.message || "Failed to create branch");
        return { success: false, message: result.message || "Failed to create branch" };
      }
    } catch (err: any) {
      console.error("Error creating branch", err);
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.[0]?.message || "Failed to create branch";
      notify.error(msg);
      return { success: false, message: msg };
    }
  };

  const deleteBranch = async (id: string) => {
    try {
      const response = await authApi.delete(`${API_BASE}/branches/${id}`);
      const result = response.data;
      if (result.success) {
        notify.success("Branch deleted successfully");
        fetchBranches();
        return { success: true };
      } else {
        notify.error(result.message || "Failed to delete branch");
        return { success: false, message: result.message || "Failed to delete branch" };
      }
    } catch (err: any) {
      console.error("Error deleting branch", err);
      const msg = err?.response?.data?.message || "Failed to delete branch";
      notify.error(msg);
      return { success: false, message: msg };
    }
  };

  const updateBranch = async (id: string, payload: Pick<NetworkUser, "name" | "email"> & BranchClassificationPayload) => {
    try {
      const response = await authApi.patch(`${API_BASE}/branches/${id}`, payload);
      const result = response.data;
      if (result.success && result.branch) {
        setData((branches) => branches.map((branch) => branch.id === id ? result.branch : branch));
        notify.success("Branch updated successfully");
        return { success: true };
      }
      const message = result.message || "Failed to update branch";
      return { success: false, message: Array.isArray(message) ? message.join(". ") : message };
    } catch (err) {
      const message = (isAxiosError(err) && err.response?.data?.message) || "Failed to update branch. Please try again.";
      return { success: false, message: Array.isArray(message) ? message.join(". ") : message };
    }
  };

  return { data, isLoading, refetch: fetchBranches, createBranch, deleteBranch, updateBranch };
}

export function useRMs() {
  const [data, setData] = useState<NetworkUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRMs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authApi.get(`${API_BASE}/rms`);
      
      const result = response.data;

      if (result.success && result.rms) {
        setData(result.rms);
      }
    } catch (err: any) {
      if (err.response?.status !== 401) {
        console.error("Network error fetching RMs:", err);
        notify.error("Failed to connect to auth server");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRMs();
  }, [fetchRMs]);

  const createRM = async (payload: Omit<NetworkUser, "id" | "createdAt" | "status"> & { password?: string, type: string, parentId: string }) => {
    try {
      const response = await authApi.post(`${API_BASE}/rms`, payload);
      
      const result = response.data;
      if (result.success) {
        notify.success("Relationship Manager created successfully");
        fetchRMs();
        return { success: true, rm: result.rm };
      } else {
        notify.error(result.message || "Failed to create RM");
        return { success: false, message: result.message || "Failed to create RM" };
      }
    } catch (err) {
      console.error("Error creating RM", err);
      notify.error("Network error while creating RM");
      return { success: false, message: "Network error while creating RM" };
    }
  };

  const deleteRM = async (id: string) => {
    try {
      const response = await authApi.delete(`${API_BASE}/rms/${id}`);
      const result = response.data;
      if (result.success) {
        notify.success("Relationship Manager deleted successfully");
        fetchRMs();
        return { success: true };
      } else {
        notify.error(result.message || "Failed to delete RM");
        return { success: false, message: result.message || "Failed to delete RM" };
      }
    } catch (err: any) {
      console.error("Error deleting RM", err);
      const msg = err?.response?.data?.message || "Failed to delete RM";
      notify.error(msg);
      return { success: false, message: msg };
    }
  };

  return { data, isLoading, refetch: fetchRMs, createRM, deleteRM };
}
