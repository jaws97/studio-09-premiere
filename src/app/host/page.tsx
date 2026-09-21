import type { Metadata } from "next";
import { Host } from "@/components/host/Host";
import "./host.css";

export const metadata: Metadata = { title: "Studio 09 · Host remote" };

export default function HostPage() {
  return <Host />;
}
