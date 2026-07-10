# Unterrichtsplaner

Gemeinsame Unterrichtsplanung fürs Kollegium – Teams, Fächer, Tabellenplanung, mit Firebase im Hintergrund synchronisiert.

**Aktueller Stand: Phase 1 (Kernfunktion)**
- Passwort-Gate für die gesamte App
- Teams anlegen, Fächer je Team mit Farbe anlegen
- Tabellarische Tagesplanung (Datum / Stundenplanung / Hausaufgabe)
- Zeilen anhängen und zwischen bestehenden Zeilen einfügen (Folgedaten verschieben sich automatisch)
- Einstellungen: Wochenenden ausplanen, Ferien/Feiertage/Zeiträume ausplanen (grau markiert), Schuljahresdaten ändern
- Auto-Scroll zum aktuellen Datum + „Heute"-Button
- Echtzeit-Synchronisierung über Firestore

**Kommt noch (Phase 2–4):** Monatsansicht, Grobplanung mit verschiebbaren Themenblöcken, PDF-Export.

## Lokale Entwicklung

```
npm install
cp .env.example .env   # mit deinen Firebase-Werten befüllen
npm run dev
```

## Deployment

Push auf `main` löst automatisch ein Deployment auf Firebase Hosting aus (siehe `.github/workflows/deploy.yml`). Die vollständige Einrichtung ist in `ANLEITUNG.md` beschrieben.
