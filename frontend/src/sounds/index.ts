import { playSound } from "@/lib/sound-engine";
import { cardPlace1Sound } from "@/lib/card-place-1";
import { cardShove2Sound } from "@/lib/card-shove-2";
import { select001Sound } from "@/lib/select-001";
import { open001Sound } from "@/lib/open-001";
import { close001Sound } from "@/lib/close-001";
import { metalLatchSound } from "@/lib/metal-latch";
import { diceShake1Sound } from "@/lib/dice-shake-1";
import { diceThrow1Sound } from "@/lib/dice-throw-1";
import { error003Sound } from "@/lib/error-003";

let masterVolume = 0.35;

function play(dataUri: string, scale = 1) {
  playSound(dataUri, { volume: masterVolume * scale }).catch(() => {});
}

export const sounds = {
  setVolume:  (v: number) => { masterVolume = v; },
  slotDrop:   () => play(cardPlace1Sound.dataUri),
  slotRemove: () => play(cardShove2Sound.dataUri),
  pinClick:   () => play(select001Sound.dataUri),
  modalOpen:  () => play(open001Sound.dataUri),
  modalClose: () => play(close001Sound.dataUri),
  dispatch:   () => play(metalLatchSound.dataUri),
  rollSpin:   () => play(diceShake1Sound.dataUri),
  rollLand:   () => play(diceThrow1Sound.dataUri),
  failure:    () => play(error003Sound.dataUri),
};
