import type { Metadata } from "next";
import { Host } from "@/components/host/Host";
import { PinGate } from "@/components/PinGate";
import { isHost } from "@/server/auth";
import "./host.css";

export const metadata: Metadata = { title: "Studio 09 · Host remote" };

export default async function HostPage() {
  if (!(await isHost())) return <PinGate title="Host remote" />;
  return <Host />;
}
