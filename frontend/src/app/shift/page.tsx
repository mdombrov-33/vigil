"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { GameLayout } from "@/components/game/GameLayout";
import { StartScreen } from "@/components/game/StartScreen";
import { createSession, startSession } from "@/hooks/useSession";

export default function ShiftPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    try {
      const session = await createSession();
      await startSession(session.id);
      router.push(`/shift/${session.id}`);
    } catch {
      setStarting(false);
    }
  }

  return (
    <GameLayout
      onIncidentClick={() => {}}
      onHeroClick={() => {}}
      onEndShift={() => {}}
      shiftStarted={false}
      selectedIncident={null}
      selectedHeroIds={[]}
      onHeroToggle={() => {}}
      onIncidentClose={() => {}}
      onDispatched={() => {}}
      startScreenSlot={
        <AnimatePresence>
          <StartScreen onStart={handleStart} />
        </AnimatePresence>
      }
    />
  );
}
