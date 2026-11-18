"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { contactFormSchema } from "./contact-schema";

export function ContactForm() {
  const [formValues, setFormValues] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "",
    message: "",
  });
  const [source, setSource] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    // Zod validation
    const result = contactFormSchema.safeParse({
      ...formValues,
      source: source || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      setErrorMsg("Please fix the errors in the form before submitting.");
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Failed to send message");
      }

      setSuccessMsg("Message sent successfully!");
      setFormValues({
        name: "",
        phone: "",
        email: "",
        subject: "",
        message: "",
      });
      setSource("");
      setErrors({});
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section>
      {/* Divider */}
      <div className="border-t" />

      {/* Notifications */}
      {successMsg && (
        <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Form */}
      <form className="mt-10" onSubmit={onSubmit} noValidate>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs text-black">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={formValues.name}
              onChange={(e) => handleChange("name", e.target.value.replace(/[^a-zA-Z\s]/g, ""))}
              placeholder="Enter your name"
              className={cn("h-10", errors.name && "border-red-500 focus-visible:ring-red-500")}
              required
            />
            {errors.name && (
              <p className="text-[11px] text-red-500 font-medium">{errors.name}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs text-black">
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formValues.phone}
              onChange={(e) => handleChange("phone", e.target.value.replace(/\D/g, ""))}
              placeholder="Enter 10-digit phone number"
              className={cn("h-10", errors.phone && "border-red-500 focus-visible:ring-red-500")}
              maxLength={15}
              required
            />
            {errors.phone && (
              <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-black">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formValues.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="Enter your email"
              className={cn("h-10", errors.email && "border-red-500 focus-visible:ring-red-500")}
              required
            />
            {errors.email && (
              <p className="text-[11px] text-red-500 font-medium">{errors.email}</p>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject" className="text-xs text-black">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              name="subject"
              value={formValues.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              placeholder="Enter subject"
              className={cn("h-10", errors.subject && "border-red-500 focus-visible:ring-red-500")}
              required
            />
            {errors.subject && (
              <p className="text-[11px] text-red-500 font-medium">{errors.subject}</p>
            )}
          </div>

          {/* Source */}
          <div className="space-y-3">
            <Label className="text-xs text-black">Where did you find us?</Label>

            <ToggleGroup
              type="single"
              value={source}
              onValueChange={(val) => setSource(val || "")}
              className="justify-start"
            >
              <ToggleGroupItem
                value="search_engine"
                className={cn(
                  "h-8 rounded-md border px-3 text-xs",
                  source === "search_engine" && "border-black",
                )}
              >
                Search Engine
              </ToggleGroupItem>

              <ToggleGroupItem
                value="social_media"
                className={cn(
                  "h-8 rounded-md border px-3 text-xs",
                  source === "social_media" && "border-black",
                )}
              >
                Social Media
              </ToggleGroupItem>

              <ToggleGroupItem
                value="referral"
                className={cn(
                  "h-8 rounded-md border px-3 text-xs",
                  source === "referral" && "border-black",
                )}
              >
                Referral
              </ToggleGroupItem>

              <ToggleGroupItem
                value="other"
                className={cn(
                  "h-8 rounded-md border px-3 text-xs",
                  source === "other" && "border-black",
                )}
              >
                Other
              </ToggleGroupItem>
            </ToggleGroup>

            <p className="text-[11px] text-muted-foreground">
              Select an option (optional)
            </p>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-xs text-black">
              Your message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="message"
              name="message"
              value={formValues.message}
              onChange={(e) => handleChange("message", e.target.value)}
              placeholder="Enter your message here"
              className={cn("min-h-[90px] resize-none", errors.message && "border-red-500 focus-visible:ring-red-500")}
              required
            />
            {errors.message && (
              <p className="text-[11px] text-red-500 font-medium">{errors.message}</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="mt-10 flex justify-center">
          <Button
            type="submit"
            disabled={isLoading}
            className="h-9 w-[140px] rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Submit"}
          </Button>
        </div>

        {/* Bottom support link */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          Need help? Create a ticket on our{" "}
          <Link href="/supports" className="text-black underline">
            Support
          </Link>{" "}
          page.
        </div>
      </form>
    </section>
  );
}
