import type { Metadata } from "next";
import { PinGate } from "@/components/PinGate";
import { Screen } from "@/components/screen/Screen";
import { isHost } from "@/server/auth";
import "./screen.css";

export const metadata: Metadata = { title: "Studio 09 · Screen" };

export default async function ScreenPage() {
  // The screen bundle carries the embargoed titles, so it sits behind the PIN.
  if (!(await isHost())) return <PinGate title="Projection room" />;
  return <Screen />;
}
