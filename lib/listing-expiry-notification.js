/** Build the Arabic notice and stable delivery key for one listing subscription period. */
export function listingExpiryNotification({ layer, featureId, userId, endDate, name, typeName }) {
    const kind = String(typeName || 'الإعلان').trim();
    const listingName = String(name || '').trim() || kind;
    const dateKey = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : String(endDate).slice(0, 10);
    return {
        title: 'انتهاء الاشتراك',
        message: `انتهى اشتراك ${kind} «${listingName}». تم إخفاء الإعلان عن الزوار.`,
        type: 'warning',
        link: '/my-listings',
        dedupeKey: `listing-expiry:${layer}:${featureId}:${userId}:${dateKey}`,
    };
}
