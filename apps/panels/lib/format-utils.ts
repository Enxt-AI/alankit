/**
 * Utility functions for formatting numbers, currency, and percentages
 */

/**
 * Format market capitalization value
 * @param value - Market cap value in rupees
 * @returns Formatted string like "₹1.25 Cr" or "₹50 L"
 */
export function formatMarketCap(value: number | null | undefined): string {
  if (!value || value === 0) return "N/A";

  if (value >= 10000000) { // 10 million = 1 crore
    const crores = value / 10000000;
    return `₹${crores.toFixed(2)} Cr`;
  } else if (value >= 100000) { // 1 lakh
    const lakhs = value / 100000;
    return `₹${lakhs.toFixed(2)} L`;
  } else {
    return `₹${value.toLocaleString("en-IN")}`;
  }
}

/**
 * Format currency value with Indian locale
 * @param value - Numeric value
 * @returns Formatted currency string like "₹1,23,456"
 */
export function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

/**
 * Format percentage with sign and color class
 * @param value - Percentage value (e.g., 2.5 for +2.5%)
 * @returns Object with formatted string and color class
 */
export function formatPercentage(value: number): { text: string; colorClass: string } {
  const sign = value >= 0 ? "+" : "";
  const text = `${sign}${value.toFixed(2)}%`;
  const colorClass = value >= 0 ? "text-green-600" : "text-red-600";
  return { text, colorClass };
}

/**
 * Generate dummy time series data for stock price chart
 * @param periods - Number of data points
 * @param basePrice - Base price to generate around
 * @returns Array of {date, price} objects
 */
export function generateDummyPriceData(
  periods: number = 30,
  basePrice: number = 1000
): Array<{ date: string; price: number }> {
  const data = [];
  const now = new Date();

  for (let i = periods - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Generate random price variation (±10%)
    const variation = (Math.random() - 0.5) * 0.2; // -10% to +10%
    const price = basePrice * (1 + variation);

    data.push({
      date: date.toISOString().split('T')[0]!, // YYYY-MM-DD format
      price: Math.round(price * 100) / 100, // Round to 2 decimal places
    });
  }

  return data;
}