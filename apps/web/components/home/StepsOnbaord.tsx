"use client";

import React from "react";
import Link from "next/link";
import { Compass, FileText, UserCheck, Wallet, LineChart } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  { number: 1, icon: Compass, title: "Discover Stocks", href: "/stocks", color: "text-green-600", borderColor: "border-green-600", bgColor: "bg-green-600" },
  { number: 2, icon: FileText, title: "Review Company Details", href: "/stocks", color: "text-green-600", borderColor: "border-green-600", bgColor: "bg-green-600" },
  { number: 3, icon: UserCheck, title: "Complete KYC", href: "/kyc", color: "text-green-600", borderColor: "border-green-600", bgColor: "bg-green-600" },
  { number: 4, icon: Wallet, title: "Invest Securely", href: "/stocks", color: "text-green-600", borderColor: "border-green-600", bgColor: "bg-green-600" },
  { number: 5, icon: LineChart, title: "Track Holdings", href: "/dashboard/portfolio", color: "text-green-600", borderColor: "border-green-600", bgColor: "bg-green-600" },
];

export function StepsOnbaord() {
  return (
    <section className="overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-12 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
              Get started in <span className="text-green-600">5 simple steps</span>
            </h2>
          </motion.div>
        </div>

        {/* ─── DESKTOP LAYOUT (Straight Horizontal Roadmap) ─── */}
        <div className="hidden lg:block relative w-full max-w-5xl mx-auto mt-16 mb-20 px-8">
          {/* Horizontal Connecting Line */}
          <div className="absolute top-8 left-[10%] right-[10%] h-[3px] bg-slate-100 rounded-full z-0 overflow-hidden">
            <motion.div 
              className="h-full bg-slate-300"
              initial={{ width: 0 }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
          </div>

          <div className="relative z-10 flex justify-between">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              
              return (
                <motion.div
                  key={idx}
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.15 }}
                >
                  <Link href={step.href} className="group flex flex-col items-center">
                    {/* Timeline Badge/Pin */}
                    <div className={`relative w-16 h-16 rounded-2xl bg-white border-2 ${step.borderColor} ${step.color} flex items-center justify-center shadow-md mb-5 transition-transform group-hover:-translate-y-1 duration-300`}>
                      <Icon className="w-7 h-7" strokeWidth={2.2} />
                      <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${step.bgColor} text-white text-xs font-black flex items-center justify-center border-2 border-white shadow-sm`}>
                        {step.number}
                      </span>
                    </div>

                    {/* Text Label */}
                    <div className="text-center w-36 bg-white/90 backdrop-blur-sm rounded-xl py-2">
                      <span className="text-xs font-extrabold text-green-600 uppercase tracking-wider block mb-1.5 group-hover:underline">
                        Step 0{step.number}
                      </span>
                      <h3 className="text-base font-bold text-slate-800 leading-snug group-hover:text-green-600 transition-colors">
                        {step.title}
                      </h3>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── MOBILE: Vertical Left-Aligned Timeline ────────────────────────── */}
        <div className="lg:hidden relative py-2 px-1 space-y-3 sm:space-y-4">
          {/* Vertical Connecting Line */}
          <motion.div 
            className="absolute top-6 bottom-6 left-[23px] w-[2px] bg-slate-200/80 rounded-full"
            initial={{ height: 0 }}
            whileInView={{ height: "calc(100% - 48px)" }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
          
          {steps.map((step, idx) => {
            const Icon = step.icon;
            
            return (
              <motion.div 
                key={idx} 
                className="relative flex items-center gap-3 pl-1"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: idx * 0.1 }}
              >
                <Link href={step.href} className="flex items-center gap-3 flex-1 w-full group">
                  {/* Timeline Badge/Pin on vertical line */}
                  <div className={`relative z-10 w-10 h-10 rounded-xl bg-white border-[1.5px] ${step.borderColor} ${step.color} flex items-center justify-center shadow-xs shrink-0`}>
                    <Icon className="w-4 h-4" strokeWidth={2} />
                    <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${step.bgColor} text-white text-[9px] font-bold flex items-center justify-center border border-white shadow-xs`}>
                      {step.number}
                    </span>
                  </div>

                  {/* Step Card */}
                  <div className="flex-1 bg-white py-2.5 px-3.5 rounded-xl border border-slate-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-between group-hover:border-green-200 transition-all">
                    <div>
                      <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider block mb-0.5">
                        Step 0{step.number}
                      </span>
                      <h3 className="text-[13px] sm:text-sm font-semibold text-slate-800 leading-snug group-hover:text-green-600 transition-colors">
                        {step.title}
                      </h3>
                    </div>
                    <div className={`w-1.5 h-1.5 rounded-full ${step.bgColor} shrink-0 ml-2`} />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
