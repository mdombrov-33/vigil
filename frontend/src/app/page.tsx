"use client";

import { useState } from "react";
import { NavBar, type LandingTab } from "@/components/landing/NavBar";
import { HomeScreen } from "@/components/landing/HomeScreen";
import { RosterScreen } from "@/components/landing/RosterScreen";
import { TiersScreen } from "@/components/landing/TiersScreen";
import { GridBackground } from "@/components/landing/GridBackground";
import { useHeroes } from "@/hooks/useHeroes";
import { useStartShift } from "@/hooks/useStartShift";

export default function Landing() {
  const [tab, setTab] = useState<LandingTab>("home");
  const { data: heroes = [] } = useHeroes();
  const { starting, startShift } = useStartShift();

  return (
    <div className="h-screen w-screen relative bg-background text-primary-text">
      <GridBackground />

      <NavBar
        activeTab={tab}
        onTabChange={setTab}
        onStartShift={startShift}
        starting={starting}
      />

      <div className="fixed left-0 right-0 bottom-0 z-10 top-10.5">
        {tab === "home" && (
          <HomeScreen
            heroes={heroes}
            onStartShift={startShift}
            starting={starting}
          />
        )}
        {tab === "roster" && <RosterScreen heroes={heroes} />}
        {tab === "tiers" && <TiersScreen />}
      </div>
    </div>
  );
}
