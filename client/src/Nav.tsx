import { Link, useLocation } from "react-router-dom";
import type { Settings as SettingsType } from "./types";

export function Nav({
  onOpenSettings,
  settings,
}: {
  onOpenSettings: () => void;
  settings: SettingsType | null;
}) {
  const { pathname } = useLocation();

  return (
    <nav className="nav">
      <div className="nav-brand">UI Builder</div>
      <div className="nav-tabs">
        <Link
          to="/"
          className={`nav-tab${pathname === "/" ? " active" : ""}`}
        >
          Generate
        </Link>
        <Link
          to="/skills"
          className={`nav-tab${pathname === "/skills" ? " active" : ""}`}
        >
          Skills
        </Link>
      </div>
      <button
        className="ghost nav-settings"
        onClick={onOpenSettings}
        title="Configure claude -p flags"
      >
        ⚙ Settings
        {settings && (
          <span className="settings-summary">
            {settings.model}
            {settings.effort ? ` · ${settings.effort}` : ""}
          </span>
        )}
      </button>
    </nav>
  );
}
