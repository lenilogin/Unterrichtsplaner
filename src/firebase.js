// Firebase-Initialisierung.
// Die Konfigurationswerte kommen aus Umgebungsvariablen (siehe .env.example).
// Lokal: .env-Datei anlegen. In GitHub Actions: als Repository-Secrets hinterlegt.

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Alle Nutzerinnen werden anonym bei Firebase angemeldet (kein Account nötig).
// Der Zugriff auf die Daten ist über Firestore-Regeln an "eingeloggt = anonym
// authentifiziert" geknüpft. Das eigentliche Passwort-Gate (siehe
// PasswordGate.jsx) ist eine reine Zugangsschranke für die Web-Oberfläche,
// keine echte Datenverschlüsselung - das entspricht der Anforderung
// ("keine sensiblen Daten, keine starke Passwortsicherung nötig").
export function ensureAnonymousAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        } else {
          signInAnonymously(auth).catch(reject);
        }
      },
      reject
    );
  });
}
