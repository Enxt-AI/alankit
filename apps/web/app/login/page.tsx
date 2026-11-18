import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { OBFUSCATED_COOKIE_NAMES, ORIGINAL_COOKIE_NAMES } from "cookie-crypto/constants";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Login",
  description:
    "Sign in to your UnlistedStox account to access your portfolio, trade pre-IPO shares, and explore exclusive investment opportunities.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ clear?: string; reason?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  if (params.clear === "true") {
    try {
      const cookieStore = await cookies();
      cookieStore.delete(OBFUSCATED_COOKIE_NAMES.AUTH_TOKEN);
      cookieStore.delete(OBFUSCATED_COOKIE_NAMES.AUTH_REFRESH_TOKEN);
      cookieStore.delete(ORIGINAL_COOKIE_NAMES.AUTH_TOKEN);
      cookieStore.delete(ORIGINAL_COOKIE_NAMES.AUTH_REFRESH_TOKEN);
    } catch {
      // ignore
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
          <p className="text-sm text-gray-500">Loading Secure Login...</p>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
