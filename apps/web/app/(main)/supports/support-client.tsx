"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Search, Phone, MessageCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FaqAccordion } from "@/components/support/faq-accordion";
import { MobileFaqSection } from "@/components/support/mobile-faq-section";
import { TicketForm } from "@/components/support/ticket-form";
import { TicketTable } from "@/components/support/ticket-table";

export function SupportClient() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?returnUrl=/supports");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <p className="text-xs text-muted-foreground font-medium">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
      {/* 1. Header & Search Section */}
      <div className="text-center space-y-3 sm:space-y-6 py-4 sm:py-8">
        <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#1A2530] leading-tight">
          How can we help you today?
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm max-w-xl mx-auto px-2">
          Search our knowledge base or raise a support ticket for assistance.
        </p>

        <div className="max-w-2xl mx-auto relative px-1 sm:px-4 pt-1">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search issues like 'Payment', 'KYC', 'Order'..."
              className="pl-10 h-11 sm:h-12 bg-white shadow-2xs border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus-visible:ring-green-500/20 focus-visible:border-green-600"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        {/* 2. Left Column: Submit a Request Form */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card className="border border-slate-200/80 shadow-2xs rounded-2xl sm:rounded-2xl bg-white">
            <CardHeader className="p-3.5 sm:p-6 pb-2 sm:pb-4 border-b border-slate-100">
              <CardTitle className="text-base sm:text-lg font-bold text-[#1A2530]">Submit a Request</CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-6 pt-3 sm:pt-4">
              <TicketForm />
            </CardContent>
          </Card>
        </div>

        {/* 3. Right Column: Sidebar (Tickets & Help) */}
        <div className="space-y-4 sm:space-y-6">
          {/* Your Tickets Widget */}
          <TicketTable
            onTicketClick={(id) => router.push(`/dashboard/tickets/${id}`)}
          />

          {/* Urgent Help Widget */}
          <div className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 p-4 sm:p-6 text-white shadow-md relative overflow-hidden">
            {/* Background decoration */}
            <Phone className="absolute -right-6 -bottom-6 h-28 w-28 text-white opacity-10 pointer-events-none" />

            <h3 className="text-base sm:text-lg font-bold mb-1">Need urgent help?</h3>
            <p className="text-green-50 text-xs sm:text-sm mb-4 leading-relaxed">
              Our support line is available from 10:00 AM to 6:00 PM from Monday to Friday for Clients.
            </p>
            {/* Mobile (tel link + WhatsApp chat) */}
            <div className="flex gap-2 sm:hidden">
              <a href="tel:+919911944094" className="inline-block flex-1">
                <Button className="bg-white text-green-700 hover:bg-green-50 w-full h-10 rounded-xl text-xs font-bold shadow-xs">
                  <Phone className="mr-1.5 h-3.5 w-3.5" /> Call Support
                </Button>
              </a>
              <a
                href="https://wa.me/919911944094"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block flex-1"
              >
                <Button className="bg-white text-green-700 hover:bg-green-50 w-full h-10 rounded-xl text-xs font-bold shadow-xs">
                  <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Chat Support
                </Button>
              </a>
            </div>

            {/* Desktop (Dialog + WhatsApp chat) */}
            <div className="hidden sm:flex gap-2">
              <div className="flex-1 min-w-0">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-white text-green-700 hover:bg-green-50 w-full h-11 rounded-xl text-sm font-bold shadow-xs">
                      <Phone className="mr-2 h-4 w-4" /> Call Support
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 border border-slate-200">
                    <DialogHeader>
                      <DialogTitle className="text-center text-lg font-bold text-[#1A2530]">Premium Support</DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 pt-2 text-center">
                        <a
                          href="tel:+919911944094"
                          className="font-extrabold text-green-600 text-xl sm:text-2xl mt-3 block hover:underline"
                        >
                          +91 99119 44094
                        </a>
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
              </div>
              <a
                href="https://wa.me/919911944094"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
              >
                <Button className="bg-white text-green-700 border border-white/40 hover:bg-white/20 w-full h-11 rounded-xl text-sm font-bold shadow-xs">
                  <MessageCircle className="mr-2 h-4 w-4" /> Chat Support
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only FAQ (grouped accordion) */}
      <div className="md:hidden">
        <MobileFaqSection />
      </div>

      {/* 4. Bottom Section: FAQs (desktop) */}
      <div className="hidden md:block max-w-7xl mx-auto">
        <Card className="border border-slate-200/80 shadow-2xs rounded-2xl bg-white">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-[#1A2530]">
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <FaqAccordion />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
