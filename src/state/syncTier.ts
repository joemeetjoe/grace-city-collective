import { readTier, subscribeTier } from "@/device/deviceProfile";
import { useAppStore } from "./appStore";

/**
 * Keep the store's `tier` the device's live one (device/deviceProfile.ts)
 * while mounted: a resize across the tier's width line, or a move to a
 * display of another density, re-reads the tier into the store. Only the
 * fact moves — the scene mounted with the tier init decided (#117) and its
 * textures are cut for that one, so HomePage pins the tier it mounted with
 * and a change mid-session reloads nothing. Returns the function that stops
 * syncing; App runs it as an effect.
 */
export function syncTier(): () => void {
  return subscribeTier(() => useAppStore.getState().setTier(readTier()));
}
