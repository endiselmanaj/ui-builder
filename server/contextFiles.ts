import fs from "fs";
import path from "path";

export type ContextInstallEntry = {
  slug: string;
  files: { name: string; absPath: string }[];
};

export function copyContextEntries(
  destBaseDir: string,
  entries: ContextInstallEntry[],
): void {
  for (const entry of entries) {
    const dir = path.join(destBaseDir, "context", entry.slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of entry.files) {
      if (!fs.existsSync(f.absPath)) continue;
      fs.copyFileSync(f.absPath, path.join(dir, path.basename(f.name)));
    }
  }
}
