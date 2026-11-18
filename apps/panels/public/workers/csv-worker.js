// Web Worker for CSV generation of large portfolios (>500 holdings)
// Handles CSV generation to prevent main thread blocking

// Import Papa Parse via CDN
importScripts('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js');

// Listen for messages from main thread
self.onmessage = function(event) {
  try {
    const { holdings } = event.data;
    console.log('Worker received holdings:', holdings.length);

    // Format holdings data (similar to formatPortfolioForCSV in csv-utils.ts)
    const currencyFormatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formattedData = holdings.map((holding) => ({
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

    // Generate CSV string using Papa Parse
    const csv = Papa.unparse(formattedData);

    // Send result back to main thread
    self.postMessage({ csv });
  } catch (error) {
    // Send error back to main thread
    self.postMessage({ error: error.message || 'Failed to generate CSV' });
  }
};