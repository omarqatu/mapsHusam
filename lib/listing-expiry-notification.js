/** Build the Arabic notice and stable delivery key for one listing subscription period. */
export function listingExpiryNotification({ layer, featureId, userId, endDate, name, typeName }) {
    const kind = String(typeName || 'الإعلان').trim();
    const listingName = String(name || '').trim() || kind;
    // pg reads a DATE as local midnight: take the local calendar day (toISOString would give the day before east of UTC).
    const dateKey = endDate instanceof Date
        ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
        : String(endDate).slice(0, 10);
    if (featureId == null || userId == null || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        throw new TypeError('listingExpiryNotification needs layer, featureId, userId and endDate');
    }
    return {
        title: 'انتهاء الاشتراك',
        message: `انتهى اشتراك ${kind} «${listingName}». تم إخفاء الإعلان عن الزوار.`,
        type: 'warning',
        link: '/my-listings',
        dedupeKey: `listing-expiry:${layer}:${featureId}:${userId}:${dateKey}`,
    };
}
