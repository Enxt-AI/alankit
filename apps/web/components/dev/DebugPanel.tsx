"use client";

import { Button } from "../ui/button";
import { useTestApi } from "../../hooks/use-test";
import { useTestStore } from "../../store/test-store";

export function DebugPanel() {
  // Test Axios API client
  const { data: healthData, error: healthError, loading: healthLoading } = useTestApi();

  // Test Zustand store
  const { count, message, increment, decrement } = useTestStore();

  const handleShadcnTest = () => {
    console.log(" Shadcn/ui Button clicked - component is working!");
  };

  // Structured env groups matching configuration sections
  const envGroups = [
    {
      title: "1. Core Application Configuration",
      items: [
        {
          key: "NODE_ENV",
          val: process.env.NODE_ENV,
          scope: "Client/Build",
          desc: "'development' or 'production'",
        },
        {
          key: "NEXT_PUBLIC_APP_URL",
          val: process.env.NEXT_PUBLIC_APP_URL,
          scope: "Client",
          desc: "Public-facing URL of the frontend",
        },
        {
          key: "NEXT_PUBLIC_REDIRECT_AUTHED_TO_DASHBOARD",
          val: process.env.NEXT_PUBLIC_REDIRECT_AUTHED_TO_DASHBOARD,
          scope: "Client",
          desc: "Redirect authenticated users to /dashboard",
        },
      ],
    },
    {
      title: "2. Microservices Endpoints",
      items: [
        {
          key: "NEXT_PUBLIC_AUTH_SERVICE_URL",
          val: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL,
          scope: "Client",
          desc: "Auth service routing destination",
        },
        {
          key: "NEXT_PUBLIC_STOCKS_SERVICE_URL",
          val: process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL,
          scope: "Client",
          desc: "Stocks service routing destination",
        },
        {
          key: "NEXT_PUBLIC_TICKETING_SERVICE_URL",
          val: process.env.NEXT_PUBLIC_TICKETING_SERVICE_URL,
          scope: "Client",
          desc: "Ticketing service routing destination",
        },
        {
          key: "NEXT_PUBLIC_PAYMENTS_SERVICE_URL",
          val: process.env.NEXT_PUBLIC_PAYMENTS_SERVICE_URL,
          scope: "Client",
          desc: "Payments service routing destination",
        },
        {
          key: "NEXT_PUBLIC_STORAGE_SERVICE_URL",
          val: process.env.NEXT_PUBLIC_STORAGE_SERVICE_URL,
          scope: "Client",
          desc: "Storage service routing destination",
        },
        {
          key: "NEXT_PUBLIC_STORAGE_API_URL",
          val: process.env.NEXT_PUBLIC_STORAGE_API_URL,
          scope: "Client",
          desc: "Storage public API routing destination",
        },
      ],
    },
    {
      title: "3. Third-Party Integrations",
      items: [
        {
          key: "NEXT_PUBLIC_GTM_ID",
          val: process.env.NEXT_PUBLIC_GTM_ID,
          scope: "Client/Build",
          desc: "Google Tag Manager Container ID",
        },
        {
          key: "NEXT_PUBLIC_META_PIXEL_ID",
          val: process.env.NEXT_PUBLIC_META_PIXEL_ID,
          scope: "Client/Build",
          desc: "Meta (Facebook) Pixel ID",
        },
        {
          key: "NEXT_PUBLIC_DIGITAP_ENV",
          val: process.env.NEXT_PUBLIC_DIGITAP_ENV,
          scope: "Client",
          desc: "Aadhaar eSign environment ('uat' | 'production')",
        },
        {
          key: "NEXT_PUBLIC_CASHFREE_ENVIRONMENT",
          val: process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT,
          scope: "Client",
          desc: "Cashfree payment gateway ('sandbox' | 'production')",
        },
      ],
    },
    {
      title: "4. Debugging & Development",
      items: [
        {
          key: "NEXT_PUBLIC_DEBUG_AUTH",
          val: process.env.NEXT_PUBLIC_DEBUG_AUTH,
          scope: "Client",
          desc: "Verbose console logs for auth flows",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 my-8 max-w-5xl mx-auto">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold tracking-tight">🔧 Web Application Debug Panel</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect client-side (NEXT_PUBLIC_*) build-time environment variables and service connectivity.
        </p>
      </div>

      {/* Tailwind & Component Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-600 p-4 text-white rounded-lg flex items-center justify-between shadow-sm">
          <div>
            <p className="font-semibold text-sm">Tailwind CSS Test</p>
            <p className="text-xs text-blue-100 mt-0.5">Classes and layout compilation active</p>
          </div>
          <span className="text-xl">🎨</span>
        </div>

        <div className="p-4 border rounded-lg bg-card flex items-center justify-between shadow-sm">
          <div>
            <p className="font-semibold text-sm">Shadcn / UI Button Test</p>
            <p className="text-xs text-muted-foreground mt-0.5">Verifies component event wiring</p>
          </div>
          <Button onClick={handleShadcnTest} size="sm" variant="outline">
            Test Click
          </Button>
        </div>
      </div>

      {/* Environment Variables Breakdown */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold border-b pb-2">Environment Variables Inspection</h3>

        {envGroups.map((group) => (
          <div key={group.title} className="border rounded-lg overflow-hidden bg-card shadow-sm">
            <div className="bg-muted/50 px-4 py-2.5 border-b font-semibold text-sm text-foreground flex items-center justify-between">
              <span>{group.title}</span>
            </div>
            <div className="divide-y text-sm">
              {group.items.map((item) => {
                const isSet = item.val !== undefined && item.val !== null && item.val !== "";
                return (
                  <div
                    key={item.key}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20 transition-colors font-mono"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-xs sm:text-sm">{item.key}</span>
                        <span className="text-[10px] uppercase font-sans tracking-wider px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {item.scope}
                        </span>
                      </div>
                      {item.desc && (
                        <span className="text-[11px] font-sans text-muted-foreground mt-0.5">{item.desc}</span>
                      )}
                    </div>

                    <div className="flex items-center">
                      {isSet ? (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded break-all max-w-md">
                          {String(item.val)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded">
                          undefined (not set)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* API Health Check */}
      <div className="p-4 border rounded-lg bg-card shadow-sm space-y-2">
        <h3 className="font-bold text-sm">API Connectivity (Auth Service Health Test):</h3>
        {healthLoading && <p className="text-xs text-muted-foreground">Pinging auth-service...</p>}
        {healthError && (
          <p className="text-xs font-mono text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 p-2 rounded">
            ❌ Connection error: {healthError}
          </p>
        )}
        {healthData && (
          <p className="text-xs font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 p-2 rounded">
             {healthData.message || "Connected to auth-service"} (Status: {healthData.statusCode || 200})
          </p>
        )}
      </div>

      {/* Zustand Store State */}
      <div className="p-4 border rounded-lg bg-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm">Zustand State Test:</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Count: <strong className="text-foreground">{count}</strong> | Message: <em>{message}</em>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={increment} size="sm" variant="default">
            Increment (+1)
          </Button>
          <Button onClick={decrement} size="sm" variant="outline">
            Decrement (-1)
          </Button>
        </div>
      </div>
    </div>
  );
}
