// Zentrale Datenzugriffsschicht für Firestore.
// Struktur:
//   teams/{teamId}                                  { name, createdAt }
//   teams/{teamId}/subjects/{subjectId}              { name, color, schoolYearStart,
//                                                       schoolYearEnd, semesterStart, createdAt }
//   teams/{teamId}/subjects/{subjectId}/entries/{id} { date, stundenplanung, hausaufgabe }
//   teams/{teamId}/subjects/{subjectId}/settings/config
//                                                     { excludeSaturday, excludeSunday,
//                                                       excludedRanges: [{id,start,end,label}] }
//   teams/{teamId}/subjects/{subjectId}/roughPlan/{id}
//                                                     { title, start, end, scope: "year"|"semester" }

import { db } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { nextPlannableDay, compareIso } from "../utils/dateUtils";

// ---------- Teams ----------

export function subscribeTeams(callback) {
  const q = query(collection(db, "teams"), orderBy("name"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createTeam(name) {
  return addDoc(collection(db, "teams"), { name, createdAt: serverTimestamp() });
}

export async function renameTeam(teamId, name) {
  return updateDoc(doc(db, "teams", teamId), { name });
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
    schoolYearStart: data.schoolYearStart,
    schoolYearEnd: data.schoolYearEnd,
    semesterStart: data.semesterStart,
    createdAt: serverTimestamp(),
  });
  // Standardeinstellungen anlegen
  await setDoc(doc(db, "teams", teamId, "subjects", ref.id, "settings", "config"), {
    excludeSaturday: true,
    excludeSunday: true,
    excludedRanges: [],
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

// ---------- Einstellungen ----------

export function subscribeSettings(teamId, subjectId, callback) {
  const ref = doc(db, "teams", teamId, "subjects", subjectId, "settings", "config");
  return onSnapshot(ref, (snap) => {
    callback(
      snap.exists()
        ? snap.data()
        : { excludeSaturday: true, excludeSunday: true, excludedRanges: [] }
    );
  });
}

export async function updateSettings(teamId, subjectId, data) {
  const ref = doc(db, "teams", teamId, "subjects", subjectId, "settings", "config");
  return setDoc(ref, data, { merge: true });
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
