import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Debug Panel |  Dev",
  description: "Internal development and verification panel",
};

export default function DevPage() {
  notFound();
}
