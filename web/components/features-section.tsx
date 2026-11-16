import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="w-full bg-white py-16 sm:py-24 overflow-hidden scroll-mt-16"
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10 space-y-24 sm:space-y-32">
        {/* Top Feature Row: Watchlist UI + "Easily monitor stock movements on GoStock" */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Purple Gradient Card with Watchlist UI */}
          <ScrollReveal variant="fade-left" delayMs={80} className="mx-auto w-full max-w-[440px]">
            <div className="relative flex items-center justify-center rounded-4xl bg-linear-to-br from-[#2E1A68] via-[#1D1046] to-[#11092B] p-7 sm:p-10 shadow-xl">
              {/* Subtle radial glow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-4xl bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.28),transparent_65%)]"
                aria-hidden="true"
              />

              {/* Inner White Watchlist Card */}
              <div className="relative w-full max-w-[310px] rounded-2xl bg-white/95 py-5 shadow-lg">
                {/* Watchlist Header */}
                <div className="flex items-center justify-between px-5 pb-3">
                  <span className="text-sm font-semibold text-zinc-900">
                    My watchlist
                  </span>
                  <Plus className="size-4 text-zinc-400" />
                </div>

                {/* Row 1: Spotify */}
                <div className="flex items-center justify-between px-5 py-2.5 opacity-80">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-[#1ED760]/15">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" fill="#1ED760" />
                        <path
                          d="M7.5 10C10.8 9 14.5 9.3 17 10.8M8 13C10.8 12.2 13.8 12.5 16 13.7M8.8 15.8C11 15.2 13.4 15.4 15.2 16.4"
                          stroke="white"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 leading-tight">
                        SPOT
                      </p>
                      <p className="text-[10px] text-zinc-400">Spotify</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-zinc-900">
                      $310,40
                    </p>
                    <p className="text-[10px] font-medium text-rose-500">
                      - 1,10%
                    </p>
                  </div>
                </div>

                {/* Row 2: Popped-out Active Row (Airbnb) */}
                <div className="relative z-10 -mx-5 my-1.5 flex items-center justify-between rounded-2xl bg-white px-5 py-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-10 items-center justify-center rounded-full bg-[#FF5A5F]">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M12 4.5C9.5 8.5 6.5 13.2 6.5 16C6.5 18.2 8.2 19.5 10 19.5C11.1 19.5 12 18.8 12 18.8C12 18.8 12.9 19.5 14 19.5C15.8 19.5 17.5 18.2 17.5 16C17.5 13.2 14.5 8.5 12 4.5Z"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="14.5"
                          r="2"
                          stroke="white"
                          strokeWidth="1.6"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900 leading-tight">
                        ABNB
                      </p>
                      <p className="text-xs text-zinc-400">Airbnb</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zinc-900">$132,72</p>
                    <p className="text-xs font-semibold text-rose-500">
                      - 10,29%
                    </p>
                  </div>
                </div>

                {/* Row 3: Sony PlayStation */}
                <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-2.5 opacity-80">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-blue-50">
                      <span className="text-xs font-black italic text-[#00439C]">
                        PS
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 leading-tight">
                        SONY
                      </p>
                      <p className="text-[10px] text-zinc-400">Playstation</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-zinc-900">
                      $71,86
                    </p>
                    <p className="text-[10px] font-medium text-emerald-500">
                      + 0,98%
                    </p>
                  </div>
                </div>

                {/* Row 4: PayPal */}
                <div className="flex items-center justify-between px-5 pt-2.5 opacity-80">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-blue-50">
                      <span className="text-sm font-black italic text-[#003087]">
                        P
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 leading-tight">
                        PYPL
                      </p>
                      <p className="text-[10px] text-zinc-400">Paypal</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-zinc-900">
                      $87,66
                    </p>
                    <p className="text-[10px] font-medium text-rose-500">
                      - 3,86%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right: Text Content */}
          <ScrollReveal variant="fade-right" delayMs={200} className="max-w-md">
            <h2 className="text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl sm:leading-[1.2]">
              Easily monitor
              <br />
              stock movements
              <br />
              on{" "}
              <span className="bg-linear-to-r from-[#6366F1] to-[#60A5FA] bg-clip-text text-transparent">
                GoStock
              </span>
            </h2>

            <p className="mt-4 text-xs sm:text-sm leading-relaxed text-zinc-500">
              Monitor the stocks you are after in real time
              <br className="hidden sm:inline" /> and of course easily and
              accurately
            </p>

            <ul className="mt-6 space-y-3">
              <li className="flex items-center gap-3 text-xs sm:text-sm text-zinc-600">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <Check className="size-3 stroke-[2.5]" />
                </span>
                <span>Monitor stocks easily and accurately</span>
              </li>
              <li className="flex items-center gap-3 text-xs sm:text-sm text-zinc-600">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <Check className="size-3 stroke-[2.5]" />
                </span>
                <span>Get regular reports on the shares you own</span>
              </li>
            </ul>

            <div className="mt-8">
              <Button className="h-11 rounded-full bg-zinc-950 px-7 text-xs sm:text-sm font-medium text-white hover:bg-zinc-800 cursor-pointer">
                Learn more
              </Button>
            </div>
          </ScrollReveal>
        </div>

        {/* Bottom Feature Row: "A wide variety of stocks..." + Stacked Apple Portfolio Card */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Text Content */}
          <ScrollReveal variant="fade-left" delayMs={80} className="max-w-md">
            <span className="inline-block rounded-full bg-zinc-100 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700">
              GET A LOT OF INVESTMENT EASY
            </span>

            <h2 className="mt-5 text-3xl font-medium tracking-tight text-zinc-900 sm:text-4xl sm:leading-[1.2]">
              A wide variety of
              <br />
              stocks from all over
              <br />
              the world
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <svg
                  className="mt-0.5 size-4 shrink-0 text-zinc-900"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
                <p className="text-xs leading-relaxed text-zinc-500">
                  Starting from local stocks, US stocks you can find and you can
                  buy here
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <svg
                  className="mt-0.5 size-4 shrink-0 text-zinc-900"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
                <p className="text-xs leading-relaxed text-zinc-500">
                  You can buy international stocks easily and quickly only on
                  GoStock
                </p>
              </div>
            </div>
          </ScrollReveal>

          {/* Right: Purple Gradient Card with Stacked Apple Share Cards */}
          <ScrollReveal variant="fade-right" delayMs={200} className="mx-auto w-full max-w-[440px]">
            <div className="relative flex min-h-[380px] items-center justify-center rounded-4xl bg-linear-to-br from-[#2E1A68] via-[#1D1046] to-[#11092B] p-7 sm:p-10 shadow-xl overflow-hidden">
              {/* Subtle radial glow */}
              <div
                className="pointer-events-none absolute inset-0 rounded-4xl bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.28),transparent_65%)]"
                aria-hidden="true"
              />

              <div className="relative w-full max-w-[310px] pb-16">
                {/* Bottom Peeking Card 3 */}
                <div className="absolute -bottom-1 left-6 right-4 rotate-[4deg] rounded-2xl bg-white/90 px-5 py-3.5 shadow-md">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Total Shares</span>
                    <span className="font-semibold text-zinc-900">$310,40</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Total Return</span>
                    <span className="font-semibold text-rose-500">
                      - 1,10% ↓
                    </span>
                  </div>
                </div>

                {/* Middle Peeking Card 2 */}
                <div className="absolute bottom-7 left-3 right-3 -rotate-[5deg] rounded-2xl bg-white/95 px-5 py-4 shadow-lg ring-1 ring-black/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Total Return</span>
                    <span className="font-semibold text-emerald-500">
                      + 0,80% ↑
                    </span>
                  </div>
                </div>

                {/* Top Main Card: Apple */}
                <div className="relative z-10 rounded-2xl bg-white p-6 shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
                  {/* Top Row: Apple Logo + Name + Sparkline */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full bg-zinc-950 text-white">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M17.05 20.28C16.07 21.23 15 21.08 13.97 20.63C12.88 20.17 11.88 20.15 10.73 20.63C9.29 21.25 8.53 21.07 7.67 20.28C2.79 15.25 3.51 7.59 9.05 7.31C10.4 7.38 11.34 8.05 12.13 8.11C13.31 7.87 14.44 7.18 15.7 7.27C17.21 7.39 18.35 7.99 19.1 9.07C15.98 10.94 16.72 15.05 19.58 16.2C19.01 17.7 18.26 19.18 17.05 20.28ZM12.03 7.25C11.88 5.02 13.69 3.18 15.77 3C16.06 5.58 13.43 7.5 12.03 7.25Z" />
                        </svg>
                      </div>
                      <span className="text-base font-semibold text-zinc-900">
                        Apple
                      </span>
                    </div>

                    {/* Mini Red Sparkline Chart */}
                    <svg
                      width="68"
                      height="32"
                      viewBox="0 0 68 32"
                      fill="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient
                          id="apple-spark"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#F43F5E" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M2 12L10 6L16 11L22 5L30 20L38 20L45 18L52 24L60 22L66 25V30H2V12Z"
                        fill="url(#apple-spark)"
                      />
                      <path
                        d="M2 12L10 6L16 11L22 5L30 20L38 20L45 18L52 24L60 22L66 25"
                        stroke="#E11D48"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* Metrics */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-zinc-400">Total Shares</span>
                      <span className="font-semibold text-zinc-900">
                        $310,40
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-zinc-400">Total Return</span>
                      <span className="font-semibold text-rose-500">
                        - 1,10% ↓
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

