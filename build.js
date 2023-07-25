import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.js"],
  // bundle: true,
  platform: "node",
  target: ["node16.0"],
  mainFields: ["module", "main"],
  packages: "external",
  outdir: "lib",
  // external: ["node_modules"],
  tsconfig: "tsconfig.json",
});
