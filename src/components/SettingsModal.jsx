import { useState } from "react";
import { updateSchoolYear, updateTeam } from "../services/firestore";

export default function SettingsModal({ schoolYear, team, onClose }) {
  // ---------- Schuljahr (gilt für alle Teams dieses Schuljahres) ----------
  const [syName, setSyName] = useState(schoolYear.name || "");
  const [excludeSaturday, setExcludeSaturday] = useState(!!schoolYear.excludeSaturday);
  const [excludeSunday, setExcludeSunday] = useState(!!schoolYear.excludeSunday);
  const [globalRanges, setGlobalRanges] = useState(schoolYear.excludedRanges || []);
  const [newGlobalRange, setNewGlobalRange] = useState({ label: "", start: "", end: "" });

  const [schoolYearStart, setSchoolYearStart] = useState(schoolYear.schoolYearStart || "");
  const [schoolYearEnd, setSchoolYearEnd] = useState(schoolYear.schoolYearEnd || "");
  const [semesterStart, setSemesterStart] = useState(schoolYear.semesterStart || "");

  // ---------- Team (nur für dieses eine Team) ----------
  const [teamRanges, setTeamRanges] = useState(team.excludedRanges || []);
  const [newTeamRange, setNewTeamRange] = useState({ label: "", start: "", end: "" });

  const [saving, setSaving] = useState(false);

  function addGlobalRange() {
    if (!newGlobalRange.label || !newGlobalRange.start || !newGlobalRange.end) return;
    setGlobalRanges((r) => [...r, { ...newGlobalRange, id: crypto.randomUUID() }]);
    setNewGlobalRange({ label: "", start: "", end: "" });
  }
  function removeGlobalRange(id) {
    setGlobalRanges((r) => r.filter((x) => x.id !== id));
  }

  function addTeamRange() {
    if (!newTeamRange.label || !newTeamRange.start || !newTeamRange.end) return;
    setTeamRanges((r) => [...r, { ...newTeamRange, id: crypto.randomUUID() }]);
    setNewTeamRange({ label: "", start: "", end: "" });
  }
  function removeTeamRange(id) {
    setTeamRanges((r) => r.filter((x) => x.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSchoolYear(schoolYear.id, {
        name: syName,
        excludeSaturday,
        excludeSunday,
        excludedRanges: globalRanges,
        schoolYearStart,
        schoolYearEnd,
        semesterStart,
      });
      await updateTeam(team.id, {
        excludedRanges: teamRanges,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Einstellungen</h2>

        <h3 className="settings-group-title">Schuljahr „{schoolYear.name}" (für alle Teams)</h3>

        <section className="settings-section">
          <h3>Bezeichnung &amp; Schuljahresdaten</h3>
          <label>
            Bezeichnung
            <input value={syName} onChange={(e) => setSyName(e.target.value)} />
          </label>
          <label>
            Schuljahresbeginn
            <input
              type="date"
              value={schoolYearStart}
              onChange={(e) => setSchoolYearStart(e.target.value)}
            />
          </label>
          <label>
            Schuljahresende
            <input
              type="date"
              value={schoolYearEnd}
              onChange={(e) => setSchoolYearEnd(e.target.value)}
            />
          </label>
          <label>
            Beginn 2. Halbjahr
            <input
              type="date"
              value={semesterStart}
              onChange={(e) => setSemesterStart(e.target.value)}
            />
          </label>
        </section>

        <section className="settings-section">
          <h3>Wochenenden</h3>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={excludeSaturday}
              onChange={(e) => setExcludeSaturday(e.target.checked)}
            />
            Samstage ausplanen
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={excludeSunday}
              onChange={(e) => setExcludeSunday(e.target.checked)}
            />
            Sonntage ausplanen
          </label>
        </section>

        <section className="settings-section">
          <h3>Ferien &amp; Feiertage (gilt für alle Teams dieses Schuljahres)</h3>
          <ul className="range-list">
            {globalRanges.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.label}</strong>: {r.start} – {r.end}
                </span>
                <button className="icon-btn subtle" onClick={() => removeGlobalRange(r.id)}>
                  ×
                </button>
              </li>
            ))}
            {globalRanges.length === 0 && <li className="empty">Keine Zeiträume angelegt.</li>}
          </ul>
          <div className="inline-form range-form">
            <input
              placeholder="Bezeichnung (z.B. Herbstferien)"
              value={newGlobalRange.label}
              onChange={(e) => setNewGlobalRange((r) => ({ ...r, label: e.target.value }))}
            />
            <input
              type="date"
              value={newGlobalRange.start}
              onChange={(e) => setNewGlobalRange((r) => ({ ...r, start: e.target.value }))}
            />
            <input
              type="date"
              value={newGlobalRange.end}
              onChange={(e) => setNewGlobalRange((r) => ({ ...r, end: e.target.value }))}
            />
            <button type="button" onClick={addGlobalRange}>
              + Hinzufügen
            </button>
          </div>
        </section>

        <h3 className="settings-group-title">Team „{team.name}" (nur für dieses Team)</h3>

        <section className="settings-section">
          <h3>Zusätzliche ausgeplante Zeiträume (z.B. Ausflüge, Klassenfahrten)</h3>
          <ul className="range-list">
            {teamRanges.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.label}</strong>: {r.start} – {r.end}
                </span>
                <button className="icon-btn subtle" onClick={() => removeTeamRange(r.id)}>
                  ×
                </button>
              </li>
            ))}
            {teamRanges.length === 0 && <li className="empty">Keine Zeiträume angelegt.</li>}
          </ul>
          <div className="inline-form range-form">
            <input
              placeholder="Bezeichnung (z.B. Klassenfahrt)"
              value={newTeamRange.label}
              onChange={(e) => setNewTeamRange((r) => ({ ...r, label: e.target.value }))}
            />
            <input
              type="date"
              value={newTeamRange.start}
              onChange={(e) => setNewTeamRange((r) => ({ ...r, start: e.target.value }))}
            />
            <input
              type="date"
              value={newTeamRange.end}
              onChange={(e) => setNewTeamRange((r) => ({ ...r, end: e.target.value }))}
            />
            <button type="button" onClick={addTeamRange}>
              + Hinzufügen
            </button>
          </div>
        </section>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
