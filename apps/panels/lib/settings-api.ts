import { stocksApi } from "@/lib/api-client";

export interface ESignTemplate {
  id: string;
  templateId: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { fullName: string; email: string };
}

export async function getESignTemplates(): Promise<ESignTemplate[]> {
  try {
    const response = await stocksApi.get("/admin/settings/esign-templates");
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Unable to fetch eSign templates.");
  }
}

export async function createESignTemplate(data: { templateId: string; pdfUrl?: string }): Promise<ESignTemplate> {
  try {
    const response = await stocksApi.post("/admin/settings/esign-templates", data);
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(Array.isArray(error.response.data.message) ? error.response.data.message.join(", ") : error.response.data.message);
    }
    throw new Error("Failed to create template.");
  }
}

export async function updateESignTemplate(id: string, templateId: string, pdfUrl?: string): Promise<ESignTemplate> {
  try {
    const response = await stocksApi.put(`/admin/settings/esign-templates/${id}`, { templateId, pdfUrl });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Failed to update template.");
  }
}

export async function uploadESignTemplateHtml(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await stocksApi.post("/admin/settings/upload-esign-html", formData);
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Failed to upload HTML.");
  }
}

export async function deleteESignTemplate(id: string): Promise<void> {
  try {
    await stocksApi.delete(`/admin/settings/esign-templates/${id}`);
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Failed to delete template.");
  }
}

export interface RevenueShareSetting {
  id: string;
  type: "INTERNAL" | "EXTERNAL";
  revenuePercentage: number;
  incentivePercentage: number;
  createdAt: string;
  updatedAt: string;
}

export async function getRevenueSharingSettings(): Promise<RevenueShareSetting[]> {
  try {
    const response = await stocksApi.get("/admin/settings/revenue-sharing");
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error("Unable to fetch revenue sharing settings.");
  }
}

export async function updateRevenueSharingSettings(data: {
  type: "INTERNAL" | "EXTERNAL";
  revenuePercentage: number;
  incentivePercentage?: number;
}): Promise<RevenueShareSetting> {
  try {
    const response = await stocksApi.post("/admin/settings/revenue-sharing", data);
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(
        Array.isArray(error.response.data.message)
          ? error.response.data.message.join(", ")
          : error.response.data.message
      );
    }
    throw new Error("Failed to update revenue sharing settings.");
  }
}

