import { stocksApi } from '@/lib/api-client';

export const getBatchRecords = async (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await stocksApi.get(`/batch/nsdl${queryString}`);
  return response.data;
};

export const markBatchGenerate = async (ids: string[], batchNumber?: number) => {
  const response = await stocksApi.post(`/batch/nsdl/generate`, { ids, batchNumber });
  return response.data;
};

export const getBatchConfig = async () => {
  const response = await stocksApi.get(`/batch/nsdl/config`);
  return response.data;
};

export const updateBatchConfig = async (config: { batchNumber: string; dpId: string; clientId: string }) => {
  const response = await stocksApi.post(`/batch/nsdl/config`, config);
  return response.data;
};

