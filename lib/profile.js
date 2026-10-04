// The account owner's own edit of their profile (PATCH /api/auth/profile): name, WhatsApp, email. The phone is the
// login and stays as it is; the role and the linked listing are the admin's.

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/**
 * `body` → `{ value }` with only the fields sent (columns of public.users), or `{ error }`. `normalizeWhatsapp` is
 * the server's `normalizeWhatsappNumber`. An empty WhatsApp / email clears it; the name cannot be emptied.
 */
export function parseProfileEdit(body, normalizeWhatsapp) {
    const value = {};
    if (!body || typeof body !== 'object') return { error: 'لا توجد بيانات للحفظ.' };

    if (body.full_name !== undefined) {
        const name = typeof body.full_name === 'string' ? body.full_name.replace(/[<>]/g, '').trim() : '';
        if (!name) return { error: 'اكتب اسمك.' };
        if (name.length > 100) return { error: 'الاسم طويل جداً.' };
        value.full_name = name;
    }

    if (body.whatsapp_number !== undefined) {
        if (body.whatsapp_number !== null && typeof body.whatsapp_number !== 'string')
            return { error: 'رقم واتساب غير صالح.' };
        const raw = (body.whatsapp_number ?? '').trim();
        if (!raw) value.whatsapp_number = null;
        else {
            const n = normalizeWhatsapp(raw);
            if (!n || !/^\+\d{9,15}$/.test(n)) return { error: 'رقم واتساب غير صالح.' };
            value.whatsapp_number = n;
        }
    }

    if (body.email !== undefined) {
        if (body.email !== null && typeof body.email !== 'string') return { error: 'البريد الإلكتروني غير صالح.' };
        const email = (body.email ?? '').trim().toLowerCase();
        if (email && (email.length > 150 || !EMAIL.test(email))) return { error: 'البريد الإلكتروني غير صالح.' };
        // the column predates this page: an empty email is stored as '' (as at register), not null
        value.email = email;
    }

    if (Object.keys(value).length === 0) return { error: 'لا توجد بيانات للحفظ.' };
    return { value };
}
