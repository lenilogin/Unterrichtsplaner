import { Fragment, useEffect, useMemo, useRef } from "react";
import EditableCell from "./EditableCell";
import {
  appendEntry,
  insertEntryAfter,
  updateEntry,
  deleteEntry,
} from "../services/firestore";
import {
  formatGermanDate,
  compareIso,
  todayIso,
  excludedRangesBetween,
  formatShortDate,
} from "../utils/dateUtils";

export default function PlanTable({ teamId, subjectId, entries, settings, roughPlanHint }) {
  const rowRefs = useRef({});

  const sorted = useMemo(
    () => [...entries].sort((a, b) => compareIso(a.date, b.date)),
    [entries]
  );

  const today = todayIso();

  const closestId = useMemo(() => {
    if (sorted.length === 0) return null;
    let best = sorted[0];
    let bestDiff = Infinity;
    for (const e of sorted) {
      const diff = Math.abs(new Date(e.date) - new Date(today));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = e;
      }
    }
    return best.id;
  }, [sorted, today]);

  function scrollToToday(behavior = "smooth") {
    const el = rowRefs.current[closestId];
    if (el) el.scrollIntoView({ behavior, block: "center" });
  }

  useEffect(() => {
    // Beim ersten Laden der Planung automatisch zum aktuellen/nächstgelegenen
    // Datum scrollen.
    const t = setTimeout(() => scrollToToday("auto"), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  async function handleAppend() {
    await appendEntry(teamId, subjectId, entries, settings);
    setTimeout(() => scrollToToday(), 100);
  }

  async function handleInsert(afterId) {
    await insertEntryAfter(teamId, subjectId, entries, settings, afterId);
  }

  async function handleDelete(entryId) {
    if (!confirm("Diese Zeile wirklich löschen?")) return;
    await deleteEntry(teamId, subjectId, entryId);
  }

  return (
    <div className="plan-table-wrap">
      <div className="plan-toolbar">
        <button className="today-btn" onClick={() => scrollToToday()}>
          Heute
        </button>
      </div>

      <table className="plan-table">
        <thead>
          <tr>
            <th className="col-date">Datum</th>
            <th>Stundenplanung</th>
            <th>Hausaufgabe</th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => {
            const prev = sorted[idx - 1];
            const gaps = prev
              ? excludedRangesBetween(prev.date, entry.date, settings.excludedRanges)
              : [];
            const hint = roughPlanHint?.(entry.date);

            return (
              <Fragment key={entry.id}>
                {gaps.map((range) => (
                  <tr key={range.id || range.start} className="excluded-row">
                    <td colSpan={4}>
                      {range.label || "Ausgeplant"}: {formatShortDate(range.start)} –{" "}
                      {formatShortDate(range.end)}
                    </td>
                  </tr>
                ))}
                <tr
                  key={entry.id}
                  ref={(el) => (rowRefs.current[entry.id] = el)}
                  className={entry.id === closestId ? "today-row" : ""}
                >
                  <td className="col-date">
                    {formatGermanDate(entry.date)}
                    {hint && (
                      <div className="rough-hint">
                        Achtung: Laut Grobplanung müsstest du hier mit „{hint}“ starten.
                      </div>
                    )}
                  </td>
                  <td>
                    <EditableCell
                      value={entry.stundenplanung}
                      placeholder="Stundenplanung …"
                      onSave={(v) =>
                        updateEntry(teamId, subjectId, entry.id, { stundenplanung: v })
                      }
                    />
                  </td>
                  <td>
                    <EditableCell
                      value={entry.hausaufgabe}
                      placeholder="Hausaufgabe …"
                      onSave={(v) =>
                        updateEntry(teamId, subjectId, entry.id, { hausaufgabe: v })
                      }
                    />
                  </td>
                  <td className="col-actions">
                    <div className="row-actions">
                      <button
                        className="icon-btn subtle"
                        title="Zeile danach einfügen"
                        onClick={() => handleInsert(entry.id)}
                      >
                        +
                      </button>
                      <button
                        className="icon-btn subtle"
                        title="Zeile löschen"
                        onClick={() => handleDelete(entry.id)}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <button className="add-row-btn" onClick={handleAppend}>
        + Neue Zeile
      </button>
    </div>
  );
}
