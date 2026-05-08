import { useState } from "react";
import type { Skill } from "../types";

export function SkillsPage({ skills }: { skills: Skill[] }) {
  const defaultSkills = skills.filter((s) => s.category !== "pon");
  const [viewing, setViewing] = useState<{
    id: string;
    name: string;
    content: string;
  } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function viewSkill(skill: Skill) {
    setLoadingId(skill.id);
    try {
      const res = await fetch(`/api/skills/${skill.id}/content`);
      if (!res.ok) return;
      const data = await res.json();
      setViewing(data);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="page page-skills">
      <header className="page-head">
        <h1>Skills</h1>
        <p>These are the skills you can load into a generation.</p>
      </header>

      <section className="panel">
        <header className="panel-head">
          <h2>All Skills</h2>
          <span className="badge">{defaultSkills.length}</span>
        </header>
        <p className="hint">
          Click "View" to see the full skill document.
        </p>

        {defaultSkills.length === 0 ? (
          <div className="empty">No skills found.</div>
        ) : (
          <ul className="skill-list">
            {defaultSkills.map((s) => (
              <li key={s.id} className="skill-row">
                <div className="skill" style={{ cursor: "default" }}>
                  <div>
                    <div className="name">{s.name}</div>
                    <div className="desc">{s.description}</div>
                  </div>
                </div>
                <button
                  className="ghost mini"
                  onClick={() => viewSkill(s)}
                  disabled={loadingId === s.id}
                >
                  {loadingId === s.id ? "loading..." : "view"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewing && (
        <div className="skill-modal-overlay" onClick={() => setViewing(null)}>
          <div className="skill-modal" onClick={(e) => e.stopPropagation()}>
            <div className="skill-modal-header">
              <h2>{viewing.name}</h2>
              <button className="ghost mini" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
            <pre>{viewing.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
