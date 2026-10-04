/**
 * tools/test-scenarios.mjs
 * اختبار آلي لسيناريوهات: الإعلانات المتعددة والصور، التقييمات وتقييم الناشر،
 * إخفاء الطبقات (API + بروكسي الخريطة)، قواعد التوفر بالبحث، وحجب بيانات التواصل عن الزائر.
 *
 * يعمل على قاعدة اختبار database/local_test_seed.sql (لا تشغّله على الإنتاج - ينشئ ويحذف بيانات).
 * الاستخدام:  BASE_URL=http://localhost:3000 node tools/test-scenarios.mjs
 * (اختبارات البروكسي تتطلب GeoServer أو بديلاً يرجع معالم service_all وApartRent)
 */
const B = process.env.BASE_URL || 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('✅', m); } else { fail++; console.log('❌', m); } };
async function j(path, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const r = await fetch(B + path, { ...opts, headers });
  let body; const t = await r.text(); try { body = JSON.parse(t); } catch { body = t; }
  return { status: r.status, body };
}
async function login(phone) { const r = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, password: 'Test1234' }) }); return r.body.user?.token || r.body.token; }
const prov = await login('0590000002'), user = await login('0590000003'), user2 = await login('0590000004');
ok(prov && user, 'login tokens');

// --- item 7 + 4: search visibility
let r = await j('/api/search-features?layer=villas_rent&workspace=services');
const names = r.body.features.map(f => f.properties.name);
ok(names.includes('فيلا متاحة') && names.includes('فيلا غير متاحة') && names.includes('فيلا خارج الدوام'), 'service unavailable/out-of-hours still shown: ' + names.join('|'));
ok(!names.includes('فيلا ملغاة') && !names.includes('فيلا منتهية الاشتراك'), 'cancelled/expired services hidden');
ok(names[0] === 'فيلا متاحة', 'available first');
const offHours = r.body.features.find(f => f.properties.name === 'فيلا خارج الدوام');
ok(offHours.properties.auto_status === 1 && offHours.properties.availability === 'unavailable', 'live auto_status for out of hours');
ok(r.body.features.every(f => f.properties.whatsapp == null && f.properties.contact_hidden), 'guest: contact stripped');
r = await j('/api/search-features?layer=villas_rent&workspace=services', {}, user);
ok(r.body.features.some(f => f.properties.whatsapp), 'logged in: contact present');
r = await j('/api/search-features?layer=ApartRent&workspace=realestate', {}, user);
ok(r.body.features.length === 1 && r.body.features[0].properties.name === 'شقة متوفرة', 'unavailable apartment hidden');
r = await j('/api/search-features?layer=electrician&workspace=services');
ok(r.body.features.length === 0, 'hidden layer search empty');
r = await j('/api/search-features?layer=service_all&workspace=services', {}, user);
ok(!r.body.features.some(f => f.properties.discriminator === 'electrician'), 'service_all excludes hidden discriminators');
r = await j('/api/search-features-batch', { method: 'POST', body: JSON.stringify({ layer: 'electrician', workspace: 'services', ids: [6] }) });
ok(r.body.features.length === 0, 'batch hidden empty');
r = await j('/api/get-unique-values?layer=electrician&workspace=services&field=name');
ok(r.body.values.length === 0, 'unique values hidden empty');
r = await j('/api/layer-visibility');
ok(r.body.hidden.includes('electrician'), 'layer-visibility list');
r = await j('/api/platform-contact');
ok(r.body.platform_name === 'دليلك وين', 'platform contact name');

// --- item 1/2: listings
r = await j('/api/my-listings/catalog', {}, user);
ok(r.status === 403, 'normal user cannot use listings');
r = await j('/api/my-listings/catalog', {}, prov);
ok(r.body.services.some(s => s.layer === 'villas_rent') && !r.body.services.some(s => s.layer === 'electrician') && r.body.properties.length === 3, 'catalog excludes hidden');
r = await j('/api/my-listings', {}, prov);
ok(r.body.items.length === 1 && r.body.items[0].is_primary, 'legacy listing migrated');
r = await j('/api/my-listings', { method: 'POST', body: JSON.stringify({ layer: 'hotels', name: 'فندق المزود', whatsapp: '0591112223', des: 'وصف', work_hours: '08:00-20:00', x_coord: 172000, y_coord: 147000 }) }, prov);
ok(r.body.success, 'add second service ' + JSON.stringify(r.body));
const hotelId = r.body.feature_id;
r = await j('/api/my-listings', { method: 'POST', body: JSON.stringify({ layer: 'electrician', name: 'x', whatsapp: '0591112223', x_coord: 172000, y_coord: 147000 }) }, prov);
ok(r.status === 403, 'cannot add to hidden layer');
r = await j('/api/my-listings', { method: 'POST', body: JSON.stringify({ layer: 'ApartSale', name: 'شقة للبيع من المزود', price: 90000, area: 150, phone: '0591112224', x_coord: 172100, y_coord: 147100 }) }, prov);
ok(r.body.success, 'add property ' + JSON.stringify(r.body));
const aptId = r.body.feature_id;
r = await j('/api/my-listings', { method: 'POST', body: JSON.stringify({ layer: 'LandSale', name: 'أرض', price: 50000, area: 900, phone: '0591112224', x_coord: 172200, y_coord: 147200 }) }, prov);
ok(r.body.success, 'add land polygon ' + JSON.stringify(r.body));
const landId = r.body.feature_id;
r = await j(`/api/my-listings/LandSale/${landId}`, {}, prov);
ok(r.body.item && Math.abs(r.body.item.x_coord - 172200) < 1, 'land centroid ok');
r = await j(`/api/my-listings/ApartSale/${aptId}`, { method: 'PUT', body: JSON.stringify({ price: 95000, status: 1, x_coord: 172150, y_coord: 147150 }) }, prov);
ok(r.body.success, 'edit property');
r = await j(`/api/my-listings/ApartSale/${aptId}`, { method: 'PUT', body: JSON.stringify({ price: 1 }) }, user2);
ok(r.status === 403, 'other user cannot edit');
r = await j(`/api/search-features?layer=ApartSale&workspace=realestate`, {}, user);
ok(!r.body.features.some(f => f.properties.fid === aptId), 'unavailable property not in search after edit');
r = await j(`/api/my-listings/hotels/${hotelId}`, { method: 'PUT', body: JSON.stringify({ status: 2 }) }, prov);
r = await j(`/api/search-features?layer=hotels&workspace=services`, {}, user);
ok(!r.body.features.some(f => f.properties.id === hotelId), 'cancelled service hidden from search');
r = await j(`/api/my-listings/hotels/${hotelId}`, { method: 'PUT', body: JSON.stringify({ status: 1 }) }, prov);
r = await j(`/api/search-features?layer=hotels&workspace=services`, {}, user);
ok(r.body.features.some(f => f.properties.id === hotelId), 'unavailable service shown in search');
r = await j(`/api/my-listings/hotels/${hotelId}`, { method: 'PUT', body: JSON.stringify({ whatsapp: 'abc' }) }, prov);
ok(r.status === 400, 'validation on bad phone');

// images
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
r = await j(`/api/my-listings/hotels/${hotelId}/images`, { method: 'POST', body: JSON.stringify({ image: png }) }, prov);
ok(r.body.success, 'upload image');
const imgId = r.body.id;
r = await j(`/api/my-listings/hotels/${hotelId}/images`, { method: 'POST', body: JSON.stringify({ image: 'data:image/png;base64,' + Buffer.from('<script>').toString('base64') }) }, prov);
ok(r.status === 400, 'reject fake image');
const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xFF,0xD8,0xFF]), Buffer.alloc(2.5*1024*1024)]).toString('base64');
r = await j(`/api/my-listings/hotels/${hotelId}/images`, { method: 'POST', body: JSON.stringify({ image: big }) }, prov);
ok(r.status === 413, 'reject big image ' + r.status);
r = await fetch(B + `/api/listing-images/${imgId}`);
ok(r.status === 200 && r.headers.get('content-type') === 'image/png', 'serve image');
r = await j(`/api/listing-images?layer=hotels&feature_id=${hotelId}`);
ok(r.body.images.length === 1, 'list images');
r = await j(`/api/search-features?layer=hotels&workspace=services`, {}, user);
ok(r.body.features.find(f => f.properties.id === hotelId).properties.pic === `/api/listing-images/${imgId}`, 'pic synced');

// --- item 3: ratings
r = await j('/api/listing-ratings', { method: 'POST', body: JSON.stringify({ layer: 'hotels', feature_id: hotelId, rating: 4, comment: 'ممتاز' }) });
ok(r.status === 401, 'guest cannot rate');
r = await j('/api/listing-ratings', { method: 'POST', body: JSON.stringify({ layer: 'hotels', feature_id: hotelId, rating: 5 }) }, prov);
ok(r.status === 400, 'owner cannot rate own');
r = await j('/api/listing-ratings', { method: 'POST', body: JSON.stringify({ layer: 'hotels', feature_id: hotelId, rating: 4, comment: 'ممتاز' }) }, user);
ok(r.body.success, 'user rates service');
r = await j('/api/listing-ratings', { method: 'POST', body: JSON.stringify({ layer: 'ApartSale', feature_id: aptId, rating: 2 }) }, user2);
ok(r.body.success, 'user2 rates property');
r = await j('/api/listing-ratings', { method: 'POST', body: JSON.stringify({ layer: 'hotels', feature_id: hotelId, rating: 5, comment: 'تعديل' }) }, user);
r = await j(`/api/listing-ratings?layer=hotels&feature_id=${hotelId}`, {}, user);
ok(r.body.total === 1 && r.body.average === 5 && r.body.my_rating.rating === 5, 'upsert rating');
ok(r.body.owner && r.body.owner.total === 2 && r.body.owner.average === 3.5 && r.body.owner.listings === 4, 'publisher rating ' + JSON.stringify(r.body.owner));
r = await j('/api/listing-ratings/summary', { method: 'POST', body: JSON.stringify({ items: [{ layer: 'hotels', feature_id: hotelId }, { layer: 'ApartSale', feature_id: aptId }] }) });
ok(r.body.summary[`hotels:${hotelId}`].average === 5, 'summary');

// provider-linked includes new
r = await j('/api/provider-linked-features');
ok((r.body.linked.hotels || []).includes(hotelId), 'linked features include new listing');
// service request routed to multi-listing provider
r = await j('/api/service-requests', { method: 'POST', body: JSON.stringify({ service_layer: 'hotels', feature_id: hotelId, provider_name: 'x', service_type: 'فنادق' }) }, user);
ok(r.body.success, 'service request to second listing ' + JSON.stringify(r.body));
r = await j('/api/service-requests', { method: 'POST', body: JSON.stringify({ service_layer: 'electrician', feature_id: 6 }) }, user);
ok(r.status === 403, 'service request to hidden layer rejected');

// delete
r = await j(`/api/my-listings/villas_rent/1`, { method: 'DELETE' }, prov);
ok(r.status === 400, 'cannot delete legacy primary');
r = await j(`/api/my-listings/hotels/${hotelId}`, { method: 'DELETE' }, prov);
ok(r.body.success, 'delete listing');
r = await j(`/api/listing-images/${imgId}`);
ok(r.status === 404, 'image deleted with listing');

// --- map proxy (WFS GetFeature) filtering
const wfs = (ws, tn) => `/geoserver-proxy/${ws}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${ws}:${tn}&outputFormat=application/json`;
r = await j(wfs('services', 'service_all'));
if (r.status === 200 && r.body.features) {
  const discs = r.body.features.map(f => f.properties.discriminator);
  ok(!discs.includes('electrician'), 'proxy: hidden discriminator removed from map data');
  ok(r.body.features.every(f => !f.properties.whatsapp), 'proxy: guest contact stripped');
  ok(!r.body.features.some(f => f.properties.status === 2), 'proxy: cancelled service removed');
  r = await j(wfs('services', 'service_all'), {}, user);
  ok(r.body.features.some(f => f.properties.whatsapp), 'proxy: logged-in sees contact');
  r = await j(wfs('realestate', 'ApartRent'), {}, user);
  ok(r.body.features.every(f => Number(f.properties.status || 0) === 0), 'proxy: unavailable apartments removed');
  r = await j(wfs('realestate', 'Location'));
  ok(r.body.features.length === 0, 'proxy: hidden layer returns empty collection');
} else {
  console.log('⚠️ proxy tests skipped (GeoServer not reachable):', r.status);
}

r = await j('/api/platform-stats');
ok(r.body.success, 'platform stats');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
