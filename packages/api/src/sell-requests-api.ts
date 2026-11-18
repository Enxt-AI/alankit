import { stocksApi } from "@/lib/api-client";
import type { CreateSellRequestDto, SellRequestWithStock } from "@/types/sell-request";

/**
 * Sell Requests API
 *
 * User-facing API for submitting sell requests and fetching their history.
 * Uses stocksApi instance which includes JWT token interceptor.
 */

export async function createSellRequest(dto: CreateSellRequestDto): Promise<SellRequestWithStock> {
  try {
    const response = await stocksApi.post<SellRequestWithStock>("/sell-requests", dto);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const serverMessage = error.response.data?.message;
      if (serverMessage) {
        throw new Error(serverMessage);
      }
    }
    throw new Error("Failed to submit sell request. Please try again.");
  }
}

export async function getMySellRequests(): Promise<SellRequestWithStock[]> {
  try {
    const response = await stocksApi.get<SellRequestWithStock[]>("/sell-requests/my");
    return response.data;
  } catch (error: any) {
    console.error("Error fetching user sell requests:", error);
    throw new Error("Failed to fetch your sell requests.");
  }
}
