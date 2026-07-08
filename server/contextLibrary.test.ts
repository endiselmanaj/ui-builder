import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { createContextLibrary } from "./contextLibrary.js";

let dataDir: string;
let lib: ReturnType<typeof createContextLibrary>;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctxlib-"));
  lib = createContextLibrary(dataDir);
});

describe("file sources", () => {
  it("createFileSource persists files to disk and lists the source", () => {
    const src = lib.createFileSource("Briefing document", [
      { name: "briefing.pdf", buffer: Buffer.from("pdfbytes") },
    ]);
    expect(src.files).toEqual(["briefing.pdf"]);
    const onDisk = fs.readFileSync(
      path.join(lib.sourceDir(src.id), "briefing.pdf"),
    );
    expect(onDisk.toString()).toBe("pdfbytes");
    expect(lib.listSources().map((s) => s.id)).toContain(src.id);
  });

  it("survives a fresh library instance (reads meta from disk)", () => {
    const src = lib.createFileSource("Schematic", [
      { name: "a.xml", buffer: Buffer.from("<x/>") },
    ]);
    const lib2 = createContextLibrary(dataDir);
    expect(lib2.getSource(src.id)?.label).toBe("Schematic");
  });

  it("createFileSource stores optional instructions", () => {
    const src = lib.createFileSource(
      "Schematic",
      [{ name: "a.xml", buffer: Buffer.from("<x/>") }],
      "The XML is machine-readable and primary.",
    );
    expect(lib.getSource(src.id)?.instructions).toBe(
      "The XML is machine-readable and primary.",
    );
  });
});

describe("tiers", () => {
  it("readTiers returns the two default tiers when unset", () => {
    const tiers = lib.readTiers();
    expect(tiers.map((t) => t.label)).toEqual([
      "Briefing only",
      "Briefing + Schematic",
    ]);
    expect(tiers.every((t) => t.sourceIds.length === 0)).toBe(true);
  });

  it("writeTiers persists and deleteSource strips the id from tiers", () => {
    const src = lib.createFileSource("Briefing document", [
      { name: "b.pdf", buffer: Buffer.from("x") },
    ]);
    const tiers = lib.readTiers();
    tiers[0].sourceIds = [src.id];
    lib.writeTiers(tiers);
    expect(lib.readTiers()[0].sourceIds).toEqual([src.id]);
    lib.deleteSource(src.id);
    expect(lib.readTiers()[0].sourceIds).toEqual([]);
    expect(lib.getSource(src.id)).toBeNull();
  });
});

describe("seeding", () => {
  it("ensureSeeds imports sources from seed.json and wires tiers by label", () => {
    const seedsDir = path.join(dataDir, "context-seeds");
    fs.mkdirSync(seedsDir, { recursive: true });
    fs.writeFileSync(path.join(seedsDir, "briefing.pdf"), "pdf");
    fs.writeFileSync(path.join(seedsDir, "process.xml"), "<x/>");
    fs.writeFileSync(
      path.join(seedsDir, "seed.json"),
      JSON.stringify({
        sources: [
          { label: "Briefing document", files: ["briefing.pdf"] },
          {
            label: "Process schematic",
            files: ["process.xml"],
            instructions: "BPMN process.",
          },
        ],
        tiers: {
          "tier-1": ["Briefing document"],
          "tier-2": ["Briefing document", "Process schematic"],
        },
      }),
    );
    lib.ensureSeeds();
    const labels = lib.listSources().map((s) => s.label);
    expect(labels).toContain("Briefing document");
    expect(labels).toContain("Process schematic");
    const tiers = lib.readTiers();
    expect(tiers[0].sourceIds).toHaveLength(1);
    expect(tiers[1].sourceIds).toHaveLength(2);
    // Idempotent: running again must not duplicate.
    lib.ensureSeeds();
    expect(lib.listSources()).toHaveLength(2);
  });

  it("ensureSeeds is a no-op without a seeds dir", () => {
    expect(() => lib.ensureSeeds()).not.toThrow();
    expect(lib.listSources()).toHaveLength(0);
  });
});
