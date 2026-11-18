export default function TopCoins() {
  const coins = [
    { name: "Reliance", price: "INR 2680", qty: 50 },
    { name: "TCS", price: "INR 3580", qty: 40 },
    { name: "Infosys", price: "INR 1645", qty: 35 },
    { name: "HDFC Bank", price: "INR 875", qty: 40 },
  ];

  return (
    <div className="bg-black rounded-2xl p-6 text-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Top Performing Coins</h3>
        <button className="text-xs text-green-400">View All</button>
      </div>

      <div className="space-y-4">
        {coins.map((coin) => (
          <div
            key={coin.name}
            className="flex justify-between items-center border-b border-gray-800 pb-3"
          >
            <div>
              <p className="font-medium">{coin.name}</p>
              <p className="text-xs text-gray-400">{coin.qty}</p>
            </div>
            <p className="text-green-400 text-sm">{coin.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
