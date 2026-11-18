const actions = [
  { label: "Dashboard", emoji: "📈" },
  { label: "Portfolio", emoji: "💼" },
  { label: "Watchlist", emoji: "📊" },
  { label: "Orders", emoji: "💬" },
  { label: "Transaction", emoji: "💸" },
];

export default function QuickActions() {
  return (
    <section className="text-center mt-10 sm:mt-16 px-2">
      <h2 className="text-2xl sm:text-3xl font-semibold">Quick Actions</h2>
      <p className="text-sm sm:text-md text-gray-500 mt-1">
        What would you like to do today?
      </p>

      {/* Responsive Grid */}
      <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-10 lg:gap-16 place-items-center">
        {actions.map((action, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-2 sm:gap-3 cursor-pointer w-full max-w-[140px]"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 flex items-center justify-center shadow-sm">
              <span className="text-2xl sm:text-3xl">{action.emoji}</span>
            </div>

            <span className="text-xs sm:text-sm text-gray-700">
              {action.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
