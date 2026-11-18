import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { getBasketById } from "@/lib/baskets-api";
import { getStockSlug } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";

interface BasketDetailsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BasketDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  
  let basket;
  try {
    basket = await getBasketById(id);
  } catch (e) {
    // ignore
  }

  return constructMetadata(`/baskets/${id}`, {
    title: basket ? `${basket.name} | UnlistedStox Baskets` : "Basket | UnlistedStox",
    description: basket?.description || "Invest in curated baskets of unlisted shares.",
    image: basket?.iconUrl || undefined,
  });
}

export default async function BasketDetailLayout({
  params,
  children,
}: {
  params: BasketDetailsPageProps["params"];
  children: React.ReactNode;
}) {
  const { id } = await params;

  let basket;
  try {
    basket = await getBasketById(id);
  } catch {
    basket = null;
  }

  const basketJsonLd = basket
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: basket.name,
        image: basket.iconUrl || undefined,
        description:
          basket.description ||
          `${basket.name} — a curated basket of unlisted shares on UnlistedStox.`,
        brand: { "@type": "Organization", name: "UnlistedStox" },
        offers: {
          "@type": "Offer",
          price: basket.currentPrice ?? basket.minInvestment,
          priceCurrency: "INR",
          availability:
            basket.resolvedStatus === "OPEN"
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          url: `https://www.unlistedstox.com/baskets/${basket.id}`,
        },
      }
    : null;

  return (
    <>
      {basketJsonLd && <JsonLd data={basketJsonLd} />}
      {children}
    </>
  );
}
