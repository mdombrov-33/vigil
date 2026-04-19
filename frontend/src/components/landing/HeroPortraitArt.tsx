import Image from "next/image";
import type { Hero } from "@/types/api";
import { heroColor } from "@/config/heroColors";

type Variant = "thumb" | "pane" | "stage";

interface Props {
  hero: Hero;
  variant: Variant;
  priority?: boolean;
  sizes?: string;
}

const STRIPES = {
  thumb:
    "repeating-linear-gradient(135deg, var(--hc, rgba(106,93,72,0.7)) 0 3px, rgba(15,14,12,0.88) 3px 7px)",
  pane: "repeating-linear-gradient(135deg, var(--hc, rgba(106,93,72,0.5)) 0 5px, rgba(12,11,10,0.92) 5px 12px)",
  stage:
    "repeating-linear-gradient(135deg, var(--hc, rgba(106,93,72,0.5)) 0 5px, rgba(12,11,10,0.92) 5px 12px)",
};

const GLOW = {
  pane: "radial-gradient(ellipse at 50% 25%, var(--hg, rgba(240,168,0,0.2)) 0%, transparent 55%)",
  stage:
    "radial-gradient(ellipse at 45% 30%, var(--hg, rgba(240,168,0,0.18)) 0%, transparent 60%)",
};

const RIGHT_FADE = {
  pane: "linear-gradient(to right, transparent 60%, rgba(10,9,8,0.98) 100%)",
  stage: "linear-gradient(to right, transparent 55%, rgba(10,9,8,0.97) 100%)",
};

const BOTTOM_FADE = {
  thumb: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)",
  pane: "linear-gradient(to top, rgba(10,9,8,0.98) 0%, transparent 55%)",
  stage: "linear-gradient(to top, rgba(10,9,8,1) 0%, transparent 100%)",
};

export function HeroPortraitArt({ hero, variant, priority, sizes }: Props) {
  const c = heroColor(hero.id);
  return (
    <div
      className="absolute inset-0"
      style={{
        ["--hc" as string]: c.hc,
        ["--hg" as string]: c.hg,
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: STRIPES[variant] }}
      />
      {hero.portraitUrl && (
        <Image
          src={hero.portraitUrl}
          alt={hero.alias}
          fill
          priority={priority}
          sizes={sizes ?? "100vw"}
          style={{ objectFit: "cover", objectPosition: "center top" }}
        />
      )}
      {variant !== "thumb" && (
        <div
          className="absolute inset-0"
          style={{ background: GLOW[variant], mixBlendMode: "overlay" }}
        />
      )}
      {variant !== "thumb" && (
        <div
          className="absolute inset-0"
          style={{ background: RIGHT_FADE[variant] }}
        />
      )}
      {variant === "stage" ? (
        <div
          className="absolute bottom-0 left-0 right-0 h-[55%]"
          style={{ background: BOTTOM_FADE.stage }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: BOTTOM_FADE[variant] }}
        />
      )}
    </div>
  );
}
