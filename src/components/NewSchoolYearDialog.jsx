import { useState } from "react";
import { createSchoolYear } from "../services/firestore";

export default function NewSchoolYearDialog({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [schoolYearStart, setSchoolYearStart] = useState("");
  const [schoolYearEnd, setSchoolYearEnd] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !schoolYearStart || !schoolYearEnd || !semesterStart) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    setSaving(true);
    try {
      const ref = await createSchoolYear({
        name: name.trim(),
        schoolYearStart,
        schoolYearEnd,
        semesterStart,
      });
      onCreated(ref.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Neues Schuljahr anlegen</h2>
        <p className="roughplan-hint-text">
          Gilt für alle Teams, die diesem Schuljahr zugeordnet werden - Schuljahresdaten,
          Wochenend- und Ferien-Einstellungen müssen so nur einmal pro Schuljahr angelegt
          werden.
        </p>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Bezeichnung
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. 2026/2027"
              autoFocus
            />
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

          {error && <div className="gate-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Wird angelegt …" : "Schuljahr anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
