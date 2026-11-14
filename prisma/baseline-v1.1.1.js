const { createHash } = require('node:crypto');
const { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

// Only these migrations describe the v1.1.1 SQLite schema.
const baseline = [
  '20260205030106_init',
  '20260206080254_add_whatsapp_integration',
  '20260206092937_add_payment_gateway',
  '20260206231859_add_roles_and_recurring',
  '20260212005448_add_business_profile_fields',
  '20260216025924_add_sales_credit_purchase_order',
  '20260216030657_phase5_crm_pos_hr_meterai_marketplace',
  '20260702045738_reconcile_invoice_status',
];
const migrations = join(__dirname, 'migrations');
const cli = (...args) => execFileSync('./node_modules/.bin/prisma', args, { stdio: 'inherit' });

async function markBaseline() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith('file:')) throw new Error('The v1.1.1 baseline requires a SQLite DATABASE_URL.');

  const temp = mkdtempSync(join(tmpdir(), 'billku-baseline-'));
  try {
    const reference = join(temp, 'migrations');
    mkdirSync(reference);
    cpSync(join(migrations, 'migration_lock.toml'), join(reference, 'migration_lock.toml'));
    for (const name of baseline) {
      cpSync(join(migrations, name), join(reference, name), { recursive: true });
    }

    // A nonempty diff aborts before any migration history is written.
    cli('migrate', 'diff', '--from-url', url, '--to-migrations', reference,
      '--shadow-database-url', `file:${join(temp, 'shadow.db')}`, '--exit-code');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  const db = new PrismaClient();
  let applied;
  try {
    const history = await db.$queryRaw`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'`;
    applied = history.length ? await db.$queryRaw`
      SELECT migration_name, checksum, finished_at IS NOT NULL AS finished
      FROM _prisma_migrations WHERE rolled_back_at IS NULL
    ` : [];
  } finally {
    await db.$disconnect();
  }
  for (const row of applied) {
    const name = row.migration_name;
    if (!baseline.includes(name) || !row.finished) {
      throw new Error('Unexpected or unfinished migration in SQLite history. Review it before baselining.');
    }
    const checksum = createHash('sha256').update(readFileSync(join(migrations, name, 'migration.sql'))).digest('hex');
    if (checksum !== row.checksum) throw new Error(`Migration checksum differs for ${name}.`);
  }
  for (const name of baseline) {
    if (!applied.some(row => row.migration_name === name)) cli('migrate', 'resolve', '--applied', name);
  }
}

markBaseline().catch(error => {
  console.error('BillKu could not baseline this SQLite database.', error.message);
  process.exitCode = 1;
});
