import styled from "styled-components";

const Stamp = styled.div`
  position: fixed;
  right: max(10px, env(safe-area-inset-right));
  bottom: max(8px, env(safe-area-inset-bottom));
  z-index: 99999;
  pointer-events: none;
  font-size: 10px;
  line-height: 1.25;
  font-weight: 400;
  letter-spacing: 0.015em;
  opacity: 0.28;
  color: rgba(238, 238, 238, 0.85);
`;

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
    <Stamp aria-hidden title={__BUILD_TIME_ISO__}>
      Updated {label} UTC
    </Stamp>
  );
};

export { BuildStamp };
