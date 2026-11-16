import Link from "next/link";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

type StockPerfItem = {
  id: string;
  initial: string;
  name: string;
  ticker: string;
  price: string;
  change: string;
  isPositive: boolean;
};

const strongestStocks: StockPerfItem[] = [
  {
    id: "polymatech",
    initial: "P",
    name: "POLYMATECH ELECTRONICS LTD",
    ticker: "POLYMA",
    price: "₹920",
    change: "+11.40%",
    isPositive: true,
  },
  {
    id: "waaree",
    initial: "W",
    name: "WAAREE ENERGIES LIMITED",
    ticker: "WAAREE",
    price: "₹2640",
    change: "+8.20%",
    isPositive: true,
  },
  {
    id: "vikramsolar",
    initial: "V",
    name: "VIKRAM SOLAR LIMITED",
    ticker: "VIKRAM",
    price: "₹395",
    change: "+6.76%",
    isPositive: true,
  },
  {
    id: "csk",
    initial: "C",
    name: "CHENNAI SUPER KINGS CRICKET LTD",
    ticker: "CSK",
    price: "₹215",
    change: "+4.88%",
    isPositive: true,
  },
];

const weakestStocks: StockPerfItem[] = [
  {
    id: "pharmeasy",
    initial: "P",
    name: "API HOLDINGS LTD (PHARMEASY)",
    ticker: "PHARMEASY",
    price: "₹12",
    change: "-8.40%",
    isPositive: false,
  },
  {
    id: "bira91",
    initial: "B",
    name: "B9 BEVERAGES LIMITED (BIRA 91)",
    ticker: "BIRA91",
    price: "₹540",
    change: "-3.57%",
    isPositive: false,
  },
  {
    id: "paytm",
    initial: "P",
    name: "ONE 97 COMMUNICATIONS (PAYTM)",
    ticker: "PAYTM",
    price: "₹740",
    change: "-2.12%",
    isPositive: false,
  },
  {
    id: "oyo",
    initial: "O",
    name: "ORAVEL STAYS LIMITED (OYO)",
    ticker: "OYO",
    price: "₹58",
    change: "-1.69%",
    isPositive: false,
  },
];

function StockListColumn({
  title,
  items,
}: {
  title: string;
  items: StockPerfItem[];
}) {
  return (
    <div>
      <h3 className="text-lg font-normal text-zinc-800 sm:text-xl">{title}</h3>
      <div className="mt-5 flex flex-col">
        {items.map((stock) => (
          <Link
            key={stock.id}
            href={`/stocks/${stock.id}`}
            className="flex items-center justify-between gap-4 border-b border-zinc-100 py-4 transition-colors hover:bg-zinc-50/80"
          >
            {/* Left: Initial Avatar + Company Name & Ticker */}
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
                <span className="text-xs font-medium text-[#5850EC]">
                  {stock.initial}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-normal text-zinc-900">
                  {stock.name}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 uppercase">
                  {stock.ticker}
                </p>
              </div>
            </div>

            {/* Right: Price + Percentage Change Badge */}
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-sm font-normal text-zinc-900">
                {stock.price}
              </span>
              <span
                className={`mt-1 inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white ${
                  stock.isPositive ? "bg-[#4D9A78]" : "bg-[#C8524B]"
                }`}
              >
                {stock.change}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function StrongestWeakestStocks() {
  return (
    <section className="w-full bg-white pb-14 pt-2 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-2">
          <ScrollReveal variant="fade-left" delayMs={100}>
            <StockListColumn title="Strongest stocks" items={strongestStocks} />
          </ScrollReveal>

          <ScrollReveal variant="fade-right" delayMs={220}>
            <StockListColumn title="Weakest stocks" items={weakestStocks} />
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
