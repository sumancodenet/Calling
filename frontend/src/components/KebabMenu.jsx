import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

/**
 * Three-dot row menu. Closes on outside click, Escape, or after a selection,
 * and moves focus into the menu when opened so it is keyboard reachable.
 */
export const KebabMenu = ({ items, label = "Row actions", disabled = false }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        document.querySelector(".kebab__trigger")?.focus?.();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector("button")?.focus();

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="kebab" ref={rootRef}>
      <button
        type="button"
        className="kebab__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="more" size={16} />
      </button>

      {open ? (
        <div className="kebab__menu" role="menu" ref={menuRef}>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`kebab__item${item.tone === "danger" ? " kebab__item--danger" : ""}`}
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default KebabMenu;
