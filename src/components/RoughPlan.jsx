import { useEffect, useMemo, useRef, useState } from "react";
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
} from "../utils/dateUtils";

const PX_PER_DAY = 7;

// Sortiert Blöcke nach Startdatum und verschiebt kollidierende Blöcke
// kaskadierend nach vorne bzw. hinten, sodass sich keine zwei Blöcke mehr
// überlappen - ähnlich wie beim Einfügen von Zeilen in der Tabellenansicht.
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
      const duration = daysBetween(prev.start, prev.end);
      const shiftedEnd = addDaysIso(cur.start, -1);
      const shiftedStart = addDaysIso(shiftedEnd, -duration);
      list[i - 1] = { ...prev, start: shiftedStart, end: shiftedEnd };
    }
  }
  return list;
}

export default function RoughPlan({ teamId, subjectId, subject, blocks }) {
  const [scope, setScope] = useState("year"); // year | h1 | h2
  const [draftBlocks, setDraftBlocks] = useState(blocks);
  const [editingBlock, setEditingBlock] = useState(null);
  const [creatingRange, setCreatingRange] = useState(null);
  const dragState = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    setDraftBlocks(blocks);
  }, [blocks]);

  const range = useMemo(() => {
    const start = subject.schoolYearStart;
    const end = subject.schoolYearEnd;
    const mid = subject.semesterStart;
    if (scope === "h1" && mid) return { start, end: addDaysIso(mid, -1) };
    if (scope === "h2" && mid) return { start: mid, end };
    return { start, end };
  }, [scope, subject]);

  const totalDays = Math.max(1, daysBetween(range.start, range.end));
  const timelineWidth = totalDays * PX_PER_DAY;

  const months = useMemo(() => {
    const result = [];
    let cursor = range.start.slice(0, 8) + "01";
    while (cursor <= range.end) {
      const offset = Math.max(0, daysBetween(range.start, cursor));
      const nextMonth = addDaysIso(cursor.slice(0, 8) + "28", 4).slice(0, 8) + "01";
      const monthEnd = nextMonth < range.end ? nextMonth : range.end;
      const width = daysBetween(cursor > range.start ? cursor : range.start, monthEnd) * PX_PER_DAY;
      result.push({
        key: cursor,
        label: new Date(cursor).toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
        left: offset * PX_PER_DAY,
        width: Math.max(20, width),
      });
      cursor = nextMonth;
    }
    return result;
  }, [range]);

  function xToDate(x) {
    const day = Math.round(x / PX_PER_DAY);
    return addDaysIso(range.start, day);
  }

  function blockStyle(b) {
    const left = Math.max(0, daysBetween(range.start, b.start)) * PX_PER_DAY;
    const width = Math.max(
      PX_PER_DAY * 2,
      daysBetween(b.start, b.end) * PX_PER_DAY
    );
    return { left, width };
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

  function startDrag(e, block, mode) {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      blockId: block.id,
      mode, // "move" | "resize-left" | "resize-right"
      startX: e.clientX,
      origStart: block.start,
      origEnd: block.end,
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  }

  function onDragMove(e) {
    const ds = dragState.current;
    if (!ds) return;
    const deltaDays = Math.round((e.clientX - ds.startX) / PX_PER_DAY);
    let newStart = ds.origStart;
    let newEnd = ds.origEnd;
    if (ds.mode === "move") {
      newStart = addDaysIso(ds.origStart, deltaDays);
      newEnd = addDaysIso(ds.origEnd, deltaDays);
    } else if (ds.mode === "resize-left") {
      newStart = addDaysIso(ds.origStart, deltaDays);
      if (newStart >= newEnd) newStart = addDaysIso(newEnd, -1);
    } else if (ds.mode === "resize-right") {
      newEnd = addDaysIso(ds.origEnd, deltaDays);
      if (newEnd <= newStart) newEnd = addDaysIso(newStart, 1);
    }
    setDraftBlocks((prev) => resolveOverlaps(prev, ds.blockId, newStart, newEnd));
  }

  function onDragEnd() {
    window.removeEventListener("mousemove", onDragMove);
    window.removeEventListener("mouseup", onDragEnd);
    const ds = dragState.current;
    dragState.current = null;
    if (!ds) return;
    setDraftBlocks((prev) => {
      persistChanges(prev);
      return prev;
    });
  }

  // Neuen Block direkt in der Übersicht per Ziehen anlegen.
  const laneMouseDown = useRef(null);
  function handleLaneMouseDown(e) {
    if (e.target.closest(".roughplan-block")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    laneMouseDown.current = { startX: x };
    window.addEventListener("mousemove", handleLaneMouseMove);
    window.addEventListener("mouseup", handleLaneMouseUp);
  }
  function handleLaneMouseMove() {
    // Visuelles Feedback ist optional; wir werten nur beim Loslassen aus.
  }
  function handleLaneMouseUp(e) {
    window.removeEventListener("mousemove", handleLaneMouseMove);
    window.removeEventListener("mouseup", handleLaneMouseUp);
    const down = laneMouseDown.current;
    laneMouseDown.current = null;
    if (!down || !scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left + scrollRef.current.scrollLeft;
    const x1 = Math.min(down.startX, endX);
    const x2 = Math.max(down.startX, endX);
    if (x2 - x1 < PX_PER_DAY) return; // zu kurz gezogen, kein Block
    setCreatingRange({ start: xToDate(x1), end: xToDate(x2) });
  }

  async function handleDeleteBlock(id) {
    if (!confirm("Diesen Block wirklich löschen?")) return;
    await deleteRoughBlock(teamId, subjectId, id);
  }

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
        Ziehe auf der Zeitleiste, um einen neuen Block anzulegen. Bestehende Blöcke lassen
        sich verschieben (Mitte ziehen) oder verlängern/verkürzen (Ränder ziehen).
      </p>

      <div className="roughplan-scroll" ref={scrollRef}>
        <div className="roughplan-timeline" style={{ width: timelineWidth }}>
          <div className="roughplan-months">
            {months.map((m) => (
              <div
                key={m.key}
                className="roughplan-month"
                style={{ left: m.left, width: m.width }}
              >
                {m.label}
              </div>
            ))}
          </div>
          <div className="roughplan-lane" onMouseDown={handleLaneMouseDown}>
            {draftBlocks.map((b) => {
              const style = blockStyle(b);
              if (style.left + style.width < 0 || style.left > timelineWidth) return null;
              return (
                <div
                  key={b.id}
                  className="roughplan-block"
                  style={{ left: style.left, width: style.width }}
                  onMouseDown={(e) => startDrag(e, b, "move")}
                  onDoubleClick={() => setEditingBlock(b)}
                  title={`${b.title}: ${formatShortDate(b.start)} – ${formatShortDate(b.end)}`}
                >
                  <div
                    className="roughplan-handle left"
                    onMouseDown={(e) => startDrag(e, b, "resize-left")}
                  />
                  <span className="roughplan-block-label">{b.title}</span>
                  <div
                    className="roughplan-handle right"
                    onMouseDown={(e) => startDrag(e, b, "resize-right")}
                  />
                </div>
              );
            })}
          </div>
        </div>
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
