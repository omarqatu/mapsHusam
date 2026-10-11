import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSERT_LAND_SALE_SQL, landSaleApprovalParams } from './land-sale-approval.js';

test('land approval inserts the complete property-layer shape and reads its primary key and interior point', () => {
    assert.match(INSERT_LAND_SALE_SQL, /location, name, phone, price, currency, des, pic, video, area, status/);
    assert.match(INSERT_LAND_SALE_SQL, /gov_a, village_a,[\s\S]*start_date, end_date, work_hours, auto_status/);
    assert.match(INSERT_LAND_SALE_SQL, /CURRENT_DATE, NULL, \$13, 0/);
    assert.match(INSERT_LAND_SALE_SQL, /RETURNING fid AS id, ST_X\(ST_PointOnSurface\(geom\)\) AS x_coord/);
    assert.doesNotMatch(INSERT_LAND_SALE_SQL, /\bx_coord\b.*INSERT INTO/s);

    const geometry = {
        type: 'Polygon',
        coordinates: [[[169000, 145000], [169100, 145000], [169100, 145100], [169000, 145100], [169000, 145000]]],
    };
    const values = landSaleApprovalParams(
        {
            phone: '0591234567',
            whatsapp: '+970591234567',
            price: null,
            currency: 'ILS',
            area: null,
            geometry,
            des: 'description',
            work_hours: '24 ساعة',
        },
        { name: 'قطعة أرض', des: 'description', searchTags: '' },
    );

    assert.equal(values.length, 13);
    assert.deepEqual(values.slice(0, 11), [
        'غير محدد',
        'قطعة أرض',
        '0591234567',
        0,
        'ILS',
        'description',
        0,
        'غير محدد',
        'غير محدد',
        '+970591234567',
        'أرض للبيع، description، أرض للبيع، أراضي، كوشان، طابو، سكن، زراعي، تجاري، نمرة أرض، استثمار عقاري، مساحات، عقارات للبيع',
    ]);
    assert.equal(values[11], JSON.stringify(geometry));
    assert.equal(values[12], '24 ساعة');

    const legacySubmissionValues = landSaleApprovalParams(
        { phone: '0591234567', price: null, currency: 'ILS', area: null, geometry },
        { name: 'قطعة أرض قديمة', des: null, searchTags: '' },
    );
    assert.equal(legacySubmissionValues[12], '24 ساعة');
});
