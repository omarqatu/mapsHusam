// Seeds three known dev accounts (admin / provider / user) with bcrypt hashes. Idempotent.
// Usage: via dev/dev.sh seed (loads dev/dev.env first).
import bcrypt from 'bcrypt';
import pg from 'pg';

const accounts = [
  { full_name: 'Dev Admin', phone: '0590000001', role: 'admin', password: 'Admin#12345' },
  { full_name: 'Dev Provider', phone: '0590000002', role: 'provider', password: 'Provider#12345',
    // Linked to a service feature so service requests can be created against it (live tests use this).
    service_layer: 'plumber', feature_id: 900001 },
  { full_name: 'Dev User', phone: '0590000003', role: 'user', password: 'User#12345' },
];

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.SERVICES_DB_NAME,
});

for (const a of accounts) {
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
