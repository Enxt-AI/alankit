export default function PortfolioTable() {
  const stocks = [
    { name: "Zomato Ltd", sector: "Food Tech", price: "₹145.20", change: "+5.2%" },
    { name: "Nykaa E-Retail", sector: "E-Commerce", price: "₹168.50", change: "+3.8%" },
    { name: "PolicyBazaar", sector: "InsurTech", price: "₹542.30", change: "-2.1%" },
    { name: "Delhivery Ltd", sector: "Logistics", price: "₹385.70", change: "+7.3%" },
    { name: "CarTrade Tech", sector: "Auto Tech", price: "₹625.40", change: "+4.5%" },
  ];

  return (
    <div className="bg-white rounded-2xl p-6">
      <table className="w-full text-sm">
        <thead className="text-gray-400 border-b">
          <tr>
            <th className="text-left py-2">Company</th>
            <th>Sector</th>
            <th>Current Price</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <tr key={s.name} className="border-b last:border-none">
              <td className="py-3 text-blue-600">{s.name}</td>
              <td className="text-center">{s.sector}</td>
              <td className="text-center">{s.price}</td>
              <td
                className={`text-center ${
                  s.change.startsWith("+")
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {s.change}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
