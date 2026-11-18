import { NextRequest, NextResponse } from "next/server";

function getStocksServiceUrl() {
  const raw = (process.env.NEXT_PUBLIC_STOCKS_SERVICE_URL || "").trim();
  if (raw && !raw.startsWith("/")) {
    return raw;
  }
  const gateway = (process.env.BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
  if (gateway) {
    return `${gateway}/api`;
  }
  return "http://127.0.0.1:3003/api";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cin: string }> }
) {
  const { cin } = await params;

  if (!cin) {
    return NextResponse.json(
      { error: "CIN is required" },
      { status: 400 }
    );
  }

  try {
    const baseUrl = getStocksServiceUrl();
    const url = `${baseUrl}/stocks/company/${encodeURIComponent(cin)}/details`;
    
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Stocks service returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch company details from backend:", error);

    return NextResponse.json(
      { error: "Failed to fetch comprehensive details" },
      { status: 500 }
    );
  }
}
