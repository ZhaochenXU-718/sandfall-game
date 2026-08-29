import { Board } from "../assets/scripts/core/Board";
import { ConnectivityResolver } from "../assets/scripts/core/ConnectivityResolver";
import { Randomizer } from "../assets/scripts/core/Randomizer";
import { DEFAULT_RULES, sandBoardSize } from "../assets/scripts/core/RulesConfig";
import { SandSimulation } from "../assets/scripts/core/SandSimulation";
import {
  DEFAULT_SAND_TEXTURE_STRENGTH,
  SandPixelBuffer,
} from "../assets/scripts/rendering/SandPixelBuffer";

const benchmarkArg = (globalThis as {
  readonly process?: { readonly argv?: readonly string[] };
}).process?.argv?.[2];
const requestedGrainsPerCell = benchmarkArg === undefined
  ? DEFAULT_RULES.grainsPerCell
  : Number(benchmarkArg);
if (!Number.isInteger(requestedGrainsPerCell) || requestedGrainsPerCell <= 0) {
  throw new RangeError("grainsPerCell benchmark argument must be a positive integer");
}
const benchmarkRules = {
  ...DEFAULT_RULES,
  grainsPerCell: requestedGrainsPerCell,
};
const { width: WIDTH, height: HEIGHT } = sandBoardSize(benchmarkRules);
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
  cells[index] = randomizer.nextFloat() < 0.9
    ? randomizer.nextInt(benchmarkRules.colorCount) + 1
    : 0;
}

const board = new Board(WIDTH, HEIGHT, cells);
const simulation = new SandSimulation(board, randomizer);
const connectivity = new ConnectivityResolver(board);
const sandSubstepMs = averageMilliseconds(1_000, () => {
  simulation.step();
});
const sandFixedTickMs = averageMilliseconds(500, () => {
  for (let substep = 0; substep < benchmarkRules.sandSubsteps; substep += 1) {
    simulation.step();
  }
});
const connectivityMs = averageMilliseconds(500, () => {
  connectivity.resolve();
});

const firstFrame = cells.slice();
const secondFrame = cells.slice();
for (let index = 0; index < secondFrame.length; index += 1) {
  secondFrame[index] = (secondFrame[index] ?? 0) === benchmarkRules.colorCount
    ? 1
    : (secondFrame[index] ?? 0) + 1;
}
const pixelBuffer = new SandPixelBuffer({
  width: WIDTH,
  height: HEIGHT,
  flipY: true,
  shadeStrength: DEFAULT_SAND_TEXTURE_STRENGTH,
});
let useFirstFrame = false;
const rgbaUpdateMs = averageMilliseconds(500, () => {
  pixelBuffer.update(useFirstFrame ? firstFrame : secondFrame);
  useFirstFrame = !useFirstFrame;
});

console.log(JSON.stringify({
  board: `${WIDTH}x${HEIGHT}`,
  fillRatio: 0.9,
  averageMilliseconds: {
    sandSubstep: Number(sandSubstepMs.toFixed(4)),
    sandFixedTick: Number(sandFixedTickMs.toFixed(4)),
    connectivityScan: Number(connectivityMs.toFixed(4)),
    fullRgbaUpdate: Number(rgbaUpdateMs.toFixed(4)),
  },
}, null, 2));
