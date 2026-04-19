"use client";

import { SignInButton, UserButton, useUser } from "@/lib/auth";

export type LandingTab = "home" | "roster" | "tiers";

interface Props {
  activeTab: LandingTab;
  onTabChange: (tab: LandingTab) => void;
  onStartShift: () => void;
  starting: boolean;
}

const TABS: { key: LandingTab; label: string }[] = [
  { key: "home",   label: "Home"         },
  { key: "roster", label: "Hero Roster"  },
  { key: "tiers",  label: "Tiers"        },
];

export function NavBar({ activeTab, onTabChange, onStartShift, starting }: Props) {
  const { isSignedIn } = useUser();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-[22px] h-[42px] border-b border-[var(--border)]"
      style={{
        background: "rgba(10,9,8,0.94)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span className="mr-[28px] flex-shrink-0 font-[var(--font-display)] font-bold text-lg tracking-[0.06em] text-[var(--text-amber)]">
        VIGIL
      </span>

      <div className="flex gap-[2px] flex-1">
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              className="font-mono font-bold uppercase px-[12px] py-[6px] text-[10px] tracking-[0.18em] transition-colors"
              style={{
                background: isActive ? "var(--amber-subtle)" : "transparent",
                border: `1px solid ${isActive ? "var(--text-amber)" : "transparent"}`,
                color: isActive ? "var(--text-amber)" : "var(--text-secondary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-[8px] ml-auto">
        {isSignedIn && (
          <button
            onClick={() => !starting && onStartShift()}
            disabled={starting}
            className="font-mono font-bold uppercase text-[10px] tracking-[0.22em] px-[14px] py-[6px] bg-transparent text-[var(--text-amber)] transition-colors"
            style={{
              border: "1px solid rgba(240,168,0,0.5)",
              cursor: starting ? "default" : "pointer",
              opacity: starting ? 0.7 : 1,
            }}
          >
            {starting ? "Initializing…" : "Start Shift"}
          </button>
        )}
        {isSignedIn ? (
          <UserButton />
        ) : (
          <SignInButton>
            <button
              className="font-mono font-bold uppercase text-[10px] tracking-[0.22em] px-[16px] py-[6px] bg-transparent text-[var(--text-amber)] transition-colors"
              style={{
                border: "1px solid rgba(240,168,0,0.5)",
              }}
            >
              Sign In
            </button>
          </SignInButton>
        )}
      </div>
    </nav>
  );
}
