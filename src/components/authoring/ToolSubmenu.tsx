import * as React from "react";
import { createPortal } from "react-dom";
import styles from "./ToolSubmenu.module.css";

export interface ToolSubmenuItem {
  id: string;
  icon: React.ReactNode;
  title: string;
}

export interface ToolSubmenuProps {
  items: ToolSubmenuItem[];
  activeTool: string;
  onToolChange: (toolId: string) => void;
  parentIcon: React.ReactNode;
  parentTitle: string;
  buttonClassName?: string;
  activeClassName?: string;
}

const ToolSubmenu: React.FC<ToolSubmenuProps> = ({
  items,
  activeTool,
  onToolChange,
  parentIcon,
  parentTitle,
  buttonClassName = "",
  activeClassName = "",
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const isActive = items.some((item) => item.id === activeTool);
  const activeItem = items.find((item) => item.id === activeTool);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        toggleRef.current &&
        !toggleRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen && toggleRef.current) {
      const rect = toggleRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 3, left: rect.left });
    }
  }, [isOpen]);

  const handleSelect = (toolId: string) => {
    onToolChange(toolId);
    setIsOpen(false);
  };

  return (
    <div className={styles.container}>
      <button
        ref={toggleRef}
        type="button"
        className={`${styles.toggle} ${buttonClassName} ${isActive ? activeClassName : ""}`}
        title={parentTitle}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {activeItem ? activeItem.icon : parentIcon}
        <span className={styles.chevron} aria-hidden>
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="currentColor"
            aria-hidden
          >
            <title>Submenu</title>
            <path
              d="M1 3L4 6L7 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </span>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.menuItem} ${activeTool === item.id ? styles.menuItemActive : ""}`}
                title={item.title}
                onClick={() => handleSelect(item.id)}
              >
                {item.icon}
                <span className={styles.menuItemLabel}>{item.title}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

export { ToolSubmenu };
