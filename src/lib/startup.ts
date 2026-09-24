// Collects non-fatal startup failures so a crash during early module load
// becomes a visible on-screen message instead of a silent close. Read by the
// root layout (see app/_layout.tsx).
export type StartupError = { where: string; message: string };

export const startupErrors: StartupError[] = [];

export function recordStartupError(where: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  startupErrors.push({ where, message });
  console.error(`[startup] ${where}:`, error);
}
