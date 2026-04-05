"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "vigil-music-volume";
const DEFAULT_VOLUME = 0.35;

export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_VOLUME;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? parseFloat(stored) : DEFAULT_VOLUME;
  });

  useEffect(() => {
    const audio = new Audio("/shift.mp3");
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    audioRef.current?.play().catch(() => {});
  }

  function stop() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  function setVolume(v: number) {
    setVolumeState(v);
    localStorage.setItem(STORAGE_KEY, String(v));
    if (audioRef.current) audioRef.current.volume = v;
  }

  return { start, stop, volume, setVolume };
}
