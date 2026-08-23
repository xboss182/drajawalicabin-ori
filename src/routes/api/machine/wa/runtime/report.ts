// Machine API route for the VPS WA booking bridge (MNC-963).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/machine/wa/runtime/report")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/wa/machine-handlers.server")).handleRuntimeReport(request),
    },
  },
});
