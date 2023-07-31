import * as esbuild from "esbuild";

const commonConfig = {
  entryPoints: ["src/index.js"],
  bundle: true,
  platform: "node",
  target: ["node16.0"],
  packages: "external",
  // outdir: "lib",
  tsconfig: "tsconfig.json",
};

await esbuild.build({
  ...commonConfig,
  format: "cjs",
  outfile: "lib/index.js",
});

await esbuild.build({
  ...commonConfig,
  format: "esm",
  outfile: "lib/index.mjs",
});
