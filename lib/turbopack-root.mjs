import { dirname, relative, isAbsolute } from "node:path"

/**
 * Turbopack rejects a node_modules symlink that points outside its root.
 * Returns the project dir normally, or the closest parent holding both when node_modules lives elsewhere.
 */
export function turbopackRoot(projectDir, realNodeModules) {
  let root = projectDir
  const outside = (dir) => relative(dir, realNodeModules).startsWith("..") || isAbsolute(relative(dir, realNodeModules))
  while (outside(root)) root = dirname(root)
  return root
}
