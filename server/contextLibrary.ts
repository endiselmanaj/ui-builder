import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import type { ContextSource, ContextTier } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(__dirname, "..", "data");

const DEFAULT_TIERS: ContextTier[] = [
  { id: "tier-1", label: "Briefing only", sourceIds: [] },
  { id: "tier-2", label: "Briefing + Schematic", sourceIds: [] },
];

type SeedConfig = {
  sources: Array<{
    label: string;
    files?: string[];
    instructions?: string;
  }>;
  tiers?: Record<string, string[]>; // tierId -> source labels
};

export function createContextLibrary(dataDir: string) {
  const sourcesDir = path.join(dataDir, "context", "sources");
  const tiersFile = path.join(dataDir, "context", "tiers.json");
  const seedsDir = path.join(dataDir, "context-seeds");

  function metaPath(id: string) {
    return path.join(sourcesDir, id, "meta.json");
  }

  function readMeta(id: string): ContextSource | null {
    try {
      return JSON.parse(fs.readFileSync(metaPath(id), "utf-8"));
    } catch {
      return null;
    }
  }

  function writeMeta(src: ContextSource) {
    fs.mkdirSync(path.join(sourcesDir, src.id), { recursive: true });
    fs.writeFileSync(metaPath(src.id), JSON.stringify(src, null, 2));
  }

  function listSources(): ContextSource[] {
    let ids: string[];
    try {
      ids = fs.readdirSync(sourcesDir);
    } catch {
      return [];
    }
    return ids
      .map(readMeta)
      .filter((s): s is ContextSource => s !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  function getSource(id: string): ContextSource | null {
    return readMeta(id);
  }

  function sourceDir(id: string): string {
    return path.join(sourcesDir, id);
  }

  function createFileSource(
    label: string,
    files: { name: string; buffer: Buffer }[],
    instructions?: string,
  ): ContextSource {
    const src: ContextSource = {
      id: crypto.randomUUID(),
      label,
      files: files.map((f) => path.basename(f.name)),
      instructions,
      createdAt: new Date().toISOString(),
    };
    writeMeta(src);
    for (const f of files) {
      fs.writeFileSync(path.join(sourceDir(src.id), path.basename(f.name)), f.buffer);
    }
    return src;
  }

  function deleteSource(id: string) {
    fs.rmSync(sourceDir(id), { recursive: true, force: true });
    const tiers = readTiers().map((t) => ({
      ...t,
      sourceIds: t.sourceIds.filter((sid) => sid !== id),
    }));
    writeTiers(tiers);
  }

  function readTiers(): ContextTier[] {
    try {
      const stored = JSON.parse(fs.readFileSync(tiersFile, "utf-8"));
      if (Array.isArray(stored) && stored.length === 2) return stored;
    } catch {}
    return DEFAULT_TIERS.map((t) => ({ ...t, sourceIds: [...t.sourceIds] }));
  }

  function writeTiers(tiers: ContextTier[]): ContextTier[] {
    fs.mkdirSync(path.dirname(tiersFile), { recursive: true });
    fs.writeFileSync(tiersFile, JSON.stringify(tiers, null, 2));
    return tiers;
  }

  function ensureSeeds() {
    const seedFile = path.join(seedsDir, "seed.json");
    if (!fs.existsSync(seedFile)) return;
    let cfg: SeedConfig;
    try {
      cfg = JSON.parse(fs.readFileSync(seedFile, "utf-8"));
    } catch {
      return;
    }
    const existingLabels = new Set(listSources().map((s) => s.label));
    const byLabel = new Map<string, ContextSource>();
    for (const s of listSources()) byLabel.set(s.label, s);

    for (const seed of cfg.sources ?? []) {
      if (existingLabels.has(seed.label)) continue;
      const files = (seed.files ?? [])
        .map((name) => {
          const p = path.join(seedsDir, name);
          if (!fs.existsSync(p)) return null;
          return { name, buffer: fs.readFileSync(p) };
        })
        .filter((f): f is { name: string; buffer: Buffer } => f !== null);
      if (files.length === 0) continue;
      byLabel.set(
        seed.label,
        createFileSource(seed.label, files, seed.instructions),
      );
    }

    if (cfg.tiers) {
      const tiers = readTiers().map((t) => {
        const labels = cfg.tiers![t.id];
        if (!labels) return t;
        const ids = labels
          .map((l) => byLabel.get(l)?.id)
          .filter((id): id is string => !!id);
        // Only overwrite an empty tier — never clobber a presenter's edits.
        return t.sourceIds.length === 0 ? { ...t, sourceIds: ids } : t;
      });
      writeTiers(tiers);
    }
  }

  return {
    listSources,
    getSource,
    createFileSource,
    deleteSource,
    sourceDir,
    readTiers,
    writeTiers,
    ensureSeeds,
  };
}

export const contextLibrary = createContextLibrary(DEFAULT_DATA_DIR);
