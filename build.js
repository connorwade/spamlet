import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  platform: "node",
  target: ["node16.0"],
  mainFields: ["module", "main"],
  outdir: "lib",
  external: ["node_modules"],
});
