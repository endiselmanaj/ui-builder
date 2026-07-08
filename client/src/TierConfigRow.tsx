import type { ContextSource, ContextTier } from "./types";

export function TierConfigRow({
  sources,
  tiers,
  onTiersChange,
}: {
  sources: ContextSource[];
  tiers: ContextTier[];
  onTiersChange: (next: ContextTier[]) => Promise<void> | void;
}) {
  function updateTier(tierId: string, sourceIds: string[]) {
    onTiersChange(
      tiers.map((t) => (t.id === tierId ? { ...t, sourceIds } : t)),
    );
  }

  return (
    <div className="tier-row">
      {tiers.map((tier) => {
        const chips = tier.sourceIds
          .map((id) => sources.find((s) => s.id === id))
          .filter((s): s is ContextSource => !!s);
        const addable = sources.filter((s) => !tier.sourceIds.includes(s.id));
        return (
          <div key={tier.id} className="tier-config">
            <div className="tier-config-label">{tier.label}</div>
            <div className="tier-config-chips">
              {chips.map((s) => (
                <span key={s.id} className={`src-chip src-chip-${s.kind}`}>
                  <span aria-hidden="true">{s.kind === "url" ? "🔗 " : "📄 "}</span>
                  {s.label}
                  <button
                    className="src-chip-x"
                    aria-label={`remove ${s.label} from ${tier.label}`}
                    onClick={() =>
                      updateTier(tier.id, tier.sourceIds.filter((id) => id !== s.id))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              {chips.length === 0 && <span className="muted">no sources</span>}
            </div>
            <select
              className="tier-add"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  updateTier(tier.id, [...tier.sourceIds, e.target.value]);
                }
              }}
            >
              <option value="">+ add source…</option>
              {addable.map((s) => (
                <option key={s.id} value={s.id}>
                  + {s.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
