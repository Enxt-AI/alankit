"use client";

import Image from "next/image";
import Link from "next/link";
import { FaInstagram, FaYoutube, FaWhatsapp, FaApple } from "react-icons/fa";
import { MapPin } from "lucide-react";
import { useIsStandalone } from "@/hooks/use-is-standalone";

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "Help & Support", href: "/supports" },
];

const MORE_LINKS = [
  { label: "Unlisted Shares", href: "/stocks" },
  { label: "Stock Baskets", href: "/baskets" },
  { label: "Market News", href: "/news" },
  { label: "Insights & Articles", href: "/articles" },
];

const LEGAL_LINKS = [
  { label: "Legal Policies", href: "/legal-policies" },
  { label: "Privacy Policy", href: "/legal-policies/privacy-policy" },
  { label: "Terms & Conditions", href: "/legal-policies/terms-and-conditions" },
  { label: "Disclaimer", href: "/legal-policies/disclaimer" },
];

const SOCIAL_ICONS = [
  { name: "Instagram", href: "https://www.instagram.com/unlistedstox/", icon: FaInstagram },
  { name: "YouTube", href: "https://www.youtube.com/@unlistedstox", icon: FaYoutube },
  { name: "WhatsApp", href: "https://wa.me/919911944094", icon: FaWhatsapp },
];

export default function Footer() {
  const { isMounted, isStandalone } = useIsStandalone();

  if (isMounted && isStandalone) return null;

  return (
    <footer className="w-full bg-[#0a0a0a] text-white border-t border-white/5">
      <div className="px-4 sm:px-6 lg:px-14 pt-10 pb-[calc(2.5rem_+_env(safe-area-inset-bottom))] md:pb-10">

        {/* Top row: brand + links */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10 lg:gap-16">

          {/* Brand */}
          <div className="flex flex-col gap-2.5 max-w-sm">
            <Image
              src="/logo2.png"
              alt="UnlistedStox"
              width={140}
              height={24}
              className="w-[130px] brightness-100"
            />
            <p className="text-[11px] text-gray-500 font-medium">SMC Investech Private Limited</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Trusted platform for unlisted &amp; pre-IPO stock investments.
            </p>
            <div className="flex items-start gap-1.5 text-xs text-gray-400 leading-relaxed">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span>3RD FLOOR 11/5 B PUSA ROAD NEW DELHI 110005</span>
            </div>
            {/* Social */}
            <div className="flex items-center gap-2.5 mt-1.5">
              {SOCIAL_ICONS.map((s) => (
                <Link
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:text-emerald-500 hover:border-emerald-500 transition-all duration-200"
                >
                  <s.icon className="w-3.5 h-3.5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Links — 4 columns */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-14 lg:gap-16">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Company</p>
              {COMPANY_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="text-xs text-gray-300 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">More</p>
              {MORE_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="text-xs text-gray-300 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Legal</p>
              {LEGAL_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="text-xs text-gray-300 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>

            {/* App Download Section */}
            <div className="flex flex-col gap-3 col-span-2 md:col-span-1 mt-4 md:mt-0">
              <div className="flex flex-col gap-1">
                <p className="text-[13px] uppercase tracking-wide text-white mb-1">GET THE APP</p>
                <p className="text-xs text-gray-400 max-w-[200px]">Invest on the go. Download our app now!</p>
              </div>
              <div className="flex flex-col gap-3 mt-1">
                {/* Google Play Button */}
                <Link
                  href="https://play.google.com/store/apps/details?id=com.unlistedstox.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#0a0a0a] border border-white/20 hover:border-emerald-500 rounded-lg px-3 py-2 transition-colors w-fit min-w-[150px]"
                >
                  <Image src="/google-play.svg" alt="Google Play" width={24} height={24} className="w-6 h-6" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-300 uppercase leading-none mb-0.5">GET IT ON</span>
                    <span className="text-[15px] font-medium text-white leading-none">Google Play</span>
                  </div>
                </Link>
                {/* App Store Button */}
                <a
                  href="https://apps.apple.com/app/unlistedstox"
                  onClick={(e) => {
                    alert("iOS app is coming soon to the App Store!");
                    e.preventDefault();
                  }}
                  className="flex items-center gap-3 bg-[#0a0a0a] border border-white/20 hover:border-emerald-500 rounded-lg px-3 py-2 transition-colors w-fit min-w-[150px] cursor-pointer"
                >
                  <FaApple className="w-7 h-7 text-white" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-300 leading-none mb-0.5">Download on the</span>
                    <span className="text-[15px] font-medium text-white leading-none">App Store</span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-8 mb-6 h-px bg-white/10" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white">
          <p>
            © {new Date().getFullYear()} SMC INVESTECH PRIVATE LIMITED. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <a href="tel:+919911944094" className="hover:text-gray-300 transition-colors">+91 9911944094</a>
            <span className="text-white/40">·</span>
            <a href="mailto:info@unlistedstox.com" className="hover:text-gray-300 transition-colors">info@unlistedstox.com</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
