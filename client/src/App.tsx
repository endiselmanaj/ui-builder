import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Nav } from "./Nav";
import { GeneratePage } from "./pages/GeneratePage";
import { SkillsPage } from "./pages/SkillsPage";
import { ComparePage } from "./pages/ComparePage";
import { Settings } from "./Settings";
import type {
  Generation,
  Settings as SettingsType,
  Skill,
  Workspace,
} from "./types";

export function App() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [workspace, setWorkspace] = useState<Workspace>({ installed: [] });
  const [loaded, setLoaded] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/workspace").then((r) => r.json()),
      fetch("/api/generations").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(
        ([s, w, g, st]: [Skill[], Workspace, Generation[], SettingsType]) => {
          setSkills(s);
          setWorkspace(w);
          setGenerations(g);
          setSettings(st);
          setReady(true);
        },
      )
      .catch((e) => {
        setError(`init: ${e.message}`);
        setReady(true);
      });
  }, []);


  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, skills: loaded, compare }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body && body.generation) {
          setGenerations((prev) => [body.generation as Generation, ...prev]);
        } else {
          setError(body?.error ?? `HTTP ${res.status}`);
        }
        return;
      }
      const gen = body as Generation;
      setGenerations((prev) => [gen, ...prev]);
    } catch (e: any) {
      setError(e.message ?? "generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteGen(id: string) {
    await fetch(`/api/generations/${id}`, { method: "DELETE" });
    setGenerations((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="shell">
      <Nav
        onOpenSettings={() => setSettingsOpen(true)}
        settings={settings}
      />

      {ready && <Routes>
        <Route
          path="/"
          element={
            <GeneratePage
              prompt={prompt}
              onPromptChange={setPrompt}
              loaded={loaded}
              onLoadedChange={setLoaded}
              compare={compare}
              onCompareChange={setCompare}
              loading={loading}
              onGenerate={generate}
              generations={generations}
              onDeleteGeneration={deleteGen}
              skills={skills}
              workspace={workspace}
              settings={settings}
              onSettingsChange={setSettings}
              error={error}
            />
          }
        />
        <Route path="/skills" element={<SkillsPage skills={skills} />} />
        <Route path="/compare/:generationId" element={<ComparePage />} />
      </Routes>}

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={setSettings}
      />
    </div>
  );
}
