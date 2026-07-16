import { useEffect, useMemo, useRef, useState } from "react";
import PasswordGate, { isUnlocked } from "./components/PasswordGate";
import Sidebar from "./components/Sidebar";
import NewSchoolYearDialog from "./components/NewSchoolYearDialog";
import NewSubjectDialog from "./components/NewSubjectDialog";
import SettingsModal from "./components/SettingsModal";
import PlanTable from "./components/PlanTable";
import MonthView from "./components/MonthView";
import RoughPlan from "./components/RoughPlan";
import PdfExportModal from "./components/PdfExportModal";
import PrintView from "./components/PrintView";
import {
  subscribeSchoolYears,
  subscribeTeams,
  subscribeSubjects,
  subscribeEntries,
  subscribeRoughPlan,
  migrateLegacyDataIfNeeded,
} from "./services/firestore";
import { ensureAnonymousAuth } from "./firebase";
import { addDaysIso } from "./utils/dateUtils";
import "./App.css";

export default function App() {
  const [unlocked, setUnlocked] = useState(isUnlocked());

  const [schoolYears, setSchoolYears] = useState([]);
  const [teams, setTeams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [roughBlocks, setRoughBlocks] = useState([]);

  const [currentSchoolYearId, setCurrentSchoolYearId] = useState(null);
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [currentSubjectId, setCurrentSubjectId] = useState(null);

  const [showNewSchoolYear, setShowNewSchoolYear] = useState(false);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPdfExport, setShowPdfExport] = useState(false);
  const [printSpec, setPrintSpec] = useState(null);
  const [view, setView] = useState("table"); // table | month | rough

  const migratingRef = useRef(false);

  // Falls die Sitzung schon entsperrt war (sessionStorage), trotzdem die
  // anonyme Firebase-Anmeldung sicherstellen (z.B. nach Reload).
  useEffect(() => {
    if (unlocked) ensureAnonymousAuth().catch(() => setUnlocked(false));
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    return subscribeSchoolYears(setSchoolYears);
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    return subscribeTeams(setTeams);
  }, [unlocked]);

  // Einmalige Migration: Falls bereits Teams existieren, aber noch kein
  // Schuljahr angelegt wurde (Zustand vor der Schuljahr-Ebene), wird
  // automatisch ein Schuljahr aus den alten Fach-Einstellungen erzeugt und
  // alle bestehenden Teams werden ihm zugeordnet. Fächer/Einträge bleiben
  // dabei unverändert.
  useEffect(() => {
    if (!unlocked) return;
    if (migratingRef.current) return;
    if (schoolYears.length > 0) return;
    if (teams.length === 0) return;
    migratingRef.current = true;
    migrateLegacyDataIfNeeded(teams).catch((err) => {
      console.error("Migration fehlgeschlagen:", err);
      migratingRef.current = false;
    });
  }, [unlocked, schoolYears, teams]);

  // Automatisch das einzige vorhandene Schuljahr auswählen, damit man nicht
  // extra klicken muss, wenn es nur eines gibt.
  useEffect(() => {
    if (currentSchoolYearId) return;
    if (schoolYears.length === 1) setCurrentSchoolYearId(schoolYears[0].id);
  }, [schoolYears, currentSchoolYearId]);

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
    if (!currentTeamId || !currentSubjectId) {
      setRoughBlocks([]);
      return;
    }
    return subscribeRoughPlan(currentTeamId, currentSubjectId, setRoughBlocks);
  }, [currentTeamId, currentSubjectId]);

  const currentSchoolYear = schoolYears.find((y) => y.id === currentSchoolYearId);
  const currentTeam = teams.find((t) => t.id === currentTeamId);
  const currentSubject = subjects.find((s) => s.id === currentSubjectId);

  // Wirksame Einstellungen für die aktuelle Planung: Wochenend- und
  // Ferien/Feiertags-Einstellungen kommen vom Schuljahr (gelten für alle
  // Teams), zusätzliche ausgeplante Zeiträume (Ausflüge o.ä.) kommen vom
  // Team selbst und werden einfach dazu gemischt. Alle bisherigen
  // Verbraucher (PlanTable, MonthView, PdfExportModal, ...) bekommen davon
  // nichts mit - für sie sieht es weiterhin wie ein einzelnes settings-
  // Objekt aus.
  const settings = useMemo(
    () => ({
      excludeSaturday: currentSchoolYear?.excludeSaturday ?? true,
      excludeSunday: currentSchoolYear?.excludeSunday ?? true,
      excludedRanges: [
        ...(currentSchoolYear?.excludedRanges || []),
        ...(currentTeam?.excludedRanges || []),
      ],
    }),
    [currentSchoolYear, currentTeam]
  );

  // Zeigt einen Hinweis in der Tabellenansicht, wenn an diesem Tag laut
  // Grobplanung eigentlich ein neues Thema starten oder ein Thema fertig
  // sein müsste.
  function roughPlanHint(iso) {
    const startingBlock = roughBlocks.find((b) => b.start === iso);
    if (startingBlock) return { type: "start", title: startingBlock.title };

    const endingBlock = roughBlocks.find((b) => b.end === iso);
    if (endingBlock) {
      const nextStartsRightAfter = roughBlocks.some(
        (b) => b.start === addDaysIso(iso, 1)
      );
      if (!nextStartsRightAfter) return { type: "end", title: endingBlock.title };
    }
    return null;
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
    <>
      <div className="app-shell">
        <Sidebar
          schoolYears={schoolYears}
          currentSchoolYearId={currentSchoolYearId}
          onSelectSchoolYear={(id) => {
            setCurrentSchoolYearId(id);
            setCurrentTeamId(null);
            setCurrentSubjectId(null);
          }}
          onNewSchoolYear={() => setShowNewSchoolYear(true)}
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
          {currentSubject && currentSchoolYear && currentTeam ? (
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
                  schoolYear={currentSchoolYear}
                  blocks={roughBlocks}
                />
              )}
            </>
          ) : (
            <div className="empty-state">
              {!currentSchoolYearId
                ? "Wähle links ein Schuljahr aus oder lege ein neues an."
                : !currentTeamId
                ? "Wähle links ein Team aus oder lege ein neues an."
                : "Wähle ein Fach aus oder lege ein neues an."}
            </div>
          )}
        </main>

        {showNewSchoolYear && (
          <NewSchoolYearDialog
            onClose={() => setShowNewSchoolYear(false)}
            onCreated={(id) => {
              setCurrentSchoolYearId(id);
              setShowNewSchoolYear(false);
            }}
          />
        )}

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

        {showSettings && currentSchoolYear && currentTeam && (
          <SettingsModal
            schoolYear={currentSchoolYear}
            team={currentTeam}
            onClose={() => setShowSettings(false)}
          />
        )}

        {showPdfExport && currentSubject && (
          <PdfExportModal
            view={view}
            entries={entries}
            settings={settings}
            subject={currentSubject}
            teamName={currentTeam?.name}
            schoolYear={currentSchoolYear}
            roughBlocks={roughBlocks}
            onClose={() => setShowPdfExport(false)}
            onExport={(spec) => {
              setShowPdfExport(false);
              setPrintSpec(spec);
            }}
          />
        )}
      </div>

      <PrintView spec={printSpec} />
    </>
  );
}
