import * as React from "react";
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
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isActive = items.some((item) => item.id === activeTool);
  const activeItem = items.find((item) => item.id === activeTool);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (toolId: string) => {
    onToolChange(toolId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        type="button"
        className={`${styles.toggle} ${buttonClassName} ${isActive ? activeClassName : ""}`}
        title={parentTitle}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {activeItem ? activeItem.icon : parentIcon}
        <span className={styles.chevron} aria-hidden>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
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
      {isOpen && (
        <div className={styles.menu}>
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
        </div>
      )}
    </div>
  );
};

export { ToolSubmenu };
