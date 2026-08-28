/**
 * The admin page's connection details come from `VITE_EDITOR_*` variables
 * baked in at build time (the deploy workflow fills them from repo
 * variables that mirror the editor stack's outputs). Missing any one, the
 * page shows an "editor not configured" state instead of a sign-in form.
 */

export type EditorConfig = {
  /** HTTP API base, no trailing slash; the route is PUT {apiUrl}/content */
  apiUrl: string;
  region: string;
  userPoolId: string;
  clientId: string;
};

export const EDITOR_VARS = [
  "VITE_EDITOR_API_URL",
  "VITE_EDITOR_REGION",
  "VITE_EDITOR_USER_POOL_ID",
  "VITE_EDITOR_CLIENT_ID",
] as const;

type Env = Partial<Record<(typeof EDITOR_VARS)[number], string | undefined>>;

export function missingEditorVars(env: Env): string[] {
  return EDITOR_VARS.filter((name) => !env[name]?.trim());
}

export function readEditorConfig(env: Env): EditorConfig | null {
  if (missingEditorVars(env).length) return null;
  return {
    apiUrl: env.VITE_EDITOR_API_URL!.trim().replace(/\/+$/, ""),
    region: env.VITE_EDITOR_REGION!.trim(),
    userPoolId: env.VITE_EDITOR_USER_POOL_ID!.trim(),
    clientId: env.VITE_EDITOR_CLIENT_ID!.trim(),
  };
}
