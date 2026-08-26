import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import test from "node:test";

type EmailModule = typeof import("../src/lib/email/send.server");

async function loadEmailModule(
  sendTemplateEmail: (
    templateName: string,
    recipient: string,
    options: unknown,
  ) => Promise<unknown>,
) {
  const bundle = await build({
    bundle: true,
    format: "cjs",
    platform: "node",
    plugins: [
      {
        name: "mock-template-email",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\/email-templates\/send-email$/ }, () => ({
            path: "mock-template-email",
            namespace: "test",
          }));
          build.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents: `export const sendTemplateEmail = globalThis.__sendTemplateEmail;`,
            loader: "js",
          }));
        },
      },
    ],
    stdin: {
      contents: 'export * from "./src/lib/email/send.server.ts";',
      resolveDir: process.cwd(),
      sourcefile: "email-test-entry.ts",
      loader: "ts",
    },
    write: false,
  });

  const module = { exports: {} };
  Object.assign(globalThis, { __sendTemplateEmail: sendTemplateEmail });
  new Function("module", "exports", bundle.outputFiles[0].text)(module, module.exports);
  return module.exports as EmailModule;
}

async function loadEmailWebhookModule() {
  Object.assign(globalThis, {
    __createEmailWebhookHandler: () => () => new Response(),
    __createSupabaseClient: () => ({}),
    __createFileRoute: () => (definition: unknown) => definition,
  });
  const bundle = await build({
    bundle: true,
    define: { "import.meta.env.VITE_SUPABASE_URL": '"https://example.test"' },
    format: "cjs",
    platform: "node",
    plugins: [
      {
        name: "mock-webhook-dependencies",
        setup(build) {
          const mocks = {
            "@lovable.dev/email-js":
              "export const createEmailWebhookHandler = globalThis.__createEmailWebhookHandler;",
            "@supabase/supabase-js":
              "export const createClient = globalThis.__createSupabaseClient;",
            "@tanstack/react-router":
              "export const createFileRoute = globalThis.__createFileRoute;",
          };
          build.onResolve(
            { filter: /^@(lovable\.dev\/email-js|supabase\/supabase-js|tanstack\/react-router)$/ },
            (args) => ({
              path: args.path,
              namespace: "test",
            }),
          );
          build.onLoad({ filter: /.*/, namespace: "test" }, (args) => ({
            contents: mocks[args.path as keyof typeof mocks],
            loader: "js",
          }));
        },
      },
    ],
    stdin: {
      contents: 'export { recordOutcome } from "./src/routes/lovable/email/events.ts";',
      resolveDir: process.cwd(),
      sourcefile: "email-webhook-test-entry.ts",
      loader: "ts",
    },
    write: false,
  });

  const module = { exports: {} };
  new Function("module", "exports", bundle.outputFiles[0].text)(module, module.exports);
  return module.exports as {
    recordOutcome: (
      supabase: unknown,
      reason: "bounce" | "complaint" | "unsubscribe",
      recipient: string,
      messageId: string | null,
      eventId: string,
    ) => Promise<void>;
  };
}

function recipientsClient(rows: Array<{ email: string }>) {
  const query = {
    eq: () => query,
    select: () => query,
    then: (resolve: (value: { data: typeof rows; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };
  return { from: () => query } as never;
}

test("active opted-in recipients are normalized and deduplicated", async () => {
  const { getAdminRecipients } = await loadEmailModule(async () => ({ sent: true }));
  assert.deepEqual(
    await getAdminRecipients(
      recipientsClient([{ email: "Admin@Example.com" }, { email: "admin@example.com" }]),
      "notify_payment_proof",
    ),
    ["admin@example.com"],
  );
});

test("managed provider outcomes preserve idempotency and remain best effort", async () => {
  const calls: Array<{ templateName: string; recipient: string; options: unknown }> = [];
  const { sendTransactionalEmail } = await loadEmailModule(
    async (templateName, recipient, options) => {
      calls.push({ templateName, recipient, options });
      return { sent: false, reason: "recipient_suppressed" };
    },
  );
  const rows: unknown[] = [];
  const admin = {
    from: () => ({ insert: async (row: unknown) => (rows.push(row), { error: null }) }),
  } as never;

  await sendTransactionalEmail(admin, {
    templateName: "admin-booking-alert",
    recipientEmail: "ADMIN@EXAMPLE.COM",
    idempotencyKey: "wa-proof-group-admin@example.com",
    templateData: { bookingId: "booking-1" },
  });

  assert.deepEqual(calls, [
    {
      templateName: "admin-booking-alert",
      recipient: "admin@example.com",
      options: {
        idempotencyKey: "wa-proof-group-admin@example.com",
        templateData: { bookingId: "booking-1" },
      },
    },
  ]);
  assert.deepEqual(rows, [
    {
      template_name: "admin-booking-alert",
      recipient_email: "admin@example.com",
      status: "suppressed",
    },
  ]);
});

test("managed unsubscribe outcomes normalize recipients and retain audit state", async () => {
  const { recordOutcome } = await loadEmailWebhookModule();
  const calls: Array<{ table: string; method: string; value: unknown; options?: unknown }> = [];
  const supabase = {
    from(table: string) {
      return {
        upsert: async (value: unknown, options: unknown) => {
          calls.push({ table, method: "upsert", value, options });
          return { error: null };
        },
        insert: async (value: unknown) => {
          calls.push({ table, method: "insert", value });
          return { error: null };
        },
      };
    },
  };

  await recordOutcome(supabase, "unsubscribe", "Guest@Example.COM", "message-1", "event-1");

  assert.deepEqual(calls, [
    {
      table: "suppressed_emails",
      method: "upsert",
      value: { email: "guest@example.com", reason: "unsubscribe", metadata: null },
      options: { onConflict: "email" },
    },
    {
      table: "email_send_log",
      method: "insert",
      value: {
        message_id: "message-1",
        template_name: "system",
        recipient_email: "guest@example.com",
        status: "suppressed",
        error_message: "Recipient unsubscribed",
        metadata: null,
      },
    },
  ]);
});

test("WhatsApp proof review and handoff retain stable notification contracts", () => {
  const source = readFileSync(
    new URL("../src/lib/wa/machine-handlers.server.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /getAdminRecipients\(admin, "notify_payment_proof"\)/);
  assert.match(source, /idempotencyKey: `wa-proof-\$\{groupId\}-\$\{adminEmail\}`/);
  assert.match(source, /getAdminRecipients\(admin, "notify_new_booking"\)/);
  assert.match(source, /idempotencyKey: `wa-handoff-\$\{d\.chat_id\}-\$\{adminEmail\}`/);
});

test("managed-email migration is forward-only and provisions the provider audit state", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260825220000_restore_managed_email_state.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.email_send_log/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.suppressed_emails/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.email_unsubscribe_tokens/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i);
});
