/**
 * The built site as the build-output tests see it. `pnpm build` writes
 * dist/; globalSetup.ts refuses to run the project without it.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** absolute path of dist/ */
export const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");

/** absolute path of a file under dist/ */
export const distPath = (rel: string): string => path.join(DIST_DIR, rel);

/** whether a build is present */
export const hasDist = (): boolean => existsSync(distPath("index.html"));

/** a built file as text */
export const readDist = (rel: string): string => readFileSync(distPath(rel), "utf8");

/** the built index.html */
export const distIndexHtml = (): string => readDist("index.html");
