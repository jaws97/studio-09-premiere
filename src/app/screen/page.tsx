import type { Metadata } from "next";
import { Screen } from "@/components/screen/Screen";
import "./screen.css";

export const metadata: Metadata = { title: "Studio 09 · Screen" };

export default function ScreenPage() {
  return <Screen />;
}
