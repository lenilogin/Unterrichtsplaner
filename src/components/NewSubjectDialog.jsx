import { useState } from "react";
import { createSubject } from "../services/firestore";
import { DEFAULT_COLORS } from "./Sidebar";
import { todayIso } from "../utils/dateUtils";

export default function NewSubjectDialog({ teamId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [startDate, setStartDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !startDate) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    setSaving(true);
    try {
      const ref = await createSubject(teamId, {
        name: name.trim(),
        color,
        startDate,
      });
      onCreated(ref.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Neues Fach anlegen</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Fachname
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>

          <label>
            Farbe
            <div className="color-picker">
              {DEFAULT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={"color-swatch" + (c === color ? " selected" : "")}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-custom"
              />
            </div>
          </label>

          <label>
            Startdatum der Planung
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          {error && <div className="gate-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Wird angelegt …" : "Fach anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
