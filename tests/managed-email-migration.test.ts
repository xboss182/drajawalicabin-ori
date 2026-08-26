import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260825220000_restore_managed_email_state.sql", import.meta.url),
  "utf8",
);
const container = `managed-email-migration-${process.pid}`;

function docker(args: string[], input?: string): string {
  return execFileSync("docker", args, { encoding: "utf8", input });
}

function psql(database: string, sql: string): string {
  return docker([
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    database,
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]).trim();
}

function applyMigration(database: string) {
  docker(
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"],
    migration,
  );
}

function bootstrap(database: string) {
  psql(
    database,
    "CREATE EXTENSION pgcrypto; CREATE SCHEMA auth; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT current_user::text';",
  );
}

function startPostgres() {
  docker([
    "run",
    "-d",
    "--rm",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=test",
    "postgres:16-alpine",
  ]);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      docker(["exec", container, "pg_isready", "-U", "postgres"]);
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  throw new Error("Postgres container did not become ready");
}

function stopPostgres() {
  try {
    docker(["rm", "-f", container]);
  } catch {
    // container cleanup is best effort
  }
}

test("managed-email migration bootstraps clean and upgrades existing state", () => {
  try {
    docker(["info"]);
  } catch {
    test.skip("Docker is unavailable");
    return;
  }

  try {
    startPostgres();
    psql("postgres", "CREATE ROLE service_role NOLOGIN BYPASSRLS");
    psql("postgres", "CREATE DATABASE email_clean");
    psql("postgres", "CREATE DATABASE email_upgrade");

    bootstrap("email_clean");
    applyMigration("email_clean");
    assert.equal(
      psql(
        "email_clean",
        "SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('email_send_log', 'suppressed_emails', 'email_unsubscribe_tokens')",
      ),
      "email_send_log,email_unsubscribe_tokens,suppressed_emails",
    );
    assert.equal(
      psql(
        "email_clean",
        "SET ROLE service_role; INSERT INTO public.suppressed_emails (email, reason) VALUES ('guest@example.test', 'unsubscribe'); SELECT email FROM public.suppressed_emails;",
      )
        .split("\n")
        .at(-1),
      "guest@example.test",
    );

    bootstrap("email_upgrade");
    psql(
      "email_upgrade",
      "CREATE TABLE public.email_send_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_name text NOT NULL, recipient_email text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); CREATE TABLE public.suppressed_emails (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); CREATE TABLE public.email_unsubscribe_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token text NOT NULL UNIQUE, email text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), used_at timestamptz); INSERT INTO public.email_send_log (template_name, recipient_email, status) VALUES ('legacy', 'guest@example.test', 'sent');",
    );
    applyMigration("email_upgrade");
    applyMigration("email_upgrade");
    assert.equal(
      psql(
        "email_upgrade",
        "SELECT count(*) FROM public.email_send_log WHERE template_name = 'legacy'",
      ),
      "1",
    );
    assert.equal(
      psql(
        "email_upgrade",
        "SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_send_log' AND column_name IN ('message_id', 'metadata', 'error_message')",
      ),
      "error_message,message_id,metadata",
    );
  } finally {
    stopPostgres();
  }
});
