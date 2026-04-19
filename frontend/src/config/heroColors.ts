// Deterministic color assignment per hero id. Each entry matches the
// mockup's --hc / --hg convention: hc is the stripe tint, hg is the radial
// highlight. Colors stay stable across renders because they key off hero.id.

interface HeroColor {
  hc: string;
  hg: string;
}

const PALETTE: HeroColor[] = [
  { hc: "rgba(106,73,168,0.55)",  hg: "rgba(106,73,168,0.22)"  }, // violet
  { hc: "rgba(60,120,200,0.55)",  hg: "rgba(60,120,200,0.22)"  }, // blue
  { hc: "rgba(200,80,40,0.55)",   hg: "rgba(200,80,40,0.22)"   }, // orange-red
  { hc: "rgba(50,170,120,0.55)",  hg: "rgba(50,170,120,0.22)"  }, // green
  { hc: "rgba(180,140,40,0.55)",  hg: "rgba(180,140,40,0.22)"  }, // yellow-brown
  { hc: "rgba(90,90,90,0.55)",    hg: "rgba(130,130,130,0.15)" }, // gray
  { hc: "rgba(220,120,0,0.55)",   hg: "rgba(220,120,0,0.22)"   }, // orange
  { hc: "rgba(0,160,200,0.55)",   hg: "rgba(0,160,200,0.20)"   }, // cyan
  { hc: "rgba(200,60,80,0.55)",   hg: "rgba(200,60,80,0.22)"   }, // red-pink
  { hc: "rgba(160,200,60,0.55)",  hg: "rgba(160,200,60,0.22)"  }, // lime
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function heroColor(id: string): HeroColor {
  return PALETTE[hash(id) % PALETTE.length];
}
