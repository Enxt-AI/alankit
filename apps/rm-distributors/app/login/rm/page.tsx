"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth-headers";
import { resolveApiUrl } from "@/lib/api-fetch";

export default function RMLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rmType, setRmType] = useState<"internal" | "distributor">("internal");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const endpoint = rmType === "internal" ? "/api/auth/internal-rm/login" : "/api/auth/distributor-rm/login";
      
      const response = await fetch(resolveApiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ 
          email: email.trim(), 
          password: password.trim() 
        }),
      });

      let data: any = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        let errorText = 'Failed to sign in';
        if (data && data.message) {
          const msg = data.message;
          if (typeof msg === 'string') {
            errorText = msg;
          } else if (Array.isArray(msg)) {
            // NestJS ValidationPipe returns [{ property, constraints: { rule: "message" } }]
            const texts = msg.map((m: any) => {
              if (typeof m === 'string') return m;
              if (m?.constraints) return Object.values(m.constraints).join(', ');
              return String(m);
            });
            errorText = texts.join('. ');
          }
        } else {
          // Map HTTP status codes to user-friendly messages
          if (response.status === 401) {
            errorText = 'Invalid email or password. Please try again.';
          } else if (response.status === 429) {
            errorText = 'Too many login attempts. Please try again later.';
          } else if (response.status >= 500) {
            errorText = 'We\'re experiencing temporary issues. Please try again in a few moments.';
          } else {
            errorText = 'Unable to sign in. Please try again.';
          }
        }
        throw new Error(errorText);
      }

      // Login successful, cookie is set. Redirect to dashboard.
      router.push("/rm");
    } catch (err: any) {
      const msg = err.message || 'Something went wrong. Please try again.';
      // Sanitize any leaked technical details
      if (msg.includes('ECONNREFUSED') || msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
        setError('Unable to connect. Please check your internet connection and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-1"><path d="m15 18-6-6 6-6"/></svg>
          Back to roles
        </Link>
        
        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight">RM Login</CardTitle>
            <CardDescription>
              Sign in to your Relationship Manager portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm font-medium text-red-500 bg-red-50 rounded-md border border-red-100">
                  {error}
                </div>
              )}
              
              <div className="relative flex p-1 bg-muted/50 rounded-lg mb-4">
                {/* Green Sliding Slug */}
                <div
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#16A34A] rounded-md transition-transform duration-300 ease-in-out shadow-sm ${
                    rmType === "internal" ? "translate-x-0" : "translate-x-full ml-1"
                  }`}
                />
                <button
                  type="button"
                  className={`relative z-10 w-1/2 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
                    rmType === "internal" ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setRmType("internal")}
                >
                  SMC Branch RM
                </button>
                <button
                  type="button"
                  className={`relative z-10 w-1/2 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
                    rmType === "distributor" ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setRmType("distributor")}
                >
                  Distributor RM
                </button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Employee Email</Label>
                <Input 
                  type="email" 
                  id="email" 
                  placeholder="employee@smc.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href={`/change-password?portal=${rmType === "internal" ? "internal-rm" : "distributor-rm"}`} className="text-sm font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    id="password" 
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In as RM"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
