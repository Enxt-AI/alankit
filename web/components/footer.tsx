import Link from "next/link";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const footerColumns = [
  {
    title: "Join Us",
    links: [
      { label: "Join", href: "#join" },
      { label: "Log In", href: "#login" },
    ],
  },
  {
    title: "Information",
    links: [
      { label: "About Us", href: "#about" },
      { label: "Management", href: "#management" },
      { label: "Governance", href: "#governance" },
      { label: "Legal", href: "#legal" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Glossary", href: "#glossary" },
      { label: "Help Center", href: "#help-center" },
      { label: "Announcements", href: "#announcements" },
    ],
  },
  {
    title: "Investment",
    links: [
      { label: "Stocks", href: "#stocks" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="w-full bg-[#F7F9FA] text-zinc-900">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        {/* Top App Download Banner */}
        <ScrollReveal variant="fade-up">
          <div className="flex flex-col items-start justify-between gap-6 border-y border-zinc-200/80 py-8 md:flex-row md:items-center">
            <div>
              <p className="text-lg font-normal leading-snug text-zinc-900 sm:text-[21px]">
                Join 10,000+ young investors
                <br />
                Download the app
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Bottom 5-Column Links & Contact Info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 pt-12 pb-8 sm:grid-cols-3 lg:grid-cols-5">
          {footerColumns.map((col, idx) => (
            <ScrollReveal
              key={col.title}
              variant="fade-up"
              delayMs={80 + idx * 80}
            >
              <h4 className="text-sm font-medium text-zinc-900">{col.title}</h4>
              <ul className="mt-6 space-y-3.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs sm:text-[13px] text-zinc-600 transition-colors hover:text-zinc-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          ))}

          {/* Column 5: Contact Us */}
          <ScrollReveal variant="fade-up" delayMs={400}>
            <h4 className="text-sm font-medium text-zinc-900">Contact Us</h4>
            <div className="mt-6 space-y-3.5 text-xs sm:text-[13px] text-zinc-600">
              <p>PT Sekuritas</p>
              <p className="leading-relaxed">
                Jl. Raya Buntu No. 120
                <br />
                Southwest Jakarta
              </p>
            </div>

            {/* Social Media Buttons */}
            <div className="mt-5 flex items-center gap-2.5">
              {/* Facebook */}
              <a
                href="#facebook"
                aria-label="Facebook"
                className="flex size-8 items-center justify-center rounded-md bg-white text-zinc-900 shadow-2xs ring-1 ring-zinc-200/60 transition-colors hover:bg-zinc-50"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13.5 9H16V6H13.5C11.57 6 10 7.57 10 9.5V12H8V15H10V21H13V15H15.5L16 12H13V9.5C13 9.22 13.22 9 13.5 9Z" />
                </svg>
              </a>

              {/* X (Twitter) */}
              <a
                href="#x"
                aria-label="X"
                className="flex size-8 items-center justify-center rounded-md bg-white text-zinc-900 shadow-2xs ring-1 ring-zinc-200/60 transition-colors hover:bg-zinc-50"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* LinkedIn */}
              <a
                href="#linkedin"
                aria-label="LinkedIn"
                className="flex size-8 items-center justify-center rounded-md bg-white text-zinc-900 shadow-2xs ring-1 ring-zinc-200/60 transition-colors hover:bg-zinc-50"
              >
                <span className="text-xs font-bold tracking-tighter">in</span>
              </a>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </footer>
  );
}
