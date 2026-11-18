import { NextResponse } from "next/server";
import { contactFormSchema } from "@/app/(main)/contact-us/contact-schema";

const SMART_PING_ENDPOINT =
  process.env.SMARTPING_ENDPOINT ||
  "https://1eqrmn.apiemail.smartping.io/email/4/messages";

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

    const apiKey = process.env.SMARTPING_API_KEY;
    if (!apiKey) {
      console.warn("[Contact Form] SMARTPING_API_KEY is not set. Simulating delivery.");
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
      process.env.RESEND_FROM_EMAIL ||
      "Unlistedstox <no-reply@unlistedstox.com>";

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

    const response = await fetch(SMART_PING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `App ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            sender: fromEmail,
            destinations: [
              {
                to: [{ destination: supportEmail }],
              },
            ],
            content: {
              subject: `New Contact Form Submission: ${subject}`,
              html: htmlBody,
            },
          },
        ],
      }),
    });

    if (response.status !== 200) {
      const data = await response.json().catch(() => null);
      console.error(`[Contact Form] SmartPing API error ${response.status}:`, data);
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
