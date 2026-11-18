import { stocksApi } from './api-client';
import type {
  UpcomingStock,
  UpcomingStockDirector,
  UpcomingStockDocument,
  CreateUpcomingDirectorDto,
  UpdateUpcomingDirectorDto,
  CreateUpcomingDocumentDto,
  UpdateUpcomingDocumentDto,
} from '@/types/upcoming-stock';

type ApiErrorShape = {
  message?: string;
  response?: {
    data?: {
      message?: string;
    };
  };
};

function getApiErrorMessage(error: unknown, fallback: string): string {
  const maybeError = error as ApiErrorShape;
  return maybeError?.response?.data?.message || maybeError?.message || fallback;
}

// ============================================
// Upcoming Stock Details - Admin/CMS API
// ============================================

export async function getUpcomingStockDetailsAdmin(id: string): Promise<UpcomingStock> {
  try {
    const response = await stocksApi.get(`/upcoming-stocks/${id}`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to load upcoming stock details.'));
  }
}

export async function getUpcomingStockDetailsCms(id: string): Promise<UpcomingStock> {
  try {
    const response = await stocksApi.get(`/upcoming-stocks/${id}`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to load upcoming stock details.'));
  }
}

export async function getUpcomingStockDirectorsAdmin(id: string): Promise<UpcomingStockDirector[]> {
  try {
    const response = await stocksApi.get(`/admin/upcoming-stocks/${id}/directors`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to load upcoming stock directors.'));
  }
}

export async function getUpcomingStockDirectorsCms(id: string): Promise<UpcomingStockDirector[]> {
  try {
    const response = await stocksApi.get(`/cms/upcoming-stocks/${id}/directors`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to load upcoming stock directors.'));
  }
}

export async function createUpcomingDirectorAdmin(
  upcomingStockId: string,
  dto: CreateUpcomingDirectorDto,
): Promise<UpcomingStockDirector> {
  try {
    const response = await stocksApi.post(`/admin/upcoming-stocks/${upcomingStockId}/directors`, dto);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to create upcoming stock director.'));
  }
}

export async function createUpcomingDirectorCms(
  upcomingStockId: string,
  dto: CreateUpcomingDirectorDto,
): Promise<UpcomingStockDirector> {
  try {
    const response = await stocksApi.post(`/cms/upcoming-stocks/${upcomingStockId}/directors`, dto);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to create upcoming stock director.'));
  }
}

export async function updateUpcomingDirectorAdmin(
  upcomingStockId: string,
  directorId: string,
  dto: UpdateUpcomingDirectorDto,
): Promise<UpcomingStockDirector> {
  try {
    const response = await stocksApi.put(
      `/admin/upcoming-stocks/${upcomingStockId}/directors/${directorId}`,
      dto,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to update upcoming stock director.'));
  }
}

export async function updateUpcomingDirectorCms(
  upcomingStockId: string,
  directorId: string,
  dto: UpdateUpcomingDirectorDto,
): Promise<UpcomingStockDirector> {
  try {
    const response = await stocksApi.put(
      `/cms/upcoming-stocks/${upcomingStockId}/directors/${directorId}`,
      dto,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to update upcoming stock director.'));
  }
}

export async function deleteUpcomingDirectorAdmin(upcomingStockId: string, directorId: string): Promise<void> {
  try {
    await stocksApi.delete(`/admin/upcoming-stocks/${upcomingStockId}/directors/${directorId}`);
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete upcoming stock director.'));
  }
}

export async function deleteUpcomingDirectorCms(upcomingStockId: string, directorId: string): Promise<void> {
  try {
    await stocksApi.delete(`/cms/upcoming-stocks/${upcomingStockId}/directors/${directorId}`);
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete upcoming stock director.'));
  }
}

export async function getUpcomingStockDocumentsAdmin(id: string): Promise<UpcomingStockDocument[]> {
  try {
    const response = await stocksApi.get(`/admin/upcoming-stocks/${id}/documents`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to load upcoming stock documents.'));
  }
}

export async function getUpcomingStockDocumentsCms(id: string): Promise<UpcomingStockDocument[]> {
  try {
    const response = await stocksApi.get(`/cms/upcoming-stocks/${id}/documents`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to load upcoming stock documents.'));
  }
}

export async function createUpcomingDocumentAdmin(
  upcomingStockId: string,
  dto: CreateUpcomingDocumentDto,
): Promise<UpcomingStockDocument> {
  try {
    const response = await stocksApi.post(`/admin/upcoming-stocks/${upcomingStockId}/documents`, dto);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to create upcoming stock document.'));
  }
}

export async function createUpcomingDocumentCms(
  upcomingStockId: string,
  dto: CreateUpcomingDocumentDto,
): Promise<UpcomingStockDocument> {
  try {
    const response = await stocksApi.post(`/cms/upcoming-stocks/${upcomingStockId}/documents`, dto);
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to create upcoming stock document.'));
  }
}

export async function updateUpcomingDocumentAdmin(
  upcomingStockId: string,
  documentId: string,
  dto: UpdateUpcomingDocumentDto,
): Promise<UpcomingStockDocument> {
  try {
    const response = await stocksApi.put(
      `/admin/upcoming-stocks/${upcomingStockId}/documents/${documentId}`,
      dto,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to update upcoming stock document.'));
  }
}

export async function updateUpcomingDocumentCms(
  upcomingStockId: string,
  documentId: string,
  dto: UpdateUpcomingDocumentDto,
): Promise<UpcomingStockDocument> {
  try {
    const response = await stocksApi.put(
      `/cms/upcoming-stocks/${upcomingStockId}/documents/${documentId}`,
      dto,
    );
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to update upcoming stock document.'));
  }
}

export async function deleteUpcomingDocumentAdmin(upcomingStockId: string, documentId: string): Promise<void> {
  try {
    await stocksApi.delete(`/admin/upcoming-stocks/${upcomingStockId}/documents/${documentId}`);
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete upcoming stock document.'));
  }
}

export async function deleteUpcomingDocumentCms(upcomingStockId: string, documentId: string): Promise<void> {
  try {
    await stocksApi.delete(`/cms/upcoming-stocks/${upcomingStockId}/documents/${documentId}`);
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to delete upcoming stock document.'));
  }
}

export async function uploadUpcomingDirectorImage(file: File, useCmsEndpoint?: boolean): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const path = useCmsEndpoint
      ? '/upcoming-stocks/upload/director-image'
      : '/upcoming-stocks/admin/upload/director-image';

    const response = await stocksApi.post(path, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to upload director image.'));
  }
}

export async function uploadUpcomingStockDocument(file: File, useCmsEndpoint?: boolean): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const path = useCmsEndpoint
      ? '/upcoming-stocks/upload/document'
      : '/upcoming-stocks/admin/upload/document';

    const response = await stocksApi.post(path, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: unknown) {
    throw new Error(getApiErrorMessage(error, 'Failed to upload document.'));
  }
}
