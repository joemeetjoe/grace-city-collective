/**
 * The static splash's place in the built page: nothing in <head> paints, so
 * the first paint is whatever leads the <body>. The guarantee the intro
 * leans on is that the splash element is there before any script in the
 * body can run, its own reset included (src/features/intro/staticSplash.ts),
 * and that nothing in the head blocks that paint: the inline style that
 * carries the splash's ink comes before any script, and no stylesheet link
 * is render-blocking (src/lib/asyncCss.ts).
 */
import { STATIC_SPLASH_ATTR } from "../../src/features/intro/staticSplash";
import { isStylesheetLink } from "../../src/lib/asyncCss";

/** the markup between <head …> and </head>, or "" when there is none */
export function headOf(html: string): string {
  const match = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  return match?.[1] ?? "";
}

/** the markup between <body …> and </body>, or "" when there is none */
export function bodyOf(html: string): string {
  const match = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match?.[1] ?? "";
}

/** the markup with every <noscript> block removed: nothing in one runs or blocks with scripts on */
export function withoutNoscript(html: string): string {
  return html.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");
}

/** the splash element is in the body and every body <script> tag follows it */
export function splashPrecedesBodyScripts(html: string): boolean {
  const body = bodyOf(html);
  const splash = new RegExp(`<[a-z][^>]*\\s${STATIC_SPLASH_ATTR}\\b`, "i").exec(body);
  if (!splash) return false;
  const script = /<script\b/i.exec(body);
  return script === null || splash.index < script.index;
}

/** every `<link rel="stylesheet">` outside a <noscript>, anywhere in the page */
export function blockingStylesheets(html: string): string[] {
  return (withoutNoscript(html).match(/<link\b[^>]*>/gi) ?? []).filter(isStylesheetLink);
}

/** the head has an inline <style> (outside a <noscript>) and every head <script> tag follows it */
export function inlineStylePrecedesHeadScripts(html: string): boolean {
  const head = withoutNoscript(headOf(html));
  const style = /<style\b/i.exec(head);
  if (!style) return false;
  const script = /<script\b/i.exec(head);
  return script === null || style.index < script.index;
}
