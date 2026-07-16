import { useMemo, useState } from "react";
import {
  compareIso,
  daysBetween,
  excludedRangesBetween,
  formatShortDate,
  todayIso,
  weekRangeContaining,
} from "../utils/dateUtils";

// Ermittelt alle unterschiedlichen "Unterrichtswochen" (Dienstag-Montag),
// die in den vorhandenen Einträgen vorkommen - für die Wochenauswahl beim
// PDF-Export der Tabellenansicht.
function distinctWeeks(entries) {
  const map = new Map();
  for (const e of entries) {
    const w = weekRangeContaining(e.date);
    if (!map.has(w.start)) map.set(w.start, w);
  }
  return Array.from(map.values()).sort((a, b) => compareIso(a.start, b.start));
}

// Baut die Zeilen (inkl. grau markierter Lücken für ausgeplante Zeiträume)
// für die druckbare Tabellenansicht - identisch zur Logik in PlanTable.
function buildPlanRows(entries, settings) {
  const sorted = [...entries].sort((a, b) => compareIso(a.date, b.date));
  const rows = [];
  let prevDate = null;
  for (const e of sorted) {
    const gaps = excludedRangesBetween(prevDate, e.date, settings?.excludedRanges);
    for (const g of gaps) {
      rows.push({
        isGap: true,
        key: `gap-${g.start}`,
        label: `${formatShortDate(g.start)} – ${formatShortDate(g.end)}`,
      });
    }
    rows.push({
      isGap: false,
      key: e.id || e.date,
      date: e.date,
      stundenplanung: e.stundenplanung,
      hausaufgabe: e.hausaufgabe,
    });
    prevDate = e.date;
  }
  return rows;
}

function subtitle(teamName, subjectName) {
  return [teamName, subjectName].filter(Boolean).join(" – ");
}

export default function PdfExportModal({
  view,
  entries,
  settings,
  subject,
  teamName,
  schoolYear,
  roughBlocks,
  onClose,
  onExport,
}) {
  const weeks = useMemo(() => distinctWeeks(entries), [entries]);

  const [tableMode, setTableMode] = useState("last2");
  const [rangeStart, setRangeStart] = useState(todayIso());
  const [rangeEnd, setRangeEnd] = useState(todayIso());
  const [selectedWeeks, setSelectedWeeks] = useState(() => new Set());

  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [monthValue, setMonthValue] = useState(currentMonthValue);

  const [roughScope, setRoughScope] = useState("year");

  function toggleWeek(startIso) {
    setSelectedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(startIso)) next.delete(startIso);
      else next.add(startIso);
      return next;
    });
  }

  function handleTableExport() {
    let filtered = entries;
    let from = null;
    let to = null;

    if (tableMode === "last2") {
      const last2 = weeks.slice(-2);
      if (last2.length) {
        from = last2[0].start;
        to = last2[last2.length - 1].end;
        filtered = entries.filter((e) => e.date >= from && e.date <= to);
      } else {
        filtered = [];
      }
    } else if (tableMode === "range") {
      from = rangeStart;
      to = rangeEnd;
      filtered = entries.filter((e) => e.date >= rangeStart && e.date <= rangeEnd);
    } else if (tableMode === "weeks") {
      const chosen = weeks.filter((w) => selectedWeeks.has(w.start));
      filtered = entries.filter((e) =>
        chosen.some((w) => e.date >= w.start && e.date <= w.end)
      );
      if (chosen.length) {
        from = chosen[0].start;
        to = chosen[chosen.length - 1].end;
      }
    } else {
      const sorted = [...entries].sort((a, b) => compareIso(a.date, b.date));
      if (sorted.length) {
        from = sorted[0].date;
        to = sorted[sorted.length - 1].date;
      }
    }

    onExport({
      type: "plan",
      subjectName: subject.name,
      heading: from && to
        ? `Unterrichtsplanung vom ${formatShortDate(from)} bis ${formatShortDate(to)}`
        : "Unterrichtsplanung",
      subheading: subtitle(teamName, subject.name),
      rows: buildPlanRows(filtered, settings),
    });
  }

  function handleMonthExport() {
    const [y, m] = monthValue.split("-").map(Number);
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const filtered = entries.filter((e) => e.date >= from && e.date <= to);
    onExport({
      type: "plan",
      subjectName: subject.name,
      heading: `Unterrichtsplanung vom ${formatShortDate(from)} bis ${formatShortDate(to)}`,
      subheading: subtitle(teamName, subject.name),
      rows: buildPlanRows(filtered, settings),
    });
  }

  function handleRoughExport() {
    const start = schoolYear?.schoolYearStart;
    const end = schoolYear?.schoolYearEnd;
    const mid = schoolYear?.semesterStart;
    let from = start;
    let to = end;
    if (roughScope === "h1" && mid) {
      to = mid;
    } else if (roughScope === "h2" && mid) {
      from = mid;
    }
    const blocks = [...roughBlocks]
      .filter((b) => b.end >= from && b.start <= to)
      .sort((a, b) => compareIso(a.start, b.start));

    onExport({
      type: "rough",
      subjectName: subject.name,
      heading: `Unterrichtsplanung vom ${formatShortDate(from)} bis ${formatShortDate(to)}`,
      subheading: subtitle(teamName, subject.name),
      rows: blocks.map((b) => ({
        key: b.id,
        title: b.title,
        start: formatShortDate(b.start),
        end: formatShortDate(b.end),
        days: daysBetween(b.start, b.end) + 1,
      })),
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Als PDF exportieren</h2>

        {view === "table" && (
          <div className="form-grid">
            <label className="checkbox-row">
              <input
                type="radio"
                name="tableMode"
                checked={tableMode === "last2"}
                onChange={() => setTableMode("last2")}
              />
              Letzte 2 geplante Wochen
            </label>
            <label className="checkbox-row">
              <input
                type="radio"
                name="tableMode"
                checked={tableMode === "all"}
                onChange={() => setTableMode("all")}
              />
              Alles
            </label>
            <label className="checkbox-row">
              <input
                type="radio"
                name="tableMode"
                checked={tableMode === "range"}
                onChange={() => setTableMode("range")}
              />
              Benutzerdefinierter Zeitraum
            </label>
            {tableMode === "range" && (
              <div className="inline-form">
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </div>
            )}
            <label className="checkbox-row">
              <input
                type="radio"
                name="tableMode"
                checked={tableMode === "weeks"}
                onChange={() => setTableMode("weeks")}
              />
              Wochen auswählen
            </label>
            {tableMode === "weeks" && (
              <ul className="range-list">
                {weeks.length === 0 && <li className="empty">Keine Wochen vorhanden</li>}
                {weeks.map((w) => (
                  <li key={w.start}>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedWeeks.has(w.start)}
                        onChange={() => toggleWeek(w.start)}
                      />
                      {formatShortDate(w.start)} – {formatShortDate(w.end)}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="roughplan-hint-text">
              Hinweis: Eine Druck-Woche läuft Dienstag bis Montag.
            </p>
          </div>
        )}

        {view === "month" && (
          <div className="form-grid">
            <label>
              Monat
              <input
                type="month"
                value={monthValue}
                onChange={(e) => setMonthValue(e.target.value)}
              />
            </label>
          </div>
        )}

        {view === "rough" && (
          <div className="form-grid">
            <label className="checkbox-row">
              <input
                type="radio"
                name="roughScope"
                checked={roughScope === "year"}
                onChange={() => setRoughScope("year")}
              />
              Ganzjahr
            </label>
            <label className="checkbox-row">
              <input
                type="radio"
                name="roughScope"
                checked={roughScope === "h1"}
                onChange={() => setRoughScope("h1")}
              />
              1. Halbjahr
            </label>
            <label className="checkbox-row">
              <input
                type="radio"
                name="roughScope"
                checked={roughScope === "h2"}
                onChange={() => setRoughScope("h2")}
              />
              2. Halbjahr
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => {
              if (view === "table") handleTableExport();
              else if (view === "month") handleMonthExport();
              else if (view === "rough") handleRoughExport();
            }}
          >
            PDF erstellen
          </button>
        </div>
      </div>
    </div>
  );
}
