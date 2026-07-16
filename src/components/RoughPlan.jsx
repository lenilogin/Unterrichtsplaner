import { useEffect, useRef, useState } from "react";
import {
  createRoughBlock,
  updateRoughBlock,
  deleteRoughBlock,
} from "../services/firestore";
import {
  addDaysIso,
  daysBetween,
  compareIso,
  formatShortDate,
  todayIso,
  isoToDate,
  getMonthMatrix,
  monthLabel,
} from "../utils/dateUtils";

// Feste Farbpalette, damit aufeinanderfolgende Themen-Blöcke sich optisch
// unterscheiden (Blöcke überlappen sich nie, daher reicht ein einfaches
// Durchwechseln nach Sortier-Reihenfolge).
const PALETTE = [
  "#5e81ac", "#88c0d0", "#a3be8c", "#ebcb8b",
  "#d08770", "#bf616a", "#b48ead", "#81a1c1",
];

// Sortiert Blöcke nach Startdatum und löst Überlappungen auf:
// - Ein nach hinten verlängerter/verschobener Block schiebt den nächsten
//   Block komplett weiter nach hinten (Dauer bleibt erhalten).
// - Ein nach vorne (links) verlängerter Block VERKÜRZT stattdessen den
//   vorherigen Block (nur dessen Ende rückt vor, der Start bleibt gleich).
function resolveOverlaps(blocks, changedId, newStart, newEnd) {
  let list = blocks.map((b) =>
    b.id === changedId ? { ...b, start: newStart, end: newEnd } : b
  );
  list.sort((a, b) => compareIso(a.start, b.start));

  for (let i = 0; i < list.length - 1; i++) {
    const cur = list[i];
    const next = list[i + 1];
    if (next.start <= cur.end) {
      const duration = daysBetween(next.start, next.end);
      const shiftedStart = addDaysIso(cur.end, 1);
      const shiftedEnd = addDaysIso(shiftedStart, duration);
      list[i + 1] = { ...next, start: shiftedStart, end: shiftedEnd };
    }
  }
  for (let i = list.length - 1; i > 0; i--) {
    const cur = list[i];
    const prev = list[i - 1];
    if (cur.start <= prev.end) {
      let shrunkEnd = addDaysIso(cur.start, -1);
      if (shrunkEnd < prev.start) shrunkEnd = prev.start;
      list[i - 1] = { ...prev, end: shrunkEnd };
    }
  }
  return list;
}

function monthsInRange(startIso, endIso) {
  const start = isoToDate(startIso);
  const end = isoToDate(endIso);
  const months = [];
  let y = start.getFullYear();
  let m = start.getMonth();
  const endY = end.getFullYear();
  const endM = end.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, monthIndex: m });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return months;
}

export default function RoughPlan({ teamId, subjectId, schoolYear, blocks }) {
  const [scope, setScope] = useState("year"); // year | h1 | h2
  const [editingBlock, setEditingBlock] = useState(null);
  const [creatingRange, setCreatingRange] = useState(null);

  const dragStateRef = useRef(null); // {mode, blockId, anchorIso, origStart, origEnd}
  const [hoverIso, setHoverIso] = useState(null);
  const handleMouseUpRef = useRef(() => {});

  const today = todayIso();

  const range = (() => {
    const start = schoolYear.schoolYearStart;
    const end = schoolYear.schoolYearEnd;
    const mid = schoolYear.semesterStart;
    if (scope === "h1" && mid) return { start, end: addDaysIso(mid, -1) };
    if (scope === "h2" && mid) return { start: mid, end };
    return { start, end };
  })();

  const sortedBlocks = [...blocks].sort((a, b) => compareIso(a.start, b.start));
  const colorForBlock = (blockId) => {
    const idx = sortedBlocks.findIndex((b) => b.id === blockId);
    return PALETTE[idx % PALETTE.length];
  };

  // ---------- Live-Vorschau während des Ziehens ----------
  const dragging = dragStateRef.current;
  let previewRange = null;
  if (dragging && hoverIso) {
    if (dragging.mode === "create") {
      const lo = compareIso(dragging.anchorIso, hoverIso) <= 0 ? dragging.anchorIso : hoverIso;
      const hi = compareIso(dragging.anchorIso, hoverIso) <= 0 ? hoverIso : dragging.anchorIso;
      previewRange = { type: "create", start: lo, end: hi };
    } else {
      const deltaDays = daysBetween(dragging.anchorIso, hoverIso);
      let s = dragging.origStart;
      let e = dragging.origEnd;
      if (dragging.mode === "move") {
        s = addDaysIso(dragging.origStart, deltaDays);
        e = addDaysIso(dragging.origEnd, deltaDays);
      } else if (dragging.mode === "resize-left") {
        s = addDaysIso(dragging.origStart, deltaDays);
        if (compareIso(s, e) > 0) s = e;
      } else if (dragging.mode === "resize-right") {
        e = addDaysIso(dragging.origEnd, deltaDays);
        if (compareIso(e, s) < 0) e = s;
      }
      previewRange = { type: "block", blockId: dragging.blockId, start: s, end: e };
    }
  }

  function coveringBlockForDay(iso) {
    if (previewRange?.type === "block" && previewRange.blockId) {
      if (iso >= previewRange.start && iso <= previewRange.end) {
        return sortedBlocks.find((b) => b.id === previewRange.blockId) || null;
      }
    }
    return (
      sortedBlocks.find((b) => {
        if (previewRange?.type === "block" && b.id === previewRange.blockId) return false;
        return iso >= b.start && iso <= b.end;
      }) || null
    );
  }

  function isCreatePreviewDay(iso) {
    return (
      previewRange?.type === "create" &&
      iso >= previewRange.start &&
      iso <= previewRange.end
    );
  }

  // ---------- Interaktion ----------
  function handleDayMouseDown(iso, coveringBlock) {
    let mode;
    if (!coveringBlock) {
      mode = "create";
    } else if (coveringBlock.start === coveringBlock.end) {
      mode = "move";
    } else if (iso === coveringBlock.start) {
      mode = "resize-left";
    } else if (iso === coveringBlock.end) {
      mode = "resize-right";
    } else {
      mode = "move";
    }
    dragStateRef.current = {
      mode,
      blockId: coveringBlock?.id ?? null,
      anchorIso: iso,
      origStart: coveringBlock?.start,
      origEnd: coveringBlock?.end,
    };
    setHoverIso(iso);
  }

  function handleDayMouseEnter(iso) {
    if (dragStateRef.current) setHoverIso(iso);
  }

  async function persistChanges(list) {
    const changed = list.filter((b) => {
      const orig = blocks.find((o) => o.id === b.id);
      return orig && (orig.start !== b.start || orig.end !== b.end);
    });
    await Promise.all(
      changed.map((b) =>
        updateRoughBlock(teamId, subjectId, b.id, { start: b.start, end: b.end })
      )
    );
  }

  handleMouseUpRef.current = function handleMouseUp() {
    const ds = dragStateRef.current;
    dragStateRef.current = null;
    setHoverIso(null);
    if (!ds) return;
    const hi = hoverIso || ds.anchorIso;

    if (ds.mode === "create") {
      const lo = compareIso(ds.anchorIso, hi) <= 0 ? ds.anchorIso : hi;
      const top = compareIso(ds.anchorIso, hi) <= 0 ? hi : ds.anchorIso;
      setCreatingRange({ start: lo, end: top });
      return;
    }

    if (hi === ds.anchorIso) {
      // Kein Ziehen erkannt - als Klick werten und Bearbeiten-Dialog öffnen.
      const block = blocks.find((b) => b.id === ds.blockId);
      if (block) setEditingBlock(block);
      return;
    }

    const deltaDays = daysBetween(ds.anchorIso, hi);
    let newStart = ds.origStart;
    let newEnd = ds.origEnd;
    if (ds.mode === "move") {
      newStart = addDaysIso(ds.origStart, deltaDays);
      newEnd = addDaysIso(ds.origEnd, deltaDays);
    } else if (ds.mode === "resize-left") {
      newStart = addDaysIso(ds.origStart, deltaDays);
      if (newStart > ds.origEnd) newStart = ds.origEnd;
    } else if (ds.mode === "resize-right") {
      newEnd = addDaysIso(ds.origEnd, deltaDays);
      if (newEnd < ds.origStart) newEnd = ds.origStart;
    }

    const resolved = resolveOverlaps(blocks, ds.blockId, newStart, newEnd);
    persistChanges(resolved);
  };

  useEffect(() => {
    function onWindowMouseUp(e) {
      handleMouseUpRef.current(e);
    }
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, []);

  async function handleDeleteBlock(id) {
    if (!confirm("Diesen Block wirklich löschen?")) return;
    await deleteRoughBlock(teamId, subjectId, id);
  }

  const months = monthsInRange(range.start, range.end);

  return (
    <div className="roughplan-view">
      <div className="roughplan-toolbar">
        <div className="scope-tabs">
          <button className={scope === "year" ? "active" : ""} onClick={() => setScope("year")}>
            Ganzjahr
          </button>
          <button className={scope === "h1" ? "active" : ""} onClick={() => setScope("h1")}>
            1. Halbjahr
          </button>
          <button className={scope === "h2" ? "active" : ""} onClick={() => setScope("h2")}>
            2. Halbjahr
          </button>
        </div>
        <button
          className="link-btn"
          onClick={() =>
            setCreatingRange({ start: range.start, end: addDaysIso(range.start, 13) })
          }
        >
          + Neuer Block
        </button>
      </div>

      <p className="roughplan-hint-text">
        Klicke und ziehe auf einem leeren Tag, um einen neuen Block anzulegen. Bestehende
        Blöcke: in der Mitte ziehen zum Verschieben, am ersten/letzten Tag ziehen zum
        Verlängern/Verkürzen. Ein einfacher Klick auf einen Block öffnet die Bearbeitung.
      </p>

      <div className="roughplan-calendar">
        {months.map(({ year, monthIndex }) => {
          const weeks = getMonthMatrix(year, monthIndex);
          return (
            <div className="rp-month" key={`${year}-${monthIndex}`}>
              <div className="rp-month-title">{monthLabel(year, monthIndex)}</div>
              <div className="rp-month-grid">
                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => (
                  <div className="rp-day-header" key={w}>
                    {w}
                  </div>
                ))}
                {weeks.flat().map((iso) => {
                  const date = new Date(iso);
                  const inMonth = date.getMonth() === monthIndex;
                  const inScope = iso >= range.start && iso <= range.end;
                  const block = inScope ? coveringBlockForDay(iso) : null;
                  const createPreview = inScope && isCreatePreviewDay(iso);
                  const isStart = block && iso === block.start;
                  const showsAdjacentMarker =
                    block &&
                    iso === block.end &&
                    sortedBlocks.some((b) => b.start === addDaysIso(iso, 1));

                  const classes = [
                    "rp-day-cell",
                    !inMonth && "outside",
                    !inScope && "disabled",
                    iso === today && "is-today",
                    createPreview && "rp-create-preview",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <div
                      key={iso}
                      className={classes}
                      style={block ? { background: colorForBlock(block.id) } : undefined}
                      onMouseDown={() => inScope && handleDayMouseDown(iso, block)}
                      onMouseEnter={() => handleDayMouseEnter(iso)}
                      title={
                        block
                          ? `${block.title}: ${formatShortDate(block.start)} – ${formatShortDate(block.end)}`
                          : ""
                      }
                    >
                      <span className="rp-day-num">{date.getDate()}</span>
                      {isStart && <span className="rp-day-label">{block.title}</span>}
                      {showsAdjacentMarker && <span className="rp-adjacent-marker">⇔</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {(creatingRange || editingBlock) && (
        <RoughBlockDialog
          initial={
            editingBlock || { title: "", start: creatingRange.start, end: creatingRange.end }
          }
          isEdit={!!editingBlock}
          onClose={() => {
            setCreatingRange(null);
            setEditingBlock(null);
          }}
          onDelete={
            editingBlock
              ? () => {
                  handleDeleteBlock(editingBlock.id);
                  setEditingBlock(null);
                }
              : null
          }
          onSave={async (data) => {
            if (editingBlock) {
              await updateRoughBlock(teamId, subjectId, editingBlock.id, data);
            } else {
              await createRoughBlock(teamId, subjectId, data);
            }
            setCreatingRange(null);
            setEditingBlock(null);
          }}
        />
      )}
    </div>
  );
}

function RoughBlockDialog({ initial, isEdit, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initial.title || "");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !start || !end || start > end) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), start, end });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? "Block bearbeiten" : "Neuer Block"}</h2>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Thema
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </label>
          <label>
            Start
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            Ende
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <div className="modal-actions">
            {onDelete && (
              <button type="button" onClick={onDelete} className="danger-btn">
                Löschen
              </button>
            )}
            <button type="button" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Speichert …" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
