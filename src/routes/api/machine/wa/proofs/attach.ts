// Machine API route for the VPS WA booking bridge (MNC-961).
// Thin wrapper: authentication + logic live in @/lib/wa/machine-handlers.server.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/machine/wa/proofs/attach")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        (await import("@/lib/wa/machine-handlers.server")).handleProofsAttach(request),
    },
  },
});
