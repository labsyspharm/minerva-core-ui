import styles from "./BuildStamp.module.css";

function utcShort(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().replace("T", " ").slice(0, 16);
}

/** Unobtrusive UTC build time so deployed previews are easy to tell apart from `main`/production. */
const BuildStamp = () => {
  const label = utcShort(
    typeof __BUILD_TIME_ISO__ === "string" ? __BUILD_TIME_ISO__ : "",
  );
  if (!label) return null;
  return (
    <div className={styles.stamp} aria-hidden title={__BUILD_TIME_ISO__}>
      Updated {label} UTC
    </div>
  );
};

export { BuildStamp };
