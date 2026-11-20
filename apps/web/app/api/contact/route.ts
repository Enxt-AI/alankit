import { NextResponse } from "next/server";
import { contactFormSchema } from "@/app/(main)/contact-us/contact-schema";

const NETCORE_ENDPOINT =
  process.env.NETCORE_ENDPOINT ||
  "https://emailapi.netcorecloud.net/v5/mail/send";

/** Converts "Name <email@domain.com>" (or a bare address) into Netcore's address object. */
function parseAddress(value: string): { email: string; name?: string } {
  const raw = value.trim();
  const match = raw.match(/^(?:"([^"]*)"|([^<>]*?))?\s*<([^<>]+)>$/);

  if (match) {
    const email = match[3]?.trim();
    if (!email) return { email: raw };

    const name = (match[1] ?? match[2] ?? "").trim();
    return name ? { email, name } : { email };
  }

  return { email: raw };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = contactFormSchema.safeParse(body);
    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message || "Invalid form data";
      return NextResponse.json(
        { message: errorMessage, errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, phone, email, subject, source, message } = result.data;

    const apiKey = process.env.NETCORE_API_KEY;
    if (!apiKey) {
      console.warn("[Contact Form] NETCORE_API_KEY is not set. Simulating delivery.");
      console.log("[Contact Form Received]", {
        name,
        email,
        phone,
        subject,
        source,
        message,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        { message: "Message sent successfully!" },
        { status: 200 }
      );
    }

    const supportEmail = process.env.CONTACT_SUPPORT_EMAIL || "support@unlistedstox.com";
    const fromEmail =
      process.env.EMAIL_FROM || "Unlistedstox <no-reply@unlistedstox.com>";

    const htmlBody = `
        <h2>New Contact Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Source:</strong> ${source || "N/A"}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
      `;

    const response = await fetch(NETCORE_ENDPOINT, {
      method: "POST",
      headers: {
        api_key: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: parseAddress(fromEmail),
        subject: `New Contact Form Submission: ${subject}`,
        content: [{ type: "html", value: htmlBody }],
        personalizations: [{ to: [{ email: supportEmail }] }],
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      console.error(`[Contact Form] Netcore API error ${response.status}:`, data);
      return NextResponse.json(
        { message: "Failed to send message" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Message sent successfully" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Contact Form] Error:", err);
    return NextResponse.json(
      { message: err?.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
