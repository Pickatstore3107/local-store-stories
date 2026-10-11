import type { Metadata } from "next";
import { PasHome } from "@/components/home/pas-home";
import { loadWall } from "@/lib/server/wall";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Home, as the redesign's prototype has it (src/components/home/pas-home.tsx). */
export default async function Home() {
  const wall = await loadWall();

  return (
    <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto" }}>
      {wall === null ? (
        <p role="alert" style={{ padding: "36px 18px", margin: 0, font: "500 15px 'Plus Jakarta Sans'", color: "#6E5A55" }}>
          The posts couldn&apos;t be loaded just now. Please try again in a minute.
        </p>
      ) : (
        <PasHome memories={wall.memories} builtAt={wall.builtAt} />
      )}
    </main>
  );
}
