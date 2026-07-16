// Zentrale Datenzugriffsschicht für Firestore.
// Struktur:
//   schoolYears/{schoolYearId}                       { name, schoolYearStart, schoolYearEnd,
//                                                       semesterStart, excludeSaturday,
//                                                       excludeSunday, excludedRanges:
//                                                       [{id,start,end,label}] (gilt für alle
//                                                       Teams dieses Schuljahres), createdAt }
//   teams/{teamId}                                   { name, schoolYearId, excludedRanges:
//                                                       [{id,start,end,label}] (nur für dieses
//                                                       Team, z.B. Ausflüge/Klassenfahrten),
//                                                       createdAt }
//   teams/{teamId}/subjects/{subjectId}              { name, color, createdAt }
//   teams/{teamId}/subjects/{subjectId}/entries/{id} { date, stundenplanung, hausaufgabe }
//   teams/{teamId}/subjects/{subjectId}/roughPlan/{id}
//                                                     { title, start, end }
//
// Hinweis: Schuljahresdaten und Ausschluss-Einstellungen lagen früher pro Fach
// (teams/{teamId}/subjects/{subjectId}/settings/config bzw. auf dem Fach selbst).
// Das wurde durch die Schuljahr-Ebene ersetzt. migrateLegacyDataIfNeeded() holt
// bestehende alte Werte einmalig ab und legt daraus ein Schuljahr an, ohne
// vorhandene Fächer/Einträge zu verändern oder zu löschen.

import { db } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { nextPlannableDay, compareIso } from "../utils/dateUtils";

// ---------- Schuljahre ----------

export function subscribeSchoolYears(callback) {
  const q = query(collection(db, "schoolYears"), orderBy("schoolYearStart"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createSchoolYear(data) {
  return addDoc(collection(db, "schoolYears"), {
    name: data.name,
    schoolYearStart: data.schoolYearStart,
    schoolYearEnd: data.schoolYearEnd,
    semesterStart: data.semesterStart,
    excludeSaturday: true,
    excludeSunday: true,
    excludedRanges: [],
    createdAt: serverTimestamp(),
  });
}

export async function updateSchoolYear(schoolYearId, data) {
  return updateDoc(doc(db, "schoolYears", schoolYearId), data);
}

export async function deleteSchoolYear(schoolYearId) {
  return deleteDoc(doc(db, "schoolYears", schoolYearId));
}

// ---------- Teams ----------

export function subscribeTeams(callback) {
  const q = query(collection(db, "teams"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createTeam(name, schoolYearId) {
  return addDoc(collection(db, "teams"), {
    name,
    schoolYearId,
    excludedRanges: [],
    createdAt: serverTimestamp(),
  });
}

export async function renameTeam(teamId, name) {
  return updateDoc(doc(db, "teams", teamId), { name });
}

export async function updateTeam(teamId, data) {
  return updateDoc(doc(db, "teams", teamId), data);
}

export async function deleteTeam(teamId) {
  return deleteDoc(doc(db, "teams", teamId));
}

// ---------- Fächer ----------

export function subscribeSubjects(teamId, callback) {
  const q = query(collection(db, "teams", teamId, "subjects"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createSubject(teamId, data) {
  const ref = await addDoc(collection(db, "teams", teamId, "subjects"), {
    name: data.name,
    color: data.color,
    createdAt: serverTimestamp(),
  });
  // Erste Zeile mit dem Startdatum anlegen
  await addDoc(collection(db, "teams", teamId, "subjects", ref.id, "entries"), {
    date: data.startDate,
    stundenplanung: "",
    hausaufgabe: "",
  });
  return ref;
}

export async function updateSubject(teamId, subjectId, data) {
  return updateDoc(doc(db, "teams", teamId, "subjects", subjectId), data);
}

export async function deleteSubject(teamId, subjectId) {
  return deleteDoc(doc(db, "teams", teamId, "subjects", subjectId));
}

// ---------- Planungszeilen (entries) ----------

export function subscribeEntries(teamId, subjectId, callback) {
  const q = query(
    collection(db, "teams", teamId, "subjects", subjectId, "entries"),
    orderBy("date")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updateEntry(teamId, subjectId, entryId, data) {
  return updateDoc(
    doc(db, "teams", teamId, "subjects", subjectId, "entries", entryId),
    data
  );
}

export async function deleteEntry(teamId, subjectId, entryId) {
  return deleteDoc(doc(db, "teams", teamId, "subjects", subjectId, "entries", entryId));
}

// Neue Zeile am Ende anhängen (nächster planbarer Tag nach der letzten Zeile).
export async function appendEntry(teamId, subjectId, entries, settings) {
  const sorted = [...entries].sort((a, b) => compareIso(a.date, b.date));
  const last = sorted[sorted.length - 1];
  const nextDate = last ? nextPlannableDay(last.date, settings) : null;
  if (!nextDate) throw new Error("Kein Startdatum vorhanden.");
  return addDoc(collection(db, "teams", teamId, "subjects", subjectId, "entries"), {
    date: nextDate,
    stundenplanung: "",
    hausaufgabe: "",
  });
}

// Neue Zeile zwischen zwei bestehenden Zeilen einfügen. Alle nachfolgenden
// Zeilen rücken kaskadierend um jeweils einen planbaren Tag weiter, bis eine
// Zeile ihr bisheriges Datum behalten kann (dann ist keine weitere
// Verschiebung nötig).
export async function insertEntryAfter(teamId, subjectId, entries, settings, afterEntryId) {
  const sorted = [...entries].sort((a, b) => compareIso(a.date, b.date));
  const idx = sorted.findIndex((e) => e.id === afterEntryId);
  if (idx === -1) throw new Error("Zeile nicht gefunden.");
  const prevEntry = sorted[idx];
  const newDate = nextPlannableDay(prevEntry.date, settings);

  const batch = writeBatch(db);
  const base = collection(db, "teams", teamId, "subjects", subjectId, "entries");

  const newEntryRef = doc(base);
  batch.set(newEntryRef, { date: newDate, stundenplanung: "", hausaufgabe: "" });

  // Kaskadierend nachfolgende Zeilen verschieben
  let cursor = newDate;
  for (let i = idx + 1; i < sorted.length; i++) {
    const entry = sorted[i];
    const shifted = nextPlannableDay(cursor, settings);
    if (shifted === entry.date) break; // ab hier passt alles wieder
    batch.update(doc(base, entry.id), { date: shifted });
    cursor = shifted;
  }

  await batch.commit();
  return newEntryRef.id;
}

// ---------- Grobplanung (Blöcke) ----------

export function subscribeRoughPlan(teamId, subjectId, callback) {
  const q = query(collection(db, "teams", teamId, "subjects", subjectId, "roughPlan"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createRoughBlock(teamId, subjectId, block) {
  return addDoc(collection(db, "teams", teamId, "subjects", subjectId, "roughPlan"), block);
}

export async function updateRoughBlock(teamId, subjectId, blockId, data) {
  return updateDoc(
    doc(db, "teams", teamId, "subjects", subjectId, "roughPlan", blockId),
    data
  );
}

export async function deleteRoughBlock(teamId, subjectId, blockId) {
  return deleteDoc(doc(db, "teams", teamId, "subjects", subjectId, "roughPlan", blockId));
}

// ---------- Migration: alte Fach-Einstellungen -> gemeinsames Schuljahr ----------

// Wird einmalig aufgerufen, wenn bereits Teams existieren, aber noch kein
// Schuljahr angelegt wurde (Zustand vor dieser Funktion). Sucht in den alten
// Fach-Dokumenten (schoolYearStart/End/semesterStart) und den alten
// Einstellungs-Unterdokumenten nach brauchbaren Werten, legt daraus EIN
// gemeinsames Schuljahr an und ordnet alle bestehenden Teams diesem
// Schuljahr zu. Bestehende Fächer, Einträge und Grobplanungs-Blöcke bleiben
// dabei komplett unangetastet.
export async function migrateLegacyDataIfNeeded(teams) {
  let schoolYearStart = null;
  let schoolYearEnd = null;
  let semesterStart = null;
  let excludeSaturday = true;
  let excludeSunday = true;
  const excludedRangesMap = new Map();

  for (const team of teams) {
    const subjectsSnap = await getDocs(collection(db, "teams", team.id, "subjects"));
    for (const subjectDoc of subjectsSnap.docs) {
      const subject = subjectDoc.data();
      if (!schoolYearStart && subject.schoolYearStart) schoolYearStart = subject.schoolYearStart;
      if (!schoolYearEnd && subject.schoolYearEnd) schoolYearEnd = subject.schoolYearEnd;
      if (!semesterStart && subject.semesterStart) semesterStart = subject.semesterStart;

      const settingsRef = doc(
        db,
        "teams",
        team.id,
        "subjects",
        subjectDoc.id,
        "settings",
        "config"
      );
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        const s = settingsSnap.data();
        if (s.excludeSaturday === false) excludeSaturday = false;
        if (s.excludeSunday === false) excludeSunday = false;
        for (const r of s.excludedRanges || []) {
          const key = `${r.start}_${r.end}_${r.label}`;
          if (!excludedRangesMap.has(key)) {
            excludedRangesMap.set(key, { ...r, id: r.id || crypto.randomUUID() });
          }
        }
      }
    }
  }

  // Sinnvolle Rückfallwerte, falls gar keine alten Daten gefunden wurden
  // (z.B. weil noch gar kein Fach angelegt war).
  const now = new Date();
  const fallbackStart = `${now.getFullYear()}-08-01`;
  const fallbackEnd = `${now.getFullYear() + 1}-07-31`;
  const fallbackSemester = `${now.getFullYear() + 1}-02-01`;

  const schoolYearRef = await addDoc(collection(db, "schoolYears"), {
    name: "Migriertes Schuljahr",
    schoolYearStart: schoolYearStart || fallbackStart,
    schoolYearEnd: schoolYearEnd || fallbackEnd,
    semesterStart: semesterStart || fallbackSemester,
    excludeSaturday,
    excludeSunday,
    excludedRanges: Array.from(excludedRangesMap.values()),
    createdAt: serverTimestamp(),
  });

  const batch = writeBatch(db);
  for (const team of teams) {
    if (!team.schoolYearId) {
      batch.update(doc(db, "teams", team.id), { schoolYearId: schoolYearRef.id });
    }
  }
  await batch.commit();

  return schoolYearRef.id;
}
