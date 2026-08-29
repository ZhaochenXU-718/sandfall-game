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

function clearTone(time, duration, frequencies) {
  const decay = envelope(time, duration, 0.008, 0.2) * Math.exp(-time * 2.2);
  return frequencies.reduce((sum, frequency, index) => (
    sum + sine(frequency, time, index * 0.4) * (0.2 / frequencies.length)
  ), 0) * decay;
}

writeWav("clear", 0.58, (time, duration) => (
  clearTone(time, duration, [523.25, 659.25, 783.99])
));

writeWav("clear-chain", 0.68, (time, duration) => (
  clearTone(time, duration, [659.25, 783.99, 1046.5, 1318.5]) * 1.15
));

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
