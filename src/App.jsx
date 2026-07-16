import { useEffect, useState } from "react";
import PasswordGate, { isUnlocked } from "./components/PasswordGate";
import Sidebar from "./components/Sidebar";
import NewSubjectDialog from "./components/NewSubjectDialog";
import SettingsModal from "./components/SettingsModal";
import PlanTable from "./components/PlanTable";
import MonthView from "./components/MonthView";
import RoughPlan from "./components/RoughPlan";
import PdfExportModal from "./components/PdfExportModal";
import PrintView from "./components/PrintView";
import {
  subscribeTeams,
  subscribeSubjects,
  subscribeEntries,
  subscribeSettings,
  subscribeRoughPlan,
} from "./services/firestore";
import { ensureAnonymousAuth } from "./firebase";
import "./App.css";

export default function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked());

  const [teams, setTeams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [roughBlocks, setRoughBlocks] = useState([]);
  const [settings, setSettings] = useState({
    excludeSaturday: true,
    excludeSunday: true,
    excludedRanges: [],
  });

  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [currentSubjectId, setCurrentSubjectId] = useState(null);

  const [showNewSubject, setShowNewSubject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPdfExport, setShowPdfExport] = useState(false);
  const [printSpec, setPrintSpec] = useState(null);
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

  useEffect(() => {
    if (!currentTeamId || !currentSubjectId) {
      setRoughBlocks([]);
      return;
    }
    return subscribeRoughPlan(currentTeamId, currentSubjectId, setRoughBlocks);
  }, [currentTeamId, currentSubjectId]);

  const currentSubject = subjects.find((s) => s.id === currentSubjectId);

  // Zeigt einen Hinweis in der Tabellenansicht, wenn an diesem Tag laut
  // Grobplanung eigentlich ein neues Thema starten sollte.
  function roughPlanHint(iso) {
    const block = roughBlocks.find((b) => b.start === iso);
    return block?.title;
  }

  // Löst den Browser-Druckdialog aus, sobald eine Druck-Spezifikation
  // gesetzt wurde (siehe PdfExportModal). Über den Druckdialog kann die
  // Nutzerin "Als PDF speichern" wählen - so kommen wir ohne zusätzliche
  // Abhängigkeiten (und ohne Firebase-Bezahlplan) zu einem PDF-Export.
  useEffect(() => {
    if (!printSpec) return;
    document.body.classList.add("printing");
    const timer = setTimeout(() => window.print(), 60);
    const handleAfterPrint = () => setPrintSpec(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.classList.remove("printing");
    };
  }, [printSpec]);

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
                >
                  Monat
                </button>
                <button
                  className={view === "rough" ? "active" : ""}
                  onClick={() => setView("rough")}
                >
                  Grobplanung
                </button>
              </nav>

              <button
                className="icon-btn"
                title="Als PDF exportieren"
                onClick={() => setShowPdfExport(true)}
              >
                🖨
              </button>

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
                roughPlanHint={roughPlanHint}
              />
            )}

            {view === "month" && (
              <MonthView entries={entries} settings={settings} />
            )}

            {view === "rough" && (
              <RoughPlan
                teamId={currentTeamId}
                subjectId={currentSubjectId}
                subject={currentSubject}
                blocks={roughBlocks}
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

      {showPdfExport && currentSubject && (
        <PdfExportModal
          view={view}
          entries={entries}
          settings={settings}
          subject={currentSubject}
          roughBlocks={roughBlocks}
          onClose={() => setShowPdfExport(false)}
          onExport={(spec) => {
            setShowPdfExport(false);
            setPrintSpec(spec);
          }}
        />
      )}

      <PrintView spec={printSpec} />
    </div>
  );
}
