/// <reference types="vite/client" />

// Connection details for the content editor (src/admin); set at build time,
// see infra/README.md. All optional: unset means "editor not configured".
interface ImportMetaEnv {
  /** expose the scene layers on window for the solo shot script */
  readonly VITE_SCENE_DEBUG?: string;
  readonly VITE_EDITOR_API_URL?: string;
  readonly VITE_EDITOR_REGION?: string;
  readonly VITE_EDITOR_USER_POOL_ID?: string;
  readonly VITE_EDITOR_CLIENT_ID?: string;
}
