// Plotting runs the SIRS plotter vendored in sirs/ (set SIRS_DIR to point elsewhere).
import path from "node:path"

export interface PlotCommand { cmd: string; args: string[]; cwd: string; env: NodeJS.Dict<string> }

/** Command that charts terms with the vendored `python -m sirs.plot_term`. */
export function plotCommand(terms: string[], env: NodeJS.Dict<string> = process.env, repoRoot = process.cwd()): PlotCommand {
  if (!terms.length) throw new Error('Usage: pnpm aura:plot <term> ["multi word term" ...] [--out chart.png] | pnpm aura:plot --list')
  const sirsDir = env.SIRS_DIR ?? path.resolve(repoRoot, "sirs")
  return {
    cmd: path.join(sirsDir, ".venv/bin/python"),
    args: ["-m", "sirs.plot_term", ...terms],
    cwd: sirsDir,
    env: { ...env, PYTHONPATH: path.join(sirsDir, "src") },
  }
}
