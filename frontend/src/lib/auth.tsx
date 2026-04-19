"use client";

import type { ReactNode } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthStore {
  signedIn: boolean;
  setSignedIn: (v: boolean) => void;
}

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      signedIn: false,
      setSignedIn: (v) => set({ signedIn: v }),
    }),
    { name: "vigil-mock-auth" },
  ),
);

export function useUser() {
  const signedIn = useAuthStore((s) => s.signedIn);
  return {
    isLoaded: true,
    isSignedIn: signedIn,
    user: signedIn
      ? { firstName: "M", username: "mdombrov", imageUrl: null }
      : null,
  };
}

export function useAuth() {
  const signedIn = useAuthStore((s) => s.signedIn);
  return { isLoaded: true, isSignedIn: signedIn };
}

export function SignInButton({ children }: { children: ReactNode }) {
  const setSignedIn = useAuthStore((s) => s.setSignedIn);
  return (
    <span onClick={() => setSignedIn(true)} style={{ display: "contents" }}>
      {children}
    </span>
  );
}

export function UserButton() {
  const setSignedIn = useAuthStore((s) => s.setSignedIn);
  const { user } = useUser();
  const initial = user?.firstName?.[0]?.toUpperCase() ?? "U";
  const handle = user?.username ? `@${user.username}` : "@user";
  return (
    <button
      onClick={() => setSignedIn(false)}
      className="flex items-center gap-1.75 px-2.5 py-1.25 font-mono text-[10px] font-bold tracking-[0.14em] uppercase bg-transparent text-primary-text border border-border transition-colors"
      aria-label="Sign out"
    >
      <span className="grid place-items-center rounded-full shrink-0 w-5 h-5 text-[9px] font-bold bg-amber text-background">
        {initial}
      </span>
      <span>{handle}</span>
    </button>
  );
}
