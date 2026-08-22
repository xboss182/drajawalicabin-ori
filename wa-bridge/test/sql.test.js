// SQL acceptance checks against a scratch Postgres (docker). The real
// 20260822_wa_booking_bridge.sql migration is applied verbatim on a trimmed
// slab of the production schema, then the race/hold/dedupe invariants are
// asserted. Skipped automatically when docker is unavailable.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(__dirname, "..", "..", "supabase", "migrations", "20260822_wa_booking_bridge.sql");
const SLAB = join(__dirname, "fixtures", "base-slab.sql");
const CONTAINER = `wa-bridge-test-pg-${process.pid}`;

function dockerAvailable() {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

const hasDocker = dockerAvailable();
const HOST_PORT = 55433 + (process.pid % 500);
let RACE_WINNER_CHAT = null; // set by the race test, read by the draft test

function psqlFile(path) {
  const out = execSync(
    `docker exec -i ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < ${path} 2>&1`,
    { encoding: "utf8", timeout: 60000 },
  );
  return out;
}

function norm(sql) {
  return sql.replace(/\s+/g, " ").trim();
}

function psql(sql) {
  try {
    return execSync(
      `docker exec -i ${CONTAINER} psql -U postgres -d postgres -t -A -v ON_ERROR_STOP=1 -c ${JSON.stringify(norm(sql))} 2>&1`,
      { encoding: "utf8", timeout: 60000 },
    ).trim();
  } catch (e) {
    // surface the SQL error text, not just "Command failed"
    throw new Error(`psql failed: ${e.stdout ?? e.message}`);
  }
}

function psqlAsync(sql) {
  return new Promise((resolve) => {
    const p = spawn("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", norm(sql)]);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => resolve({ code, out: out.trim() }));
  });
}

describe("wa sql invariants (sequential)", () => {
before(async () => {
  if (!hasDocker) return;
  // clean any leftover container from an interrupted run (name is pid-based,
  // so this is the only real collision source)
  try {
    execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore", timeout: 30000 });
  } catch {}
  execSync(
    `docker run -d --rm --name ${CONTAINER} -e POSTGRES_PASSWORD=wa-test -p 127.0.0.1:${HOST_PORT}:5432 postgres:16-alpine`,
    { stdio: "pipe", timeout: 60000 },
  );
  // wait for readiness
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      execSync(`docker exec ${CONTAINER} pg_isready -U postgres`, { stdio: "ignore", timeout: 10000 });
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!ready) throw new Error("postgres container never became ready");
  psqlFile(SLAB);
  psqlFile(MIGRATION);
});

after(() => {
  if (!hasDocker) return;
  try {
    execSync(`docker rm -f ${CONTAINER}`, { stdio: "ignore", timeout: 30000 });
  } catch {}
});

test("migration applies cleanly on the slab", { skip: !hasDocker }, () => {
  const tables = psql(
    "select count(*) from information_schema.tables where table_schema='public' and table_name in ('wa_conversations','wa_events','wa_outbox','wa_proofs','wa_nonces')",
  );
  assert.equal(tables, "5");
});

test("TWO CONCURRENT CLAIMS cannot reserve the same cabin nights", { skip: !hasDocker, timeout: 120000 }, async () => {
  const claim = (chat) => `
    select count(*) from wa_claim_hold(
      (select id from cabins where slug='queen-1'),
      '2027-08-20', '2027-08-22', false, 2, 'Racer ${chat}', '6011${chat}00', '${chat}@s.whatsapp.net',
      180, 0, null, null, 0
    )`;
  const [a, b] = await Promise.all([psqlAsync(claim("1111")), psqlAsync(claim("2222"))]);
  const winners = [a, b].filter((r) => r.code === 0 && r.out === "1").length;
  assert.equal(winners, 1, `expected exactly one winning claim; got A=${JSON.stringify(a)} B=${JSON.stringify(b)}`);
  assert.equal(psql("select count(*) from booking_requests"), "1");
  // derive the winner from the DB: the loser may lose by empty result OR by
  // unique-violation, so inspecting a/b outputs is not deterministic
  RACE_WINNER_CHAT = psql("select wa_chat_id from booking_requests where source='wa' and status='pending_payment'");
  assert.ok(RACE_WINNER_CHAT, "winner not determined");
});

test("replayed webhook events are deduped", { skip: !hasDocker }, () => {
  const insert = `insert into wa_events (event_id, chat_id, type, payload) values ('evt-1','6011@s.whatsapp.net','message','{}'::jsonb) on conflict (event_id) do nothing`;
  psql(insert);
  psql(insert);
  assert.equal(psql("select count(*) from wa_events where event_id='evt-1'"), "1");
});

test("stale holds expire exactly once and report their chat", { skip: !hasDocker }, () => {
  psql("update booking_requests set hold_expires_at = now() - interval '1 minute'");
  const rows = psql("select chat_id from wa_expire_stale_holds()");
  assert.ok(rows.includes(RACE_WINNER_CHAT), `sweep returned: ${rows}`);
  assert.equal(psql("select count(*) from booking_requests where status='expired'"), "1");
  // second sweep is a no-op
  assert.equal(psql("select count(*) from wa_expire_stale_holds()"), "0");
});

test("a second live WA draft for the same chat is impossible", { skip: !hasDocker }, () => {
  // fresh chat with no draft yet: first claim wins and becomes the live draft
  psql(`
    select count(*) from wa_claim_hold(
      (select id from cabins where slug='queen-1'),
      '2027-09-01', '2027-09-03', false, 2, 'First draft', '6011555500', '5555@s.whatsapp.net',
      160, 0, null, null, 0
    )`);
  // a second claim for that same chat must return 0 rows (live-draft index)
  const res = psql(`
    select count(*) from wa_claim_hold(
      (select id from cabins where slug='queen-1'),
      '2027-10-01', '2027-10-03', false, 2, 'Dup chat', '6011555500', '5555@s.whatsapp.net',
      160, 0, null, null, 0
    )`);
  assert.equal(res, "0");
  assert.equal(
    psql("select count(*) from booking_requests where wa_chat_id='5555@s.whatsapp.net'"),
    "1",
  );
});

test("outbox dedupe: same dedupe_key cannot enqueue twice", { skip: !hasDocker }, () => {
  const ins = `insert into wa_outbox (chat_id, kind, dedupe_key, payload) values ('6011@s.whatsapp.net','hold-expired','dedup-1','{}'::jsonb) on conflict (dedupe_key) do nothing`;
  psql(ins);
  psql(ins);
  assert.equal(psql("select count(*) from wa_outbox where dedupe_key='dedup-1'"), "1");
});

test("outbox claim/restart semantics: retries capped at 3 then failed", { skip: !hasDocker }, () => {
  // fresh row claims once; immediate re-claim finds nothing (restart-safe window)
  assert.equal(psql("select count(*) from wa_outbox_claim(10)"), "1");
  const after1 = psql("select status||'/'||attempts from wa_outbox where dedupe_key='dedup-1'");
  assert.equal(after1, "sending/1");
  assert.equal(psql("select count(*) from wa_outbox_claim(10)"), "0", "fresh sending row must not be re-claimed");

  // stuck row (bridge crashed) is reclaimed after 5 minutes. The touch trigger
  // rewrites updated_at on every UPDATE, so backdate with triggers disabled —
  // must be one psql session since session_replication_role is per-session.
  const stale = () => psql(
    "set session_replication_role = replica; " +
    "update wa_outbox set updated_at = now() - interval '6 minutes' where dedupe_key='dedup-1'; " +
    "set session_replication_role = default",
  );
  stale();
  assert.equal(psql("select count(*) from wa_outbox_claim(10)"), "1");
  const after2 = psql("select status||'/'||attempts from wa_outbox where dedupe_key='dedup-1'");
  assert.equal(after2, "sending/2");

  stale();
  psql("select count(*) from wa_outbox_claim(10)");
  assert.equal(psql("select attempts from wa_outbox where dedupe_key='dedup-1'"), "3");

  // exhausted retry budget: next claim flips it to failed and does not return it
  stale();
  assert.equal(psql("select count(*) from wa_outbox_claim(10)"), "0");
  assert.equal(psql("select status from wa_outbox where dedupe_key='dedup-1'"), "failed");
});

test("proof dedupe: one proof row per WA media message", { skip: !hasDocker }, () => {
  const group = psql("select booking_group_id from booking_requests limit 1");
  const ins = (id) => `
    insert into wa_proofs (booking_group_id, kind, wa_message_id, chat_id, status)
    values ('${group}', 'deposit', '${id}', '6011@s.whatsapp.net', 'uploading')
    on conflict (wa_message_id) do nothing`;
  psql(ins("wa-media-1"));
  psql(ins("wa-media-1"));
  assert.equal(psql("select count(*) from wa_proofs where wa_message_id='wa-media-1'"), "1");
  psql(ins("wa-media-2"));
  assert.equal(psql("select count(*) from wa_proofs"), "2");
});

test("price mismatch claims are rejected", { skip: !hasDocker }, () => {
  let errText = "";
  try {
    psql(`
      select count(*) from wa_claim_hold(
        (select id from cabins where slug='queen-1'),
        '2027-10-01', '2027-10-03', false, 2, 'Price liar', '6011999999', '9999@s.whatsapp.net',
        1, 0, null, null, 0
      )`);
  } catch (e) {
    errText = String(e.stdout ?? e.message ?? e);
  }
  assert.match(errText, /WA_HOLD_PRICE_MISMATCH/);
});

}); // end describe (sequential SQL checks)