import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 22_050;
const OUTPUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../assets/resources/audio",
);

function clamp(value, minimum = -1, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function envelope(time, duration, attack = 0.01, release = 0.08) {
  return Math.min(1, time / attack, (duration - time) / release);
}

function writeWav(name, duration, sampleAt) {
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  const dataSize = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    wav.writeInt16LE(Math.round(clamp(sampleAt(time, duration)) * 32767), 44 + index * 2);
  }
  writeFileSync(resolve(OUTPUT_DIR, `${name}.wav`), wav);
}

let noiseState = 0x51a7c0de;
function noise() {
  noiseState = (Math.imul(noiseState, 1664525) + 1013904223) >>> 0;
  return noiseState / 0xffffffff * 2 - 1;
}

function sine(frequency, time, phase = 0) {
  return Math.sin(Math.PI * 2 * frequency * time + phase);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

writeWav("bgm-loop", 16, (time, duration) => {
  const chordRoots = [55, 65.406, 73.416, 49];
  const chordIndex = Math.floor(time / 4) % chordRoots.length;
  const root = chordRoots[chordIndex];
  const beatTime = time % 0.5;
  const beatEnvelope = Math.exp(-beatTime * 7);
  const arpeggio = [1, 1.5, 2, 1.5][Math.floor(time / 0.5) % 4];
  const master = envelope(time, duration, 0.06, 0.08);
  const pad = sine(root, time) * 0.11
    + sine(root * 1.5, time) * 0.055
    + sine(root * 2, time) * 0.035;
  const pulse = sine(root * 4 * arpeggio, time) * beatEnvelope * 0.055;
  const shimmer = sine(root * 8, time, Math.sin(time * 0.3) * 0.2) * 0.014;
  return (pad + pulse + shimmer) * master;
});

writeWav("move", 0.07, (time, duration) => {
  const decay = envelope(time, duration, 0.002, 0.055) * Math.exp(-time * 25);
  return (noise() * 0.15 + sine(780, time) * 0.12) * decay;
});

writeWav("rotate", 0.12, (time, duration) => {
  const frequency = 520 + time / duration * 380;
  return sine(frequency, time) * envelope(time, duration, 0.006, 0.07) * 0.28;
});

writeWav("land", 0.17, (time, duration) => {
  const frequency = 145 - time / duration * 55;
  const decay = envelope(time, duration, 0.003, 0.12) * Math.exp(-time * 10);
  return (sine(frequency, time) * 0.34 + noise() * 0.06) * decay;
});

writeWav("hard-drop", 0.27, (time, duration) => {
  const frequency = 185 - time / duration * 120;
  const decay = envelope(time, duration, 0.003, 0.18) * Math.exp(-time * 7);
  return (sine(frequency, time) * 0.46 + noise() * 0.09) * decay;
});

writeWav("sandify", 0.42, (time, duration) => {
  const decay = envelope(time, duration, 0.01, 0.16) * Math.exp(-time * 3.4);
  const grains = noise() * 0.16 + sine(1100 + noise() * 180, time) * 0.035;
  return grains * decay;
});

function smoothstep(value) {
  const normalized = clamp(value, 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
}

function glowEnvelope(time, duration, peakTime, releaseRate) {
  const release = Math.min(1, Math.max(0, duration - time) / 0.18);
  if (time < peakTime) {
    return smoothstep(time / peakTime) * release;
  }
  return Math.exp(-(time - peakTime) * releaseRate) * release;
}

function softStrike(time, startTime, attack, decayRate) {
  if (time < startTime) {
    return 0;
  }
  const localTime = time - startTime;
  return smoothstep(localTime / attack) * Math.exp(-localTime * decayRate);
}

/** Airy sand release plus an ascending, softly attacked reward chime. */
function createClearSound(rootFrequency, chain = false) {
  let fastNoise = 0;
  let slowNoise = 0;
  return (time, duration) => {
    const rawNoise = noise();
    fastNoise += (rawNoise - fastNoise) * 0.28;
    slowNoise += (rawNoise - slowNoise) * 0.055;

    const firstGlow = glowEnvelope(time, duration, 0.105, 4.8);
    const secondGlow = chain && time >= 0.11
      ? glowEnvelope(time - 0.11, duration - 0.11, 0.13, 5.6)
      : 0;
    const softTail = envelope(time, duration, 0.055, 0.24);
    const sandSweep = (fastNoise - slowNoise)
      * softTail
      * (0.09 + firstGlow * 0.075 + secondGlow * 0.04);

    const shimmerPhase = sine(3.2, time) * 0.045;
    const firstStrike = softStrike(time, 0.035, 0.028, 4.7);
    const shimmer = (
      sine(rootFrequency, time, shimmerPhase) * 0.105
      + sine(rootFrequency * 2.005, time, 0.7) * 0.036
      + sine(rootFrequency * 3.01, time, 1.1) * 0.015
    ) * Math.max(firstGlow * 0.7, firstStrike);
    const sparkle = (
      sine(rootFrequency * 4.01, time, 0.9) * 0.014
      + sine(rootFrequency * 6.02, time, 0.25) * 0.007
    ) * firstStrike;
    const secondStrike = chain ? softStrike(time, 0.18, 0.026, 4.3) : 0;
    const thirdStrike = chain ? softStrike(time, 0.34, 0.024, 4.8) : 0;
    const chainShimmer = chain
      ? (
        sine(rootFrequency * 1.25, time, 0.35) * 0.11 * secondStrike
        + sine(rootFrequency * 1.5, time, 0.5) * 0.105 * thirdStrike
        + sine(rootFrequency * 3.005, time, 1.3) * 0.018 * Math.max(secondGlow, thirdStrike)
      )
      : 0;

    return (sandSweep + shimmer + sparkle + chainShimmer) * 2.35;
  };
}

writeWav("clear", 0.64, createClearSound(659.25));

writeWav("clear-chain", 0.86, createClearSound(783.99, true));

writeWav("game-over", 1.05, (time, duration) => {
  const notes = [293.66, 246.94, 196, 146.83];
  const note = notes[Math.min(notes.length - 1, Math.floor(time / 0.24))];
  const localTime = time % 0.24;
  return sine(note, time) * Math.exp(-localTime * 3.2)
    * envelope(time, duration, 0.01, 0.18) * 0.24;
});

writeWav("ui", 0.09, (time, duration) => (
  sine(640, time) * envelope(time, duration, 0.004, 0.06) * 0.2
));

console.log(`Generated audio assets in ${OUTPUT_DIR}`);
