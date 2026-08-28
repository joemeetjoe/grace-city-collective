/**
 * PUT the edited document to the editor API. The Lambda answers
 * `{ ok: true }` or `{ ok: false, errors: [...] }` with paths the form can
 * show; anything else (an authorizer 401, a gateway error, no network) is
 * turned into one plain sentence.
 */

import type { SiteContent } from "@/content/site";

export type PublishResult = { ok: true } | { ok: false; errors: string[] };

export async function publishContent(
  apiUrl: string,
  idToken: string,
  content: SiteContent,
  fetchImpl: typeof fetch = fetch,
): Promise<PublishResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiUrl}/content`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
  } catch (error) {
    return { ok: false, errors: [`could not reach the server: ${String(error)}`] };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, errors: ["not signed in, or the session expired: sign in again and publish"] };
  }

  const data = (await response.json().catch(() => null)) as { ok?: boolean; errors?: unknown } | null;

  if (response.ok && data?.ok) return { ok: true };
  if (Array.isArray(data?.errors) && data.errors.length) return { ok: false, errors: data.errors.map(String) };
  return { ok: false, errors: [`the server answered ${response.status}`] };
}
