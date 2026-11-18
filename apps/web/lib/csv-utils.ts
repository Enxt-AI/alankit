import Papa from 'papaparse';
import { PortfolioItem, PortfolioCSVRow } from '@/types/portfolio';

/**
 * Formats portfolio holdings data for CSV export.
 * @param holdings - Array of portfolio items
 * @returns Array of objects with CSV-friendly headers and formatted values
 */
export function formatPortfolioForCSV(holdings: PortfolioItem[]): PortfolioCSVRow[] {
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return holdings.map((holding) => ({
    CIN: holding.stock?.cin || holding.stockId,
    'Stock Name': holding.stock?.name || 'Stock Unavailable',
    Quantity: holding.quantity,
    'Avg Price (₹)': currencyFormatter.format(holding.avgPrice),
    'Current Price (₹)': currencyFormatter.format(holding.currentPrice),
    'Invested Value (₹)': currencyFormatter.format(holding.investedValue),
    'Current Value (₹)': currencyFormatter.format(holding.currentValue),
    'P&L (₹)': currencyFormatter.format(holding.profitLoss),
    'P&L (%)': `${holding.profitLossPercentage.toFixed(2)}%`,
  }));
}

/**
 * Generates a CSV Blob from formatted data array or CSV string.
 * @param data - Array of objects to convert to CSV or pre-generated CSV string
 * @returns Blob containing CSV data
 */
export function generateCSVBlob(data: PortfolioCSVRow[] | string): Blob {
  if (typeof data === 'string') {
    return new Blob([data], { type: 'text/csv;charset=utf-8;' });
  }
  const csvString = Papa.unparse(data);
  return new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Triggers download of a CSV Blob.
 * @param blob - CSV Blob to download
 * @param filename - Name of the downloaded file (default: 'portfolio.csv')
 */
export function downloadCSV(blob: Blob, filename: string = 'portfolio.csv') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}