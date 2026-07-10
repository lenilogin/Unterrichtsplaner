# Einrichtung des Unterrichtsplaners – Schritt für Schritt

Du hast schon GitHub- und Google-Account, daher startet die Anleitung direkt bei der Firebase- und Repo-Einrichtung. Alles hier läuft über die kostenlose Firebase-Stufe ("Spark") – keine Kreditkarte nötig, da wir bewusst auf Cloud Functions verzichtet haben.

## 1. Firebase-Projekt anlegen

1. Gehe zu https://console.firebase.google.com und klicke auf **"Projekt hinzufügen"**.
2. Name vergeben, z.B. „Unterrichtsplaner". Google Analytics kannst du deaktivieren (wird nicht gebraucht).
3. Projekt erstellen lassen (dauert ca. 30 Sekunden).

## 2. Firestore-Datenbank aktivieren

1. Im Firebase-Projekt links im Menü **Build → Firestore Database** öffnen.
2. **"Datenbank erstellen"** klicken.
3. Standort wählen (z.B. `eur3` für Europa), **Produktivmodus** auswählen (nicht Testmodus – die Sicherheitsregeln liefern wir mit).
4. Nach dem Anlegen: Tab **"Regeln"** öffnen und den Inhalt der Datei `firestore.rules` aus dem Projekt einfügen, dann **"Veröffentlichen"**.

## 3. Anonyme Anmeldung aktivieren

1. Links im Menü **Build → Authentication** öffnen, **"Los geht's"**.
2. Tab **"Sign-in method"** → **"Anonym"** auswählen → aktivieren → speichern.

Das ist die einzige Art von "Login" im Hintergrund. Nutzerinnen sehen davon nichts – sie geben nur das App-Passwort ein.

## 4. Web-App registrieren und Konfiguration holen

1. Auf der Projektübersicht (Zahnrad oben links → **Projekteinstellungen**) unter **"Meine Apps"** auf das **Web-Symbol (`</>`)** klicken.
2. App-Spitzname vergeben (z.B. „Web"), **Firebase Hosting** NICHT als Häkchen aktivieren (machen wir separat über GitHub Actions).
3. Du bekommst ein `firebaseConfig`-Objekt mit `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`. **Diese Werte brauchst du gleich zweimal:** einmal lokal in einer `.env`-Datei, einmal als GitHub-Secrets.

## 5. Projekt zu GitHub hochladen

1. Erstelle auf https://github.com ein neues, privates Repository, z.B. `unterrichtsplaner`.
2. Lade dir den Projektordner herunter (Link kommt am Ende des Chats) und entpacke ihn lokal.
3. Im entpackten Ordner (Terminal öffnen):
   ```
   git init
   git add .
   git commit -m "Erste Version"
   git branch -M main
   git remote add origin https://github.com/DEIN-NUTZERNAME/unterrichtsplaner.git
   git push -u origin main
   ```

## 6. Firebase Service Account für GitHub Actions erzeugen

Damit GitHub Actions bei jedem Push automatisch auf Firebase Hosting veröffentlichen darf:

1. In der Firebase Console: **Projekteinstellungen → Dienstkonten (Service accounts)**.
2. **"Neuen privaten Schlüssel generieren"** klicken → eine JSON-Datei wird heruntergeladen. **Diese Datei nicht öffentlich teilen.**

## 7. GitHub Secrets hinterlegen

Im GitHub-Repository: **Settings → Secrets and variables → Actions → "New repository secret"**. Lege folgende Secrets an:

| Name | Wert |
|---|---|
| `VITE_FIREBASE_API_KEY` | aus Schritt 4 |
| `VITE_FIREBASE_AUTH_DOMAIN` | aus Schritt 4 |
| `VITE_FIREBASE_PROJECT_ID` | aus Schritt 4 |
| `VITE_FIREBASE_STORAGE_BUCKET` | aus Schritt 4 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | aus Schritt 4 |
| `VITE_FIREBASE_APP_ID` | aus Schritt 4 |
| `FIREBASE_SERVICE_ACCOUNT` | kompletter Inhalt der JSON-Datei aus Schritt 6 (Datei öffnen, alles reinkopieren) |

## 8. Erstes Deployment auslösen

Sobald die Secrets gesetzt sind, reicht ein einfacher Push:
```
git commit --allow-empty -m "Deployment auslösen"
git push
```
Unter dem Tab **"Actions"** im GitHub-Repo siehst du den Workflow live laufen (dauert 2–3 Minuten). Ist er grün, ist die App live unter `https://DEIN-PROJEKT-ID.web.app`.

## 9. Lokal testen (optional, aber empfohlen vor dem ersten Push)

```
npm install
cp .env.example .env
```
Trage in `.env` dieselben Firebase-Werte wie in Schritt 4 ein, dann:
```
npm run dev
```
Die App läuft dann unter `http://localhost:5173`. Passwort: `Nikolaus612!`

## 10. Link an die Kolleginnen weitergeben

Einfach die Firebase-Hosting-URL (`https://DEIN-PROJEKT-ID.web.app`) plus Passwort teilen. Jede Kollegin, die das Passwort eingibt, sieht dieselben Teams/Fächer/Planungen und kann sie bearbeiten – Änderungen erscheinen bei allen live.

---

### Wichtig zu wissen
- Das App-Passwort (`Nikolaus612!`) ist im Code hinterlegt (`src/components/PasswordGate.jsx`) – es ist eine reine Zugangsschranke, keine Verschlüsselung. Passt zur Anforderung, dass keine sensiblen Daten gespeichert werden.
- Firestore-Regeln lassen jede anonym angemeldete Person lesen/schreiben. Sobald jemand das Passwort kennt und die Seite lädt, hat er/sie vollen Zugriff.
- Für spätere Code-Änderungen: einfach lokal ändern, `git push` – die Seite aktualisiert sich automatisch über GitHub Actions.
