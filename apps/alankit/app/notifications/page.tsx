"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCheck, CircleCheck, TrendingUp } from "lucide-react";
import { Header } from "@/components/header";

const READ_STORAGE_KEY = "alankit-read-notifications";

const notifications = [
  {
    id: "order-tatacap",
    title: "Your Tata Capital order is complete",
    message: "Your shares have been credited to your Demat account.",
    time: "02 Nov 2026",
    type: "order",
    href: "/dashboard",
  },
  {
    id: "order-nse",
    title: "Your NSE India order is complete",
    message: "Your shares have been credited to your Demat account.",
    time: "24 Oct 2026",
    type: "order",
    href: "/dashboard",
  },
  {
    id: "watchlist-update",
    title: "Keep an eye on your watchlist",
    message: "Review the latest prices and changes for your saved stocks.",
    time: "Recently",
    type: "watchlist",
    href: "/dashboard",
  },
];

export default function NotificationsPage() {
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(READ_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setReadIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      }
    } catch {
      window.localStorage.removeItem(READ_STORAGE_KEY);
    }
    setIsLoaded(true);
  }, []);

  function markAllRead() {
    const allRead = notifications.map((notification) => notification.id);
    setReadIds(allRead);
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(allRead));
  }

  function markRead(id: string) {
    setReadIds((current) => {
      const next = current.includes(id) ? current : [...current, id];
      window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const unreadCount = notifications.filter((notification) => !readIds.includes(notification.id)).length;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="flex-1 bg-white">
        <section className="w-full bg-white pb-16 pt-14 sm:pb-20 sm:pt-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="text-3xl font-normal tracking-tight text-zinc-900 sm:text-[38px]">Notifications</h1>
                <p className="mt-3 text-sm text-zinc-500 sm:text-base">
                  {unreadCount === 0
                    ? "You’re all caught up."
                    : `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"} about your account and investments.`}
                </p>
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={!isLoaded || unreadCount === 0}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck className="size-4" />Mark all as read
              </button>
            </div>

            <div className="mt-10 flex items-center justify-between border-b border-zinc-200 pb-3">
              <h2 className="text-lg font-normal text-zinc-800 sm:text-xl">Recent activity</h2>
              <span className="text-xs text-zinc-400">{notifications.length} updates</span>
            </div>

            {!isLoaded ? (
              <div className="mt-5 rounded-xl border border-zinc-200/80 bg-white px-5 py-12 text-center text-sm text-zinc-500">Loading notifications…</div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4">
                {notifications.map((notification) => {
                  const isRead = readIds.includes(notification.id);
                  const Icon = notification.type === "watchlist" ? TrendingUp : CircleCheck;
                  return (
                    <article key={notification.id} className="flex gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:gap-5 sm:p-6">
                      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${isRead ? "bg-zinc-100 text-zinc-500" : "bg-blue-50 text-[#2563EB]"}`}>
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className={`text-sm sm:text-base ${isRead ? "font-medium text-zinc-700" : "font-semibold text-zinc-900"}`}>{notification.title}</h3>
                            {!isRead && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">New</span>}
                          </div>
                          <time className="text-xs text-zinc-400">{notification.time}</time>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{notification.message}</p>
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                          <Link href={notification.href} onClick={() => markRead(notification.id)} className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] transition-colors hover:text-[#1D4ED8]">
                            View details<ArrowUpRight className="size-4" />
                          </Link>
                          {!isRead && <button type="button" onClick={() => markRead(notification.id)} className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">Mark as read</button>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
