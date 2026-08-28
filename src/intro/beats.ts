import { collectiveBeat } from "@/intro/beats/collective";
import { sealBeat } from "@/intro/beats/seal";
import type { IntroBeat } from "@/intro/timeline";

/**
 * The beats that play after the wordmark wipe, in timeline order. Each beat
 * lands in its own label slot ("collective", "seal"); add new beats here.
 */
export const introBeats: IntroBeat[] = [collectiveBeat, sealBeat];
