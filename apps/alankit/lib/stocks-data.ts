export type StockDetail = {
  id: string;
  ticker: string;
  name: string;
  price: number;
  currency: string;
  changeAmount: string;
  changePercent: string;
  isPositive: boolean;
  exchange: string;
  lastUpdated: string;
  logoBg: string;
  logoText?: string;
  logoType: "ace" | "adaro" | "arto" | "goto" | "initial";
  initial?: string;
  technicalRating: {
    label: string;
    score: number;
    color: string;
  };
  analystRating: {
    label: string;
    score: number;
    color: string;
  };
  stats: {
    marketCap: string;
    marketCapCurrency?: string;
    dividendYield: string;
    basicEps: string;
    basicEpsCurrency?: string;
    peRatio: string;
    netIncome: string;
    netIncomeCurrency?: string;
    revenue: string;
    revenueCurrency?: string;
    sharesFloat: string;
    sharesFloatCurrency?: string;
    beta: string;
  };
  companyProfile: {
    about: string;
    aboutExtended: string;
    sector: string;
    industry: string;
    ceo: string;
    website: string;
  };
  series1M: number[];
};

export const stocksCatalog: StockDetail[] = [
  {
    id: "tatacap",
    ticker: "TATACAP",
    name: "TATA CAPITAL LIMITED",
    price: 950,
    currency: "INR",
    changeAmount: "+20",
    changePercent: "+2.15%",
    isPositive: true,
    exchange: "Indian Unlisted / Pre-IPO Market",
    lastUpdated: "Today, 15:30 IST",
    logoBg: "#005BAA",
    logoText: "TATA",
    logoType: "ace",
    technicalRating: {
      label: "Strong Buy",
      score: 82,
      color: "#2563EB",
    },
    analystRating: {
      label: "Buy",
      score: 74,
      color: "#4D9A78",
    },
    stats: {
      marketCap: "3.38 L Cr",
      marketCapCurrency: "INR",
      dividendYield: "0.42%",
      basicEps: "18.4",
      basicEpsCurrency: "INR",
      peRatio: "51.6",
      netIncome: "3,327 Cr",
      netIncomeCurrency: "INR",
      revenue: "18,175 Cr",
      revenueCurrency: "INR",
      sharesFloat: "355.8 Cr",
      sharesFloatCurrency: "INR",
      beta: "0.65",
    },
    companyProfile: {
      about:
        "Tata Capital Limited is the flagship financial services company of the Tata Group and a subsidiary of Tata Sons Private Limited. Registered with the Reserve Bank of India as a Systemically Important Non-Deposit Accepting Core Investment Company, Tata Capital offers consumer loans, wealth management, commercial finance, and infrastructure finance...",
      aboutExtended:
        " across more than 700 branches in India, serving retail, corporate, and institutional customers nationwide.",
      sector: "Finance",
      industry: "NBFC & Financial Services",
      ceo: "Rajiv Sabharwal",
      website: "www.tatacapital.com",
    },
    series1M: [
      845, 850, 848, 856, 852, 860, 858, 865, 870, 868, 874, 880, 876, 885,
      890, 888, 895, 902, 898, 905, 910, 908, 915, 922, 918, 926, 932, 929,
      938, 944, 950,
    ],
  },
  {
    id: "nse",
    ticker: "NSE",
    name: "NATIONAL STOCK EXCHANGE OF INDIA LTD",
    price: 6250,
    currency: "INR",
    changeAmount: "+114",
    changePercent: "+1.85%",
    isPositive: true,
    exchange: "Indian Unlisted / Pre-IPO Market",
    lastUpdated: "Today, 15:30 IST",
    logoBg: "#F4F4F5",
    logoText: "NSE",
    logoType: "adaro",
    technicalRating: {
      label: "Strong Buy",
      score: 86,
      color: "#2563EB",
    },
    analystRating: {
      label: "Strong Buy",
      score: 84,
      color: "#4D9A78",
    },
    stats: {
      marketCap: "3.09 L Cr",
      marketCapCurrency: "INR",
      dividendYield: "1.28%",
      basicEps: "168",
      basicEpsCurrency: "INR",
      peRatio: "37.2",
      netIncome: "8,306 Cr",
      netIncomeCurrency: "INR",
      revenue: "16,434 Cr",
      revenueCurrency: "INR",
      sharesFloat: "49.5 Cr",
      sharesFloatCurrency: "INR",
      beta: "0.52",
    },
    companyProfile: {
      about:
        "National Stock Exchange of India Limited (NSE) is the leading stock exchange in India and the world's largest derivatives exchange by trading volume. Located in Mumbai, NSE pioneered electronic screen-based trading in India in 1994 and manages the benchmark NIFTY 50 index...",
      aboutExtended:
        " while providing clearing, settlement, data feeds, and financial technology infrastructure across Indian capital markets.",
      sector: "Finance",
      industry: "Stock Exchanges & Capital Markets",
      ceo: "Ashishkumar Chauhan",
      website: "www.nseindia.com",
    },
    series1M: [
      5820, 5850, 5840, 5890, 5910, 5900, 5940, 5975, 5960, 6010, 6035, 6020,
      6060, 6090, 6080, 6115, 6140, 6125, 6160, 6185, 6170, 6195, 6210, 6200,
      6225, 6240, 6230, 6245, 6250,
    ],
  },
  {
    id: "hdbfin",
    ticker: "HDBFIN",
    name: "HDB FINANCIAL SERVICES LIMITED",
    price: 1180,
    currency: "INR",
    changeAmount: "+39",
    changePercent: "+3.42%",
    isPositive: true,
    exchange: "Indian Unlisted / Pre-IPO Market",
    lastUpdated: "Today, 15:30 IST",
    logoBg: "#F4F4F5",
    logoText: "HDB",
    logoType: "arto",
    technicalRating: {
      label: "Strong Buy",
      score: 80,
      color: "#2563EB",
    },
    analystRating: {
      label: "Buy",
      score: 72,
      color: "#4D9A78",
    },
    stats: {
      marketCap: "93,450 Cr",
      marketCapCurrency: "INR",
      dividendYield: "0.25%",
      basicEps: "31.1",
      basicEpsCurrency: "INR",
      peRatio: "37.9",
      netIncome: "2,461 Cr",
      netIncomeCurrency: "INR",
      revenue: "14,171 Cr",
      revenueCurrency: "INR",
      sharesFloat: "79.1 Cr",
      sharesFloatCurrency: "INR",
      beta: "0.74",
    },
    companyProfile: {
      about:
        "HDB Financial Services Limited (HDBFS) is a leading Non-Banking Financial Company (NBFC) backed by HDFC Bank. Catering to the growing needs of both retail and commercial clients across India, HDBFS offers personal loans, business loans, commercial vehicle loans, and asset finance...",
      aboutExtended:
        " through an extensive network of over 1,680 branches across more than 1,100 cities and towns in India.",
      sector: "Finance",
      industry: "Retail & Commercial NBFC",
      ceo: "Ramesh Ganesan",
      website: "www.hdbfs.com",
    },
    series1M: [
      1060, 1068, 1072, 1065, 1078, 1085, 1082, 1094, 1102, 1098, 1110, 1118,
      1115, 1126, 1134, 1130, 1142, 1148, 1145, 1154, 1160, 1156, 1165, 1172,
      1168, 1175, 1180,
    ],
  },
  {
    id: "swiggy",
    ticker: "SWIGGY",
    name: "SWIGGY LIMITED",
    price: 460,
    currency: "INR",
    changeAmount: "+8.6",
    changePercent: "+1.92%",
    isPositive: true,
    exchange: "NSE / BSE India",
    lastUpdated: "Today, 15:30 IST",
    logoBg: "#F4F4F5",
    logoText: "SWG",
    logoType: "goto",
    technicalRating: {
      label: "Buy",
      score: 68,
      color: "#2563EB",
    },
    analystRating: {
      label: "Buy",
      score: 70,
      color: "#4D9A78",
    },
    stats: {
      marketCap: "1.03 L Cr",
      marketCapCurrency: "INR",
      dividendYield: "0.00%",
      basicEps: "10.4",
      basicEpsCurrency: "INR",
      peRatio: "44.2",
      netIncome: "1,120 Cr",
      netIncomeCurrency: "INR",
      revenue: "11,247 Cr",
      revenueCurrency: "INR",
      sharesFloat: "223.8 Cr",
      sharesFloatCurrency: "INR",
      beta: "0.94",
    },
    companyProfile: {
      about:
        "Swiggy Limited is India's pioneering on-demand convenience platform, operating food delivery, Swiggy Instamart quick-commerce grocery delivery, Dineout restaurant reservations, and Genie hyperlocal pick-up and drop services across hundreds of Indian cities...",
      aboutExtended:
        " connecting hundreds of thousands of restaurant partners, dark stores, and delivery executives with millions of Indian consumers daily.",
      sector: "Technology Services",
      industry: "Quick Commerce & Food Tech",
      ceo: "Sriharsha Majety",
      website: "www.swiggy.com",
    },
    series1M: [
      412, 415, 418, 414, 420, 424, 422, 428, 432, 430, 435, 439, 436, 441,
      445, 443, 448, 451, 449, 453, 456, 454, 458, 460,
    ],
  },
];

export function getStockById(rawId: string): StockDetail {
  const normalized = rawId.trim().toLowerCase();
  const found = stocksCatalog.find(
    (s) => s.id === normalized || s.ticker.toLowerCase() === normalized
  );

  if (found) return found;

  const upper = rawId.trim().toUpperCase();
  return {
    ...stocksCatalog[0],
    id: normalized,
    ticker: upper,
    name: `${upper} INDIA LIMITED`,
    logoBg: "#2563EB",
    logoText: upper.slice(0, 4),
    logoType: "initial",
    initial: upper.charAt(0) || "I",
  };
}
