import { formatGermanDate } from "../utils/dateUtils";

// Wird nur für den Druck (window.print) gerendert - auf dem Bildschirm per
// CSS ausgeblendet (siehe .print-view in App.css). Enthält eine einfache,
// gut lesbare Tabellendarstellung, unabhängig von der aktuell aktiven
// Bildschirmansicht.
export default function PrintView({ spec }) {
  if (!spec) return null;

  return (
    <div className="print-view">
      <h1>{spec.heading}</h1>
      <h2>{spec.subheading}</h2>

      {spec.type === "plan" && (
        <table className="print-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Stundenplanung</th>
              <th>Hausaufgabe</th>
            </tr>
          </thead>
          <tbody>
            {spec.rows.length === 0 && (
              <tr>
                <td colSpan={3}>Keine Einträge in diesem Zeitraum.</td>
              </tr>
            )}
            {spec.rows.map((row) =>
              row.isGap ? (
                <tr key={row.key} className="print-gap-row">
                  <td colSpan={3}>{row.label}</td>
                </tr>
              ) : (
                <tr key={row.key}>
                  <td>{formatGermanDate(row.date)}</td>
                  <td className="print-pre">{row.stundenplanung || ""}</td>
                  <td className="print-pre">{row.hausaufgabe || ""}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}

      {spec.type === "rough" && (
        <table className="print-table">
          <thead>
            <tr>
              <th>Thema</th>
              <th>Start</th>
              <th>Ende</th>
              <th>Tage</th>
            </tr>
          </thead>
          <tbody>
            {spec.rows.length === 0 && (
              <tr>
                <td colSpan={4}>Keine Blöcke in diesem Zeitraum.</td>
              </tr>
            )}
            {spec.rows.map((row) => (
              <tr key={row.key}>
                <td>{row.title}</td>
                <td>{row.start}</td>
                <td>{row.end}</td>
                <td>{row.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
