import {
  Wallet,
  TrendingUp,
  Coins,
  BarChart3,
} from "lucide-react";

type StatItem = {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
};

const stats: StatItem[] = [
  {
    title: "Total Value",
    value: "₹12,45,890",
    change: "+12.5% from last month",
    icon: Wallet,
  },
  {
    title: "Current P&L",
    value: "+₹8,450",
    change: "+2.8% vs yesterday",
    icon: TrendingUp,
  },
  {
    title: "Total Invested",
    value: "₹9,85,000",
    change: "Across 24 assets",
    icon: Coins,
  },
  {
    title: "Returns",
    value: "+₹2,60,890",
    change: "+26.5% total returns",
    icon: BarChart3,
  },
];

export default function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}

/* ---------------- Stat Card ---------------- */

function StatCard({
  title,
  value,
  change,
  icon: Icon,
}: StatItem) {
  return (
    <div className="bg-black rounded-2xl p-5 text-white flex justify-between items-start">
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <h2 className="text-xl font-semibold mt-1">{value}</h2>
        <p className="text-green-500 text-xs mt-1">{change}</p>
      </div>

      <div className="bg-green-600/20 p-2 rounded-lg text-green-400">
        <Icon size={20} />
      </div>
    </div>
  );
}
