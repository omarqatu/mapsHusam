import { submissionWorkHours } from './listing-rules.js';

const LAND_SEARCH_TAGS =
    'أرض للبيع، أراضي، كوشان، طابو، سكن، زراعي، تجاري، نمرة أرض، استثمار عقاري، مساحات، عقارات للبيع';

export const INSERT_LAND_SALE_SQL = `
    INSERT INTO public."LandSale" (
        location, name, phone, price, currency, des, pic, video, area, status, gov_a, village_a,
        start_date, end_date, work_hours, auto_status, whatsapp, search_tags, rating, geom
    )
    VALUES (
        $1, $2, $3, $4, $5, $6, NULL, NULL, $7, 0, $8, $9,
        CURRENT_DATE, $14, $13, 0, $10, $11, $15,
        ST_SetSRID(ST_GeomFromGeoJSON($12::text), 28191)
    )
    RETURNING fid AS id, ST_X(ST_PointOnSurface(geom)) AS x_coord, ST_Y(ST_PointOnSurface(geom)) AS y_coord
`;

export function landSaleApprovalParams(submission, { name, des, searchTags }) {
    const description = des || null;
    const tags = searchTags
        ? `${searchTags}، ${LAND_SEARCH_TAGS}`
        : ['أرض للبيع', description?.trim().slice(0, 40), LAND_SEARCH_TAGS].filter(Boolean).join('، ');

    return [
        'غير محدد',
        name,
        submission.phone,
        submission.price === null ? 0 : Math.round(Number(submission.price)),
        submission.currency || 'USD',
        description,
        submission.area === null ? 0 : Number(submission.area),
        'غير محدد',
        'غير محدد',
        submission.whatsapp,
        tags,
        JSON.stringify(submission.geometry),
        submissionWorkHours('LandSale', submission.work_hours),
    ];
}
