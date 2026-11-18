// Web Worker for CSV generation of large portfolios (>500 holdings)
// Handles CSV generation to prevent main thread blocking

// Import Papa Parse via CDN
importScripts('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js');

// Listen for messages from main thread
self.onmessage = function(event) {
  const { holdings } = event.data;
  try {
    // Create currency formatter for INR
    const currencyFormatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Format holdings data to match PortfolioCSVRow structure
    const formattedData = holdings.map(holding => ({
      Symbol: holding.stockSymbol,
      'Stock Name': holding.stock?.name || 'Stock Unavailable',
      Quantity: holding.quantity,
      'Avg Price (₹)': currencyFormatter.format(holding.avgPrice || 0),
      'Current Price (₹)': currencyFormatter.format(holding.currentPrice || 0),
      'Invested Value (₹)': currencyFormatter.format(holding.investedValue || 0),
      'Current Value (₹)': currencyFormatter.format(holding.currentValue || 0),
      'P&L (₹)': currencyFormatter.format(holding.profitLoss || 0),
      'P&L (%)': `${(holding.profitLossPercentage || 0).toFixed(2)}%`,
    }));

    // Generate CSV string using Papa Parse
    const csv = Papa.unparse(formattedData);

    // Debug log
    console.log('Worker processed', holdings.length, 'holdings');

    // Send CSV back to main thread
    self.postMessage({ csv });
  } catch (error) {
    // Send error back to main thread
    self.postMessage({ error: error.message });
  }
};