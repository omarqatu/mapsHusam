/**
 * tools/mock-geoserver.mjs — بديل GeoServer للاختبار المحلي فقط.
 * يرجع WFS GetFeature (GeoJSON) مباشرة من قاعدة الاختبار حتى تعمل الخريطة واختبارات البروكسي بدون GeoServer.
 * التشغيل:  POSTGRES_USER=postgres POSTGRES_PASSWORD=... node tools/mock-geoserver.mjs
 * ثم بملف .env للسيرفر:  GEOSERVER_TARGET=http://127.0.0.1:3998/geoserver
 */
import http from 'http';
import pg from 'pg';
const conn = { host: process.env.POSTGRES_HOST || 'localhost', user: process.env.POSTGRES_USER || 'postgres', password: process.env.POSTGRES_PASSWORD || '' };
const pools = { services: new pg.Pool({ ...conn, database: process.env.SERVICES_DB_NAME || 'services_db' }), realestate: new pg.Pool({ ...conn, database: process.env.REAL_ESTATE_DB_NAME || 'realestate' }) };
Object.values(pools).forEach(p => p.on('error', e => console.warn('pool error:', e.message)));
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const tn = u.searchParams.get('typeName') || u.searchParams.get('typename') || '';
  const [ws, table] = tn.split(':');
  if ((u.searchParams.get('request') || '').toLowerCase() !== 'getfeature' || !table) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(); }
  try {
    const pool = pools[ws] || pools.services;
    const idCol = ws === 'realestate' ? 'fid' : 'id';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error('bad typeName');
    const r = await pool.query(`SELECT *, ST_AsGeoJSON(geom) AS gj FROM public."${table}"`);
    const features = r.rows.map(row => { const { geom, gj, ...p } = row; return { type: 'Feature', id: `${table}.${row[idCol]}`, geometry: JSON.parse(gj), properties: p }; });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', totalFeatures: features.length, features }));
  } catch (e) { res.writeHead(500); res.end(e.message); }
}).listen(Number(process.env.MOCK_GEOSERVER_PORT || 3998), () => console.log('mock GeoServer on', process.env.MOCK_GEOSERVER_PORT || 3998));
