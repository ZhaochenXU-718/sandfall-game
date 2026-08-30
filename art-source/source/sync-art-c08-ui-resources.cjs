#!/usr/bin/env node

// Copies only ART-C08 runtime-size assets into Cocos resources and writes
// stable full-rect sprite-frame metadata. Concept boards and 2× review files
// remain outside the runtime package.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function argument(name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    throw new Error(`missing ${name}`);
  }
  return args[index + 1];
}

const sharp = require(argument("--sharp"));
const projectRoot = path.resolve(argument("--project-root"));

const files = [
  ["art-source/exports/ui-icons/luosha-ui-pause-64.png", "assets/resources/art/ui/icons/pause.png"],
  ["art-source/exports/ui-icons/luosha-ui-resume-64.png", "assets/resources/art/ui/icons/resume.png"],
  ["art-source/exports/ui-icons/luosha-ui-home-64.png", "assets/resources/art/ui/icons/home.png"],
  ["art-source/exports/ui-icons/luosha-ui-restart-64.png", "assets/resources/art/ui/icons/restart.png"],
  ["art-source/exports/ui-icons/luosha-ui-help-64.png", "assets/resources/art/ui/icons/help.png"],
  ["art-source/exports/ui-icons/luosha-ui-music-64.png", "assets/resources/art/ui/icons/music.png"],
  ["art-source/exports/ui-icons/luosha-ui-music-off-64.png", "assets/resources/art/ui/icons/music-off.png"],
  ["art-source/exports/ui-icons/luosha-ui-sound-64.png", "assets/resources/art/ui/icons/sound.png"],
  ["art-source/exports/ui-icons/luosha-ui-sound-off-64.png", "assets/resources/art/ui/icons/sound-off.png"],
  ["art-source/exports/ui-icons/luosha-ui-haptics-64.png", "assets/resources/art/ui/icons/haptics.png"],
  ["art-source/exports/ui-icons/luosha-ui-haptics-off-64.png", "assets/resources/art/ui/icons/haptics-off.png"],
  ["art-source/exports/ui-icons/luosha-ui-share-64.png", "assets/resources/art/ui/icons/share.png"],
  ["art-source/exports/modal/luosha-modal-decoration-pause-286x300.png", "assets/resources/art/ui/modal/pause.png"],
  ["art-source/exports/modal/luosha-modal-decoration-game-over-286x300.png", "assets/resources/art/ui/modal/game-over.png"],
  ["art-source/exports/feedback/luosha-feedback-level-up-280x96.png", "assets/resources/art/ui/feedback/level-up.png"],
  ["art-source/exports/feedback/luosha-feedback-chain-mask-280x96.png", "assets/resources/art/ui/feedback/chain-mask.png"],
];

function stableUuid(key) {
  const hex = crypto.createHash("sha256").update(`sandfall-c08:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = "8";
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function directoryMeta(relativeDirectory) {
  return {
    ver: "1.2.0",
    importer: "directory",
    imported: true,
    uuid: stableUuid(relativeDirectory),
    files: [],
    subMetas: {},
    userData: {},
  };
}

function imageMeta(relativeFile, width, height) {
  const uuid = stableUuid(relativeFile);
  const displayName = path.basename(relativeFile, path.extname(relativeFile));
  const textureUuid = `${uuid}@6c48a`;
  return {
    ver: "1.0.27",
    importer: "image",
    imported: true,
    uuid,
    files: [".json", ".png"],
    subMetas: {
      "6c48a": {
        importer: "texture",
        uuid: textureUuid,
        displayName,
        id: "6c48a",
        name: "texture",
        userData: {
          wrapModeS: "clamp-to-edge",
          wrapModeT: "clamp-to-edge",
          imageUuidOrDatabaseUri: uuid,
          isUuid: true,
          visible: false,
          minfilter: "nearest",
          magfilter: "nearest",
          mipfilter: "none",
          anisotropy: 0,
        },
        ver: "1.0.22",
        imported: true,
        files: [".json"],
        subMetas: {},
      },
      f9941: {
        importer: "sprite-frame",
        uuid: `${uuid}@f9941`,
        displayName,
        id: "f9941",
        name: "spriteFrame",
        userData: {
          trimThreshold: 1,
          rotated: false,
          offsetX: 0,
          offsetY: 0,
          trimX: 0,
          trimY: 0,
          width,
          height,
          rawWidth: width,
          rawHeight: height,
          borderTop: 0,
          borderBottom: 0,
          borderLeft: 0,
          borderRight: 0,
          packable: true,
          pixelsToUnit: 100,
          pivotX: 0.5,
          pivotY: 0.5,
          meshType: 0,
          vertices: {
            rawPosition: [
              -width / 2, -height / 2, 0,
              width / 2, -height / 2, 0,
              -width / 2, height / 2, 0,
              width / 2, height / 2, 0,
            ],
            indexes: [0, 1, 2, 2, 1, 3],
            uv: [0, height, width, height, 0, 0, width, 0],
            nuv: [0, 0, 1, 0, 0, 1, 1, 1],
            minPos: [-width / 2, -height / 2, 0],
            maxPos: [width / 2, height / 2, 0],
          },
          isUuid: true,
          imageUuidOrDatabaseUri: textureUuid,
          atlasUuid: "",
          trimType: "none",
        },
        ver: "1.0.12",
        imported: true,
        files: [".json"],
        subMetas: {},
      },
    },
    userData: {
      type: "sprite-frame",
      fixAlphaTransparencyArtifacts: false,
      hasAlpha: true,
      redirect: textureUuid,
    },
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function sync() {
  const directories = [
    "assets/resources/art/ui",
    "assets/resources/art/ui/icons",
    "assets/resources/art/ui/modal",
    "assets/resources/art/ui/feedback",
  ];
  for (const relativeDirectory of directories) {
    const directory = path.join(projectRoot, relativeDirectory);
    fs.mkdirSync(directory, { recursive: true });
    writeJson(`${directory}.meta`, directoryMeta(relativeDirectory));
  }

  for (const [sourceRelative, targetRelative] of files) {
    const source = path.join(projectRoot, sourceRelative);
    const target = path.join(projectRoot, targetRelative);
    fs.copyFileSync(source, target);
    const metadata = await sharp(target).metadata();
    if (metadata.width === undefined || metadata.height === undefined || metadata.hasAlpha !== true) {
      throw new Error(`invalid alpha PNG: ${targetRelative}`);
    }
    writeJson(`${target}.meta`, imageMeta(targetRelative, metadata.width, metadata.height));
  }
}

sync().catch((error) => {
  console.error(error);
  process.exit(1);
});
