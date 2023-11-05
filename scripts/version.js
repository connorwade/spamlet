import * as fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json"));

let [major, minor, patch] = pkg.version.split(".");

if (process.argv.includes("-M")) {
  major = parseInt(major) + 1;
}

if (process.argv.includes("-m")) {
  minor = parseInt(minor) + 1;
}

if (process.argv.includes("-p")) {
  patch = parseInt(patch) + 1;
}

pkg.version = `${major}.${minor}.${patch}`;

fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
