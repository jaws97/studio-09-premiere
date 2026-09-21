import type { Metadata } from "next";
import { Join } from "@/components/join/Join";
import "./join.css";

export const metadata: Metadata = { title: "Studio 09 · In the house" };

export default function JoinPage() {
  return <Join />;
}
