// Dev only: once the server is listening, request every page so it is already compiled when you click.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "development") return
  const { warmRoutes, warmUp } = await import("./lib/dev-warm")
  // register() runs before the port opens; wait a moment, without blocking startup.
  setTimeout(() => void warmUp(`http://localhost:${process.env.PORT ?? 3000}`, warmRoutes()), 3000)
}
