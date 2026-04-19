"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api";

export function useStartShift() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function startShift() {
    if (starting) return;
    setStarting(true);
    try {
      const session = await api.sessions.create();
      await api.sessions.start(session.id);
      router.push(`/shift/${session.id}`);
    } catch {
      setStarting(false);
    }
  }

  return { starting, startShift };
}
