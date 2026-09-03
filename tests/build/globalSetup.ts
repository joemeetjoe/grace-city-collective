// Runs once, in vitest's own process, before the build project collects any
// file: with no dist/ there is nothing to test, so say so in one line and
// stop — a thrown error here would print a stack wall per run instead.
import process from "node:process";

import { hasDist } from "./dist";

export default function checkDist(): void {
  if (hasDist()) return;
  process.stderr.write("no dist/: run `pnpm build` first, then `pnpm test:build`\n");
  process.exit(1);
}
