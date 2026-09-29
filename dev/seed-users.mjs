// Seeds three known dev accounts (admin / provider / user) with bcrypt hashes. Idempotent.
// Usage: via dev/dev.sh seed (loads dev/dev.env first).
import bcrypt from 'bcrypt';
import pg from 'pg';

const accounts = [
  { full_name: 'Dev Admin', phone: '0590000001', role: 'admin', password: 'Admin#12345' },
  { full_name: 'Dev Provider', phone: '0590000002', role: 'provider', password: 'Provider#12345' },
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
  await pool.query(
    `INSERT INTO public.users (full_name, email, phone, password_hash, role, status, is_active)
     VALUES ($1, $2, $3, $4, $5, 0, true)
     ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = true`,
    [a.full_name, `${a.role}@dev.local`, a.phone, hash, a.role],
  );
  console.log(`seeded ${a.role}: phone ${a.phone} / password ${a.password}`);
}
await pool.end();
