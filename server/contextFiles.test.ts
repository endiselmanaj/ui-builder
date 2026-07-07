import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { copyContextEntries } from "./contextFiles.js";

let base: string;
let srcDir: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "ctxfiles-dest-"));
  srcDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctxfiles-src-"));
});

describe("copyContextEntries", () => {
  it("copies each file into context/<slug>/<name>", () => {
    fs.writeFileSync(path.join(srcDir, "briefing.pdf"), "PDF");
    fs.writeFileSync(path.join(srcDir, "proc.xml"), "<x/>");
    copyContextEntries(base, [
      {
        slug: "briefing-document",
        files: [{ name: "briefing.pdf", absPath: path.join(srcDir, "briefing.pdf") }],
      },
      {
        slug: "process-schematic",
        files: [{ name: "proc.xml", absPath: path.join(srcDir, "proc.xml") }],
      },
    ]);
    expect(
      fs.readFileSync(path.join(base, "context", "briefing-document", "briefing.pdf"), "utf-8"),
    ).toBe("PDF");
    expect(
      fs.readFileSync(path.join(base, "context", "process-schematic", "proc.xml"), "utf-8"),
    ).toBe("<x/>");
  });

  it("skips missing source files without throwing", () => {
    expect(() =>
      copyContextEntries(base, [
        { slug: "x", files: [{ name: "gone.pdf", absPath: path.join(srcDir, "gone.pdf") }] },
      ]),
    ).not.toThrow();
    expect(fs.existsSync(path.join(base, "context", "x", "gone.pdf"))).toBe(false);
  });

  it("uses basename to avoid path traversal in the file name", () => {
    fs.writeFileSync(path.join(srcDir, "evil.pdf"), "E");
    copyContextEntries(base, [
      { slug: "s", files: [{ name: "../../evil.pdf", absPath: path.join(srcDir, "evil.pdf") }] },
    ]);
    expect(fs.existsSync(path.join(base, "context", "s", "evil.pdf"))).toBe(true);
  });
});
