"use client";

import { Button } from "../ui/button";
import { useTestApi } from "../../hooks/use-test";
import { useTestStore } from "../../store/test-store";

/**
 * DebugPanel Component
 * 
 * Displays verification UI for testing the application setup.
 * Should only be rendered in development environment.
 * 
 * Tests:
 * - Tailwind CSS styling
 * - Shadcn/ui components
 * - Environment variables configuration
 * - Axios API client connectivity
 * - Zustand state management
 */
export function DebugPanel() {
  // Test Axios API client
  const { data: healthData, error: healthError, loading: healthLoading } = useTestApi();

  // Test Zustand store
  const { count, message, increment, decrement } = useTestStore();

  // Get environment variables
  const authServiceUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
  const stocksServiceUrl = process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL;

  const handleShadcnTest = () => {
    // Use console.log instead of alert for better UX
    console.log(" Shadcn/ui Button clicked - component is working!");
    // Optional: Could use toast notification instead when toast is set up
  };

  return (
    <div className="space-y-4 my-8">
      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">🔧 Development Debug Panel</h2>
        <p className="text-sm text-muted-foreground mb-6">
          This panel is only visible in development mode to verify the application setup.
        </p>
      </div>

      {/* Tailwind CSS Verification */}
      <div className="bg-blue-500 p-4 text-white rounded-lg">
        Tailwind CSS is working! This is a blue box with padding and rounded corners.
      </div>

      {/* Shadcn/ui Button Test */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-bold mb-2">Shadcn/ui Component Test:</h3>
        <Button onClick={handleShadcnTest} className="my-2">
          Click to test Shadcn Button (check console)
        </Button>
      </div>

      {/* Environment Variables Display */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-bold mb-2">Environment Variables:</h3>
        {authServiceUrl ? (
          <p className="text-green-600"> AUTH_SERVICE_URL: {authServiceUrl}</p>
        ) : (
          <p className="text-red-600">❌ AUTH_SERVICE_URL: undefined (check .env.local)</p>
        )}
        {stocksServiceUrl ? (
          <p className="text-green-600"> STOCKS_SERVICE_URL: {stocksServiceUrl}</p>
        ) : (
          <p className="text-red-600">❌ STOCKS_SERVICE_URL: undefined (check .env.local)</p>
        )}
      </div>

      {/* API Health Check Test */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-bold mb-2">API Health Check (Axios Test):</h3>
        {healthLoading && <p className="text-gray-600">Loading...</p>}
        {healthError && (
          <p className="text-red-600">❌ Error: {healthError}</p>
        )}
        {healthData && (
          <p className="text-green-600">
            Connected to auth-service: {JSON.stringify(healthData)}
          </p>
        )}
      </div>

      {/* Zustand Store Test */}
      <div className="p-4 border rounded-lg">
        <h3 className="font-bold mb-2">Zustand State Management Test:</h3>
        <p className="mb-2">Count: <strong>{count}</strong></p>
        <p className="mb-2">Message: <em>{message}</em></p>
        <div className="flex gap-2">
          <Button onClick={increment} variant="default">
            Increment
          </Button>
          <Button onClick={decrement} variant="outline">
            Decrement
          </Button>
        </div>
      </div>
    </div>
  );
}
