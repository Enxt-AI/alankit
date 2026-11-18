import { notFound } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Development Debug Panel | SMC Web",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DevPage() {
  notFound();
}
