import { stocksApi } from "@/lib/api-client";
import type { TransactionsApiResponse } from "@/types/order";

/**
 * Get My Transactions
 * 
 * Fetches all transactions (orders + voucher entries) for the current user
 */
export async function getMyTransactions(): Promise<TransactionsApiResponse> {
  try {
    const response = await stocksApi.get<TransactionsApiResponse>("/payments/transactions");
    return response.data;
  } catch (error: any) {
    if (!error.response) {
      throw new Error("Failed to load transactions. Please check your connection.");
    }
    throw new Error("Unable to load transactions. Please try again.");
  }
}
