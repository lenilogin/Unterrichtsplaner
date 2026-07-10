import { useState } from "react";
import { createTeam, deleteTeam, deleteSubject } from "../services/firestore";

const DEFAULT_COLORS = [
  "#e53935", "#fb8c00", "#fdd835", "#43a047", "#00897b",
  "#1e88e5", "#5e35b1", "#8e24aa", "#d81b60", "#6d4c41",
];

export default function Sidebar({
  teams,
  subjects,
  currentTeamId,
  currentSubjectId,
  onSelectTeam,
  onSelectSubject,
  onNewSubject,
}) {
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  async function handleCreateTeam(e) {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const ref = await createTeam(newTeamName.trim());
    setNewTeamName("");
    setCreatingTeam(false);
    onSelectTeam(ref.id);
  }

  async function handleDeleteTeam(teamId) {
    if (!confirm("Team wirklich löschen? Alle Fächer und Planungen darin gehen verloren.")) return;
    await deleteTeam(teamId);
  }

  async function handleDeleteSubject(subjectId) {
    if (!confirm("Fach wirklich löschen? Die gesamte Planung geht verloren.")) return;
    await deleteSubject(currentTeamId, subjectId);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-heading">Teams</div>
        <ul className="team-list">
          {teams.map((team) => (
            <li key={team.id} className={team.id === currentTeamId ? "active" : ""}>
              <button className="team-btn" onClick={() => onSelectTeam(team.id)}>
                {team.name}
              </button>
              <button
                className="icon-btn subtle"
                title="Team löschen"
                onClick={() => handleDeleteTeam(team.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {creatingTeam ? (
          <form onSubmit={handleCreateTeam} className="inline-form">
            <input
              autoFocus
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team-Name"
            />
            <button type="submit">✓</button>
            <button type="button" onClick={() => setCreatingTeam(false)}>×</button>
          </form>
        ) : (
          <button className="link-btn" onClick={() => setCreatingTeam(true)}>
            + Neues Team
          </button>
        )}
      </div>

      {currentTeamId && (
        <div className="sidebar-section">
          <div className="sidebar-heading">Fächer</div>
          <ul className="subject-list">
            {subjects.map((subject) => (
              <li
                key={subject.id}
                className={subject.id === currentSubjectId ? "active" : ""}
              >
                <button
                  className="subject-btn"
                  onClick={() => onSelectSubject(subject.id)}
                >
                  <span
                    className="color-dot"
                    style={{ background: subject.color }}
                  />
                  {subject.name}
                </button>
                <button
                  className="icon-btn subtle"
                  title="Fach löschen"
                  onClick={() => handleDeleteSubject(subject.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button className="link-btn" onClick={onNewSubject}>
            + Neues Fach
          </button>
        </div>
      )}
    </aside>
  );
}

export { DEFAULT_COLORS };
