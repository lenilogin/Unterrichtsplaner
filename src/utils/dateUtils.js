// Alle Datumsfunktionen arbeiten mit ISO-Strings "YYYY-MM-DD" als
// Speicherformat (sortierbar, zeitzonensicher) und JS-Date-Objekten
// (auf Mitternacht lokale Zeit) für Berechnungen.

const WOCHENTAGE = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

export function isoToDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date, n) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function todayIso() {
  return dateToIso(new Date());
}

// Format lt. Vorgabe: "[Wochentag], den [TT.MM.JJ]"
export function formatGermanDate(iso) {
  const date = isoToDate(iso);
  const wochentag = WOCHENTAGE[date.getDay()];
  const tt = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const jj = String(date.getFullYear()).slice(-2);
  return `${wochentag}, den ${tt}.${mm}.${jj}`;
}

export function formatShortDate(iso) {
  const date = isoToDate(iso);
  const tt = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const jjjj = date.getFullYear();
  return `${tt}.${mm}.${jjjj}`;
}

// Prüft, ob ein Datum (iso) innerhalb eines ausgeplanten Zeitraums liegt.
export function isInExcludedRange(iso, excludedRanges) {
  return (excludedRanges || []).find((r) => iso >= r.start && iso <= r.end);
}

// Ein Tag ist "planbar", wenn er nicht als Wochenendtag ausgeschlossen ist
// und nicht in einem ausgeplanten Zeitraum (Ferien, Feiertage, Ausflüge) liegt.
export function isPlannableDay(iso, settings) {
  const date = isoToDate(iso);
  const day = date.getDay(); // 0 = Sonntag, 6 = Samstag
  if (settings?.excludeSaturday && day === 6) return false;
  if (settings?.excludeSunday && day === 0) return false;
  if (isInExcludedRange(iso, settings?.excludedRanges)) return false;
  return true;
}

export function nextPlannableDay(fromIso, settings) {
  let date = addDays(isoToDate(fromIso), 1);
  let iso = dateToIso(date);
  let guard = 0;
  while (!isPlannableDay(iso, settings) && guard < 3650) {
    date = addDays(date, 1);
    iso = dateToIso(date);
    guard += 1;
  }
  return iso;
}

// Liefert alle ausgeplanten Zeiträume, die (teilweise) zwischen zwei
// aufeinanderfolgenden Unterrichtstagen liegen - für die grau hinterlegte
// Anzeige in der Tabelle.
export function excludedRangesBetween(prevIso, nextIso, excludedRanges) {
  if (!excludedRanges || !prevIso) return [];
  return excludedRanges.filter((r) => r.end > prevIso && r.start < nextIso);
}

export function compareIso(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Woche für den Wochen-Druckfilter: Dienstag bis Montag (siehe Anforderung),
// da die Planung montags stattfindet und daher eine "Unterrichtswoche"
// dienstags beginnt.
export function weekRangeContaining(iso) {
  const date = isoToDate(iso);
  const day = date.getDay(); // 0 So .. 6 Sa
  // Abstand zum vorherigen Dienstag (2 = Dienstag)
  const diffToTuesday = (day - 2 + 7) % 7;
  const start = addDays(date, -diffToTuesday);
  const end = addDays(start, 6);
  return { start: dateToIso(start), end: dateToIso(end) };
}

export function isSameOrAfter(a, b) {
  return a >= b;
}

export function daysBetween(aIso, bIso) {
  return Math.round((isoToDate(bIso) - isoToDate(aIso)) / 86400000);
}

export function addDaysIso(iso, n) {
  return dateToIso(addDays(isoToDate(iso), n));
}

// ---------- Monatsansicht ----------

const MONATSNAMEN = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function monthLabel(year, monthIndex) {
  return `${MONATSNAMEN[monthIndex]} ${year}`;
}

export function addMonths(year, monthIndex, delta) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

// Liefert eine 6x7-Matrix aus ISO-Datumsstrings für die Monatsansicht,
// wochentagsweise beginnend mit Montag. Tage außerhalb des Monats
// (Auffüllung am Anfang/Ende) sind trotzdem enthalten, damit die Wochen
// vollständig sind - Aufrufer erkennen sie über einen Vergleich des Monats.
export function getMonthMatrix(year, monthIndex) {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Montag
  const start = addDays(firstOfMonth, -firstWeekday);

  const weeks = [];
  let cursor = start;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(dateToIso(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}
