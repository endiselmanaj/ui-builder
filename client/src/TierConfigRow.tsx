import type { ContextSource, ContextTier } from "./types";
export function TierConfigRow(_props: {
  sources: ContextSource[];
  tiers: ContextTier[];
  onTiersChange: (next: ContextTier[]) => Promise<void>;
}) {
  return null;
}
