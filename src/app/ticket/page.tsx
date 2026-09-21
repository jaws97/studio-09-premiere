import type { Metadata } from "next";
import { TicketPage } from "@/components/ticket/Ticket";
import { films } from "@/data/season";
import "./ticket.css";

export const metadata: Metadata = { title: "Studio 09 · Your ticket" };

export default function Page() {
  // Names only — titles stay on the server until the premiere.
  return <TicketPage cast={films.map((f) => f.star)} />;
}
