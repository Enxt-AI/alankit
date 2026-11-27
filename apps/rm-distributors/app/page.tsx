import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="max-w-4xl w-full flex flex-col gap-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Unlisted stocks</h1>
          <p className="text-muted-foreground text-lg">
            Please select your login type to continue
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/login/branch" className="block outline-none group">
            <Card className="h-full transition-all duration-200 border-border group-hover:border-primary group-hover:shadow-md cursor-pointer bg-card">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-secondary text-primary flex items-center justify-center mb-4 transition-colors group-hover:bg-primary/10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                    <path d="M10 6h4" />
                    <path d="M10 10h4" />
                    <path d="M10 14h4" />
                    <path d="M10 18h4" />
                  </svg>
                </div>
                <CardTitle className="text-xl"> Branch</CardTitle>
                <CardDescription className="text-sm mt-2 leading-relaxed">
                  Access your branch portal to manage internal relationship
                  managers and oversee internal sales.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/login/distributor" className="block outline-none group">
            <Card className="h-full transition-all duration-200 border-border group-hover:border-primary group-hover:shadow-md cursor-pointer bg-card">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-secondary text-primary flex items-center justify-center mb-4 transition-colors group-hover:bg-primary/10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <CardTitle className="text-xl">Distributor</CardTitle>
                <CardDescription className="text-sm mt-2 leading-relaxed">
                  Access your distributor portal to manage partner relationship
                  managers, track commissions, and view sales metrics.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/login/rm" className="block outline-none group">
            <Card className="h-full transition-all duration-200 border-border group-hover:border-primary group-hover:shadow-md cursor-pointer bg-card">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-secondary text-primary flex items-center justify-center mb-4 transition-colors group-hover:bg-primary/10">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <CardTitle className="text-xl">Relationship Manager</CardTitle>
                <CardDescription className="text-sm mt-2 leading-relaxed">
                  Manage distributors, oversee network growth, and resolve
                  account approvals.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
