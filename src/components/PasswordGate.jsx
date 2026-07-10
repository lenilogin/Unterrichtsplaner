import { useState } from "react";
import { ensureAnonymousAuth } from "../firebase";

const APP_PASSWORD = "Nikolaus612!";
const STORAGE_KEY = "up_unlocked";

export function isUnlocked() {
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

export default function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (value !== APP_PASSWORD) {
      setError("Falsches Passwort.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await ensureAnonymousAuth();
      sessionStorage.setItem(STORAGE_KEY, "1");
      onUnlock();
    } catch (err) {
      setError("Verbindung zu Firebase fehlgeschlagen. Bitte später erneut versuchen.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gate-screen">
      <form className="gate-card" onSubmit={handleSubmit}>
        <h1>Unterrichtsplaner</h1>
        <p>Bitte gib das Team-Passwort ein, um fortzufahren.</p>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Passwort"
        />
        {error && <div className="gate-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? "Prüfe …" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
