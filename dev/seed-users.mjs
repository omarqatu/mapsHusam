// Seeds three known dev accounts (admin / provider / user) with bcrypt hashes. Idempotent.
// Usage: via dev/dev.sh seed (loads dev/dev.env first).
import bcrypt from 'bcrypt';
import pg from 'pg';

const accounts = [
  { full_name: 'Dev Admin', phone: '0590000001', role: 'admin', password: 'Admin#12345' },
  // The provider is linked (below) to a real plumber row, so service requests and the provider panel have a target.
  { full_name: 'Dev Provider', phone: '0590000002', role: 'provider', password: 'Provider#12345', linkPlumber: true },
  { full_name: 'Dev User', phone: '0590000003', role: 'user', password: 'User#12345' },
];

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.SERVICES_DB_NAME,
});

// A real, not yet linked plumber feature (a dangling id would 404 on every status update).
async function freePlumberId() {
  const { rows } = await pool.query(
    `SELECT id FROM public.service_all WHERE discriminator = 'plumber'
       AND id NOT IN (SELECT feature_id FROM public.users WHERE feature_id IS NOT NULL AND phone <> '0590000002')
     ORDER BY id LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

for (const a of accounts) {
  if (a.linkPlumber) {
    a.feature_id = await freePlumberId();
    a.service_layer = a.feature_id ? 'plumber' : null;
  }
  const hash = await bcrypt.hash(a.password, 10);
  // The production schema has no unique constraint on phone, so replace instead of upsert.
  await pool.query('DELETE FROM public.users WHERE phone = $1', [a.phone]);
  await pool.query(
    `INSERT INTO public.users (full_name, email, phone, password_hash, role, status, is_active, service_layer, feature_id)
     VALUES ($1, $2, $3, $4, $5, 0, true, $6, $7)`,
    [a.full_name, `${a.role}@dev.local`, a.phone, hash, a.role, a.service_layer ?? null, a.feature_id ?? null],
  );
  console.log(`seeded ${a.role}: phone ${a.phone} / password ${a.password}`);
}
await pool.end();
