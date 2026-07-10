import { useEffect, useState } from "react";
import PasswordGate, { isUnlocked } from "./components/PasswordGate";
import Sidebar from "./components/Sidebar";
import NewSubjectDialog from "./components/NewSubjectDialog";
import SettingsModal from "./components/SettingsModal";
import PlanTable from "./components/PlanTable";
import {
  subscribeTeams,
  subscribeSubjects,
  subscribeEntries,
  subscribeSettings,
} from "./services/firestore";
import { ensureAnonymousAuth } from "./firebase";
import "./App.css";

export default function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked());

  const [teams, setTeams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState({
    excludeSaturday: true,
    excludeSunday: true,
    excludedRanges: [],
  });

  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [currentSubjectId, setCurrentSubjectId] = useState(null);

  const [showNewSubject, setShowNewSubject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState("table"); // table | month | rough (Phase 2/3)

  // Falls die Sitzung schon entsperrt war (sessionStorage), trotzdem die
  // anonyme Firebase-Anmeldung sicherstellen (z.B. nach Reload).
  useEffect(() => {
    if (unlocked) ensureAnonymousAuth().catch(() => setUnlocked(false));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    return subscribeTeams(setTeams);
  }, [unlocked]);

  useEffect(() => {
    if (!currentTeamId) {
      setSubjects([]);
      return;
    }
    return subscribeSubjects(currentTeamId, setSubjects);
  }, [currentTeamId]);

  useEffect(() => {
    if (!currentTeamId || !currentSubjectId) {
      setEntries([]);
      return;
    }
    return subscribeEntries(currentTeamId, currentSubjectId, setEntries);
  }, [currentTeamId, currentSubjectId]);

  useEffect(() => {
    if (!currentTeamId || !currentSubjectId) return;
    return subscribeSettings(currentTeamId, currentSubjectId, setSettings);
  }, [currentTeamId, currentSubjectId]);

  const currentSubject = subjects.find((s) => s.id === currentSubjectId);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        teams={teams}
        subjects={subjects}
        currentTeamId={currentTeamId}
        currentSubjectId={currentSubjectId}
        onSelectTeam={(id) => {
          setCurrentTeamId(id);
          setCurrentSubjectId(null);
        }}
        onSelectSubject={setCurrentSubjectId}
        onNewSubject={() => setShowNewSubject(true)}
      />

      <main className="main-area">
        {currentSubject ? (
          <>
            <header className="content-header">
              <div className="subject-title">
                <span
                  className="color-dot large"
                  style={{ background: currentSubject.color }}
                />
                <h1>{currentSubject.name}</h1>
              </div>

              <nav className="view-tabs">
                <button
                  className={view === "table" ? "active" : ""}
                  onClick={() => setView("table")}
                >
                  Tabelle
                </button>
                <button
                  className={view === "month" ? "active" : ""}
                  onClick={() => setView("month")}
                  disabled
                  title="Kommt in Phase 2"
                >
                  Monat
                </button>
                <button
                  className={view === "rough" ? "active" : ""}
                  onClick={() => setView("rough")}
                  disabled
                  title="Kommt in Phase 3"
                >
                  Grobplanung
                </button>
              </nav>

              <button
                className="icon-btn gear"
                title="Einstellungen"
                onClick={() => setShowSettings(true)}
              >
                ⚙
              </button>
            </header>

            {view === "table" && (
              <PlanTable
                teamId={currentTeamId}
                subjectId={currentSubjectId}
                entries={entries}
                settings={settings}
              />
            )}
          </>
        ) : (
          <div className="empty-state">
            {currentTeamId
              ? "Wähle ein Fach aus oder lege ein neues an."
              : "Wähle links ein Team aus oder lege ein neues an."}
          </div>
        )}
      </main>

      {showNewSubject && (
        <NewSubjectDialog
          teamId={currentTeamId}
          onClose={() => setShowNewSubject(false)}
          onCreated={(id) => {
            setCurrentSubjectId(id);
            setShowNewSubject(false);
          }}
        />
      )}

      {showSettings && currentSubject && (
        <SettingsModal
          teamId={currentTeamId}
          subject={currentSubject}
          settings={settings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
