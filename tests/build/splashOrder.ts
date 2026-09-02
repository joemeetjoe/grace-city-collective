/**
 * The static splash's place in the built page: nothing in <head> paints, so
 * the first paint is whatever leads the <body>. The guarantee the intro
 * leans on is that the splash element is there before any script in the
 * body can run, its own reset included (src/features/intro/staticSplash.ts).
 */
import { STATIC_SPLASH_ATTR } from "../../src/features/intro/staticSplash";

/** the markup between <body …> and </body>, or "" when there is none */
export function bodyOf(html: string): string {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match?.[1] ?? "";
}

/** the splash element is in the body and every body <script> tag follows it */
export function splashPrecedesBodyScripts(html: string): boolean {
  const body = bodyOf(html);
  const splash = new RegExp(`<[a-z][^>]*\\s${STATIC_SPLASH_ATTR}\\b`, "i").exec(body);
  if (!splash) return false;
  const script = /<script\b/i.exec(body);
  return script === null || splash.index < script.index;
}
