import MinervaLogo from "@/assets/minerva-logo.svg?react";
import styles from "./MadeWithMinerva.module.css";

/** Bottom-left of a story's viewer; opens minerva.im in a new tab. */
export function MadeWithMinerva() {
  return (
    <a
      className={styles.badge}
      href="https://minerva.im"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Made with Minerva"
    >
      <span>Made with</span>
      <MinervaLogo className={styles.logo} aria-hidden />
    </a>
  );
}
