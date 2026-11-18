import { stocksApi } from './api-client';

export interface SeoMetadata {
  id: string;
  path: string;
  metaTitle?: string;
  metaDescription?: string;
  schemaMarkup?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  pageContent?: string;
  createdAt: string;
  updatedAt: string;
}

export type UpsertSeoMetadataDto = Omit<SeoMetadata, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

export async function getAllSeoMetadata(): Promise<SeoMetadata[]> {
  const response = await stocksApi.get<SeoMetadata[]>('/seo-metadata/cms/all');
  return response.data;
}

export async function getSeoMetadataByPath(path: string): Promise<SeoMetadata> {
  const response = await stocksApi.get<SeoMetadata>(`/seo-metadata/cms?path=${encodeURIComponent(path)}`);
  return response.data;
}

export async function upsertSeoMetadata(dto: UpsertSeoMetadataDto): Promise<SeoMetadata> {
  const response = await stocksApi.post<SeoMetadata>('/seo-metadata/cms', dto);
  return response.data;
}

export async function deleteSeoMetadata(id: string): Promise<{ message: string }> {
  const response = await stocksApi.delete<{ message: string }>(`/seo-metadata/cms/${id}`);
  return response.data;
}
