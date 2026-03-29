import { ironwall } from "./heroes/ironwall.js";
import { static_ } from "./heroes/static.js";
import { boom } from "./heroes/boom.js";
import { veil } from "./heroes/veil.js";
import { rex } from "./heroes/rex.js";
import { fracture } from "./heroes/fracture.js";
import { agnes } from "./heroes/agnes.js";
import { null_ } from "./heroes/null.js";
import { duchess } from "./heroes/duchess.js";
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
  ironwall,
  static_,
  boom,
  veil,
  rex,
  fracture,
  agnes,
  null_,
  duchess,
].map(withPortraits);
