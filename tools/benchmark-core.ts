import { Board } from "../assets/scripts/core/Board";
import { ConnectivityResolver } from "../assets/scripts/core/ConnectivityResolver";
import { Randomizer } from "../assets/scripts/core/Randomizer";
import { SandSimulation } from "../assets/scripts/core/SandSimulation";
import { SandPixelBuffer } from "../assets/scripts/rendering/SandPixelBuffer";

const WIDTH = 60;
const HEIGHT = 144;
const SIZE = WIDTH * HEIGHT;

function averageMilliseconds(iterations: number, operation: () => void): number {
  const startedAt = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    operation();
  }
  return (performance.now() - startedAt) / iterations;
}

const randomizer = new Randomizer(0x5a17f411);
const cells = new Uint8Array(SIZE);
for (let index = 0; index < cells.length; index += 1) {
  cells[index] = randomizer.nextFloat() < 0.9 ? randomizer.nextInt(5) + 1 : 0;
}

const board = new Board(WIDTH, HEIGHT, cells);
const simulation = new SandSimulation(board, randomizer);
const connectivity = new ConnectivityResolver(board);
const simulationMs = averageMilliseconds(1_000, () => {
  simulation.step();
});
const connectivityMs = averageMilliseconds(500, () => {
  connectivity.resolve();
});

const firstFrame = cells.slice();
const secondFrame = cells.slice();
for (let index = 0; index < secondFrame.length; index += 1) {
  secondFrame[index] = (secondFrame[index] ?? 0) === 5 ? 1 : (secondFrame[index] ?? 0) + 1;
}
const pixelBuffer = new SandPixelBuffer({ width: WIDTH, height: HEIGHT, flipY: true });
let useFirstFrame = false;
const rgbaUpdateMs = averageMilliseconds(500, () => {
  pixelBuffer.update(useFirstFrame ? firstFrame : secondFrame);
  useFirstFrame = !useFirstFrame;
});

console.log(JSON.stringify({
  board: `${WIDTH}x${HEIGHT}`,
  fillRatio: 0.9,
  averageMilliseconds: {
    sandTick: Number(simulationMs.toFixed(4)),
    connectivityScan: Number(connectivityMs.toFixed(4)),
    fullRgbaUpdate: Number(rgbaUpdateMs.toFixed(4)),
  },
}, null, 2));
