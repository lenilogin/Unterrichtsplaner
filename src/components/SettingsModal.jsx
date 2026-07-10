import { useState } from "react";
import { updateSettings, updateSubject } from "../services/firestore";

export default function SettingsModal({ teamId, subject, settings, onClose }) {
  const [excludeSaturday, setExcludeSaturday] = useState(!!settings.excludeSaturday);
  const [excludeSunday, setExcludeSunday] = useState(!!settings.excludeSunday);
  const [ranges, setRanges] = useState(settings.excludedRanges || []);
  const [newRange, setNewRange] = useState({ label: "", start: "", end: "" });

  const [schoolYearStart, setSchoolYearStart] = useState(subject.schoolYearStart || "");
  const [schoolYearEnd, setSchoolYearEnd] = useState(subject.schoolYearEnd || "");
  const [semesterStart, setSemesterStart] = useState(subject.semesterStart || "");

  const [saving, setSaving] = useState(false);

  function addRange() {
    if (!newRange.label || !newRange.start || !newRange.end) return;
    setRanges((r) => [...r, { ...newRange, id: crypto.randomUUID() }]);
    setNewRange({ label: "", start: "", end: "" });
  }

  function removeRange(id) {
    setRanges((r) => r.filter((x) => x.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings(teamId, subject.id, {
        excludeSaturday,
        excludeSunday,
        excludedRanges: ranges,
      });
      await updateSubject(teamId, subject.id, {
        schoolYearStart,
        schoolYearEnd,
        semesterStart,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Einstellungen – {subject.name}</h2>

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
          <h3>Ausgeplante Zeiträume (Ferien, Feiertage, Ausflüge …)</h3>
          <ul className="range-list">
            {ranges.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.label}</strong>: {r.start} – {r.end}
                </span>
                <button className="icon-btn subtle" onClick={() => removeRange(r.id)}>
                  ×
                </button>
              </li>
            ))}
            {ranges.length === 0 && <li className="empty">Keine Zeiträume angelegt.</li>}
          </ul>
          <div className="inline-form range-form">
            <input
              placeholder="Bezeichnung (z.B. Herbstferien)"
              value={newRange.label}
              onChange={(e) => setNewRange((r) => ({ ...r, label: e.target.value }))}
            />
            <input
              type="date"
              value={newRange.start}
              onChange={(e) => setNewRange((r) => ({ ...r, start: e.target.value }))}
            />
            <input
              type="date"
              value={newRange.end}
              onChange={(e) => setNewRange((r) => ({ ...r, end: e.target.value }))}
            />
            <button type="button" onClick={addRange}>
              + Hinzufügen
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>Schuljahresdaten</h3>
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
