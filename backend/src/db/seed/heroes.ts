import { deal } from "./heroes/v2/deal.js";
import { zenith } from "./heroes/v2/zenith.js";
import { fracture } from "./heroes/v2/fracture.js";
import { veil } from "./heroes/v2/veil.js";
import { rex } from "./heroes/v2/rex.js";
import { agnes } from "./heroes/v2/agnes.js";
import { coil } from "./heroes/v2/coil.js";
import { aegis } from "./heroes/v2/aegis.js";
import { chorus } from "./heroes/v2/chorus.js";
import type { NewHero } from "../schema.js";

const baseUrl = process.env.PORTRAITS_BASE_URL ?? "";

function withPortraits(hero: NewHero & { alias: string }): NewHero {
  const key = hero.alias.toLowerCase().split(" ").pop()!;
  return {
    ...hero,
    portraitUrl: `${baseUrl}/${key}-healthy.webp`,
    injuredPortraitUrl: `${baseUrl}/${key}-injured.webp`,
  };
}

export const heroSeedData = [
  deal,
  zenith,
  fracture,
  veil,
  rex,
  agnes,
  coil,
  aegis,
  chorus,
].map(withPortraits);
