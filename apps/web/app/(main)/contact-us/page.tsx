import * as React from "react";
import type { Metadata } from "next";
import { PublicStaticPage } from "@/components/static-pages/PublicStaticPage";
import { ContactForm } from "./contact-form";

import { constructMetadata } from "@/lib/seo-helper";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata("/contact-us", {
    title: "Contact Us",
    description: "Get in touch with the UnlistedStox team. Reach out for support, inquiries, or to learn more about investing in pre-IPO and unlisted shares.",
  });
}

export default function ContactUsPage() {
  return (
    <div className="p-10">
      {/* Static CMS / fallback content */}
      <PublicStaticPage
        defaultTitle="Contact Us"
        slugsToTry={["contact-us"]}
        defaultHtml={`
          <p>We would love to hear from you! Please share your project details with us. You can also reach us at <a href="mailto:support@unlistedstox.com">support@unlistedstox.com</a>.</p>
        `}
      />
      <ContactForm />
    </div>
  );
}
