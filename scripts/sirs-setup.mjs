#!/usr/bin/env node
// Creates sirs/.venv (Python 3.12) and installs sirs/requirements.txt. Safe to re-run.
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const sirs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "sirs")
const win = process.platform === "win32"
const venv = path.join(sirs, ".venv")
const py = path.join(venv, win ? "Scripts" : "bin", win ? "python.exe" : "python")
const req = path.join(sirs, "requirements.txt")
const ok = (cmd, args) => spawnSync(cmd, args, { shell: win }).status === 0
const run = (cmd, args) => {
  if (spawnSync(cmd, args, { stdio: "inherit", shell: win }).status !== 0) { console.error(`${cmd} failed`); process.exit(1) }
}

if (ok("uv", ["--version"])) {
  if (!existsSync(py)) run("uv", ["venv", "--python", "3.12", venv])
  run("uv", ["pip", "install", "--python", py, "-r", req])
} else {
  if (!existsSync(py)) {
    const candidates = win ? [["py", ["-3.12"]], ["python", []]] : [["python3.12", []], ["python3", []]]
    const found = candidates.find(([c, a]) => ok(c, [...a, "-c", "import sys;sys.exit(sys.version_info[:2]!=(3,12))"]))
    if (!found) { console.error("Python 3.12 (or uv) is required."); process.exit(1) }
    run(found[0], [...found[1], "-m", "venv", venv])
  }
  run(py, ["-m", "pip", "install", "-r", req])
}
console.log("SIRS environment ready.")
