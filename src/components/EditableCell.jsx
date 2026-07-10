import { useEffect, useRef, useState } from "react";

// Mehrzeiliges, automatisch wachsendes Textfeld, das Änderungen
// debounced (500ms) speichert - damit mehrere Kolleginnen gleichzeitig
// arbeiten können, ohne bei jedem Tastendruck einen Schreibzugriff auszulösen.
export default function EditableCell({ value, onSave, placeholder }) {
  const [local, setLocal] = useState(value || "");
  const timer = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setLocal(value || "");
  }, [value]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [local]);

  function handleChange(e) {
    const next = e.target.value;
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(next), 500);
  }

  function handleBlur() {
    if (timer.current) clearTimeout(timer.current);
    onSave(local);
  }

  return (
    <textarea
      ref={textareaRef}
      className="editable-cell"
      value={local}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      rows={1}
    />
  );
}
