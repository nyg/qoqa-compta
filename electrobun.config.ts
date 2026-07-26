import { readFileSync } from "fs";
import type { ElectrobunConfig } from "electrobun/bun";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8")) as { version: string };

export default {
  app: {
    name: "QoQa Compta",
    identifier: "io.github.nyg.qoqa-compta",
    version,
  },
  build: {
    mac: {
      // Generated from assets/icon.svg, see scripts/generate-icons.sh.
      icons: "assets/icon.iconset",
    },
    win: {
      icon: "assets/icon.ico",
    },
    bun: {
      entrypoint: "src/electrobun/index.ts",
    },
    copy: {
      // These paths are populated by scripts.preBuild (runs `vite build`).
      // If you add other top-level files to dist/ (e.g. favicon.ico, manifest.json),
      // add them here too.
      "dist/index.html": "views/main/index.html",
      "dist/assets": "views/main/assets",
    },
    watchIgnore: ["dist/**"],
  },
  scripts: {
    preBuild: "scripts/prebuild.ts",
    postWrap: "scripts/postwrap.ts",
  },
} satisfies ElectrobunConfig;
