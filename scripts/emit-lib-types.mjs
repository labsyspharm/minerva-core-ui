/**
 * Declarations for the `minerva-core-ui/story` library entry.
 *
 * `tsc -p tsconfig.lib.json` emits a .d.ts for every file in the program,
 * using the repo's `@/` path alias. Keep only the files reachable from the
 * public entry, rewrite `@/…` to relative paths, and drop CSS side-effect
 * imports so consumers type-check without our tsconfig.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "lib", "types");
const entry = path.join(outDir, "embed", "index.d.ts");

rmSync(outDir, { recursive: true, force: true });
execFileSync(
  path.join(root, "node_modules", ".bin", "tsc"),
  ["-p", "tsconfig.lib.json"],
  { cwd: root, stdio: "inherit" },
);

const specifierRE = /(from\s+|import\s*\(\s*|import\s+)(["'])([^"']+)\2/g;
const keep = new Map();
const queue = [entry];

while (queue.length > 0) {
  const file = queue.pop();
  if (keep.has(file)) continue;
  let text = readFileSync(file, "utf8").replace(
    /^import\s+["'][^"']+\.css["'];\n/gm,
    "",
  );
  text = text.replace(specifierRE, (match, lead, quote, spec) => {
    if (!spec.startsWith("@/") && !spec.startsWith(".")) return match;
    const target = spec.startsWith("@/")
      ? path.join(outDir, spec.slice(2))
      : path.resolve(path.dirname(file), spec);
    const dts = [`${target}.d.ts`, path.join(target, "index.d.ts")].find(
      existsSync,
    );
    if (!dts) {
      throw new Error(`${path.relative(root, file)}: cannot resolve ${spec}`);
    }
    queue.push(dts);
    let rel = path
      .relative(path.dirname(file), target)
      .split(path.sep)
      .join("/");
    if (!rel.startsWith(".")) rel = `./${rel}`;
    return `${lead}${quote}${rel}${quote}`;
  });
  keep.set(file, text);
}

rmSync(outDir, { recursive: true, force: true });
for (const [file, text] of keep) {
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, text);
}
console.log(
  `lib/types: ${keep.size} declaration files from ${path.relative(root, entry)}`,
);
