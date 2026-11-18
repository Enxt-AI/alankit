import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HiOutlineHome } from "react-icons/hi2";
import { TbError404 } from "react-icons/tb";
import { BiSearchAlt } from "react-icons/bi";

/**
 * Custom 404 Page
 *
 * Shown when a user navigates to a route that doesn't exist.
 * Provides navigation back to the home page.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background via-background to-muted/40 relative overflow-hidden">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg">

        {/* Error code */}
        <h1 className="text-7xl font-extrabold tracking-tight text-foreground/10 select-none mb-2">
          404
        </h1>

        {/* Title and description */}
        <h2 className="text-2xl font-bold text-foreground mb-3">
          Page Not Found
        </h2>
        <p className="text-muted-foreground text-base leading-relaxed mb-8 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved
          to a different location.
        </p>

        {/* CTA */}
        <Button asChild size="lg" className="gap-2.5 shadow-md bg-green-600">
          <Link href="/">
            <HiOutlineHome className="w-5 h-5" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
