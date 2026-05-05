/**
 * Stops whichever process is listening on PORT (default 3000) so `next dev` can start cleanly.
 */
import { execSync } from "node:child_process";
import { platform } from "node:os";

const PORT = process.env.PORT || "3000";

function freeWindows() {
  execSync(
    `powershell -NoProfile -Command ` +
      `"Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ` +
      `ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
    { stdio: "pipe" },
  );
}

function freeUnix() {
  try {
    const out = execSync(`lsof -t -iTCP:${PORT} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!out) return;
    for (const pid of out.split(/\n/)) {
      if (!/^\d+$/.test(pid)) continue;
      execSync(`kill -9 ${pid}`, { stdio: "pipe" });
    }
  } catch {
    /* nothing listening */
  }
}

try {
  if (platform() === "win32") freeWindows();
  else freeUnix();
} catch {
  /* ignore */
}
