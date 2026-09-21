import { connection } from "next/server";
import { Lobby, type LobbyFilm } from "@/components/lobby/Lobby";
import { event, isRevealed, tickerExtras } from "@/data/event";
import { artClass, films } from "@/data/season";
import "./lobby.css";

export default async function Home() {
  // Render per request so the embargo lifts on time without a redeploy.
  await connection();
  const revealed = isRevealed();

  const lobbyFilms: LobbyFilm[] = films.map((f) =>
    revealed
      ? { no: f.no, day: f.day, art: artClass(f), title: f.title, star: f.star, source: f.source, poster: f.poster }
      : { no: f.no, day: f.day, art: artClass(f) },
  );

  return (
    <Lobby
      films={lobbyFilms}
      revealed={revealed}
      startsAt={event.startsAt}
      venue={event.venue}
      tagline={event.tagline}
      tickerExtras={[...tickerExtras]}
    />
  );
}
