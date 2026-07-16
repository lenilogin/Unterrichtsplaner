import { useMemo, useState } from "react";
import {
  getMonthMatrix,
  monthLabel,
  addMonths,
  todayIso,
  isPlannableDay,
  formatGermanDate,
} from "../utils/dateUtils";

const WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function MonthView({ entries, settings }) {
  const today = todayIso();
  const now = new Date();
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  });
  const [selectedIso, setSelectedIso] = useState(null);

  const entriesByDate = useMemo(() => {
    const map = {};
    for (const e of entries) map[e.date] = e;
    return map;
  }, [entries]);

  const weeks = useMemo(
    () => getMonthMatrix(cursor.year, cursor.monthIndex),
    [cursor]
  );

  function goToMonth(delta) {
    setCursor((c) => addMonths(c.year, c.monthIndex, delta));
  }

  function goToToday() {
    setCursor({ year: now.getFullYear(), monthIndex: now.getMonth() });
  }

  const selectedEntry = selectedIso ? entriesByDate[selectedIso] : null;

  return (
    <div className="month-view">
      <div className="month-toolbar">
        <button className="icon-btn subtle" onClick={() => goToMonth(-1)}>
          ‹
        </button>
        <div className="month-label">{monthLabel(cursor.year, cursor.monthIndex)}</div>
        <button className="icon-btn subtle" onClick={() => goToMonth(1)}>
          ›
        </button>
        <button className="today-btn" onClick={goToToday}>
          Heute
        </button>
      </div>

      <div className="month-grid">
        {WOCHENTAGE_KURZ.map((w) => (
          <div className="month-grid-header" key={w}>
            {w}
          </div>
        ))}

        {weeks.flat().map((iso) => {
          const date = new Date(iso);
          const inMonth = date.getMonth() === cursor.monthIndex;
          const entry = entriesByDate[iso];
          const excluded = !isPlannableDay(iso, settings);
          const classes = [
            "month-cell",
            !inMonth && "outside",
            iso === today && "is-today",
            excluded && "is-excluded",
            entry && "has-entry",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={iso}
              className={classes}
              onClick={() => entry && setSelectedIso(iso)}
              disabled={!entry}
            >
              <span className="month-cell-date">{date.getDate()}</span>
              {entry?.stundenplanung && (
                <span className="month-cell-preview">{entry.stundenplanung}</span>
              )}
              {entry?.hausaufgabe && (
                <span className="month-cell-preview month-cell-ha">HA: {entry.hausaufgabe}</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedEntry && (
        <div className="modal-overlay" onClick={() => setSelectedIso(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{formatGermanDate(selectedEntry.date)}</h2>
            <div className="day-detail-section">
              <div className="day-detail-label">Stundenplanung</div>
              <div className="day-detail-text">
                {selectedEntry.stundenplanung || <em>Keine Angabe</em>}
              </div>
            </div>
            <div className="day-detail-section">
              <div className="day-detail-label">Hausaufgabe</div>
              <div className="day-detail-text">
                {selectedEntry.hausaufgabe || <em>Keine Angabe</em>}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setSelectedIso(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
