export interface LandingStep {
  n: number;
  title: string;
  desc: string;
}

export const STEPS: LandingStep[] = [
  {
    n: 1,
    title: "Calls come in",
    desc: "Briefings land on the map in real time. Danger level, field intel, a clock. No two incidents are the same.",
  },
  {
    n: 2,
    title: "You make the call",
    desc: "Choose who goes. Choose who waits. Your roster is finite, the clock is not your friend, and the city does not grade on effort.",
  },
  {
    n: 3,
    title: "The debrief",
    desc: "After resolution — field reports in the heroes' own voice, and an honest read on the call you made.",
  },
];

export interface TierFeature {
  text: string;
  on: boolean;
}

export interface Tier {
  name: string;
  price: string;
  per?: string;
  features: TierFeature[];
  cta: string;
  featured?: boolean;
}

export const TIERS: Tier[] = [
  {
    name: "Observer",
    price: "Free",
    features: [
      { text: "3 shifts per month",       on: true  },
      { text: "Full hero roster",         on: true  },
      { text: "Mission debrief",          on: true  },
      { text: "Eval breakdown locked",    on: false },
      { text: "Arc threads locked",       on: false },
    ],
    cta: "Get Started",
  },
  {
    name: "Operator",
    price: "$8",
    per: "/ month",
    features: [
      { text: "Unlimited shifts",         on: true  },
      { text: "Full hero roster",         on: true  },
      { text: "Full eval breakdown",      on: true  },
      { text: "Arc thread tracking",      on: true  },
      { text: "Team accounts locked",     on: false },
    ],
    cta: "Start Free Trial",
    featured: true,
  },
  {
    name: "Commander",
    price: "$20",
    per: "/ month",
    features: [
      { text: "Everything in Operator",   on: true },
      { text: "Team accounts up to 5",    on: true },
      { text: "Shared shift history",     on: true },
      { text: "Priority eval queue",      on: true },
      { text: "Early hero access",        on: true },
    ],
    cta: "Contact Us",
  },
];
