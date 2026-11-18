// types/stock.ts
export type PricePoint = {
  label: string;
  price: number;
};

export type Stock = {
  name: string;
  isin: string;
  price: string;
  change: string;
  up: boolean;
  faceValue: string;
  description: string;

  fundamentals: { label: string; value: string }[];

  financials: {
    metric: string;
    y2021: string;
    y2022: string;
    y2023: string;
    yoy: string;
    positive: boolean;
  }[];

  board: string[];
  reports: string[];

  priceHistory: {
    "1M": PricePoint[];
    "3M": PricePoint[];
    "6M": PricePoint[];
    "1Y": PricePoint[];
    "5Y": PricePoint[];
    "All": PricePoint[];
  };
};
