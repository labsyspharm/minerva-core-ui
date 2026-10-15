import { execSync } from "node:child_process";

/** Full HEAD sha. CI sets `VITE_APP_GIT_SHA` from `github.sha`; local builds read git. */
export function gitSha() {
  const fromCi = process.env.VITE_APP_GIT_SHA?.trim();
  if (fromCi) return fromCi;
  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}
