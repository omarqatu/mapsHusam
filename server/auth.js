// Sessions (JWT), the requireAuth / requireAdmin guards, and the per-user request quota.
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET, BCRYPT_SALT_ROUNDS, io } from './app.js';
import { servicesPool } from './database.js';

// =========================================================================
// 🔒 [الدفعة 2] مصادقة كل المستخدمين عبر JWT
// أي مسار يحتاج هوية المستخدم يأخذها من التوكن (req.auth.uid) وليس من جسم الطلب/الاستعلام.
// =========================================================================
const AUTH_STATUS_TTL_MS = 15000; // نتيجة فحص حالة الحساب تُخزَّن 15 ثانية لتخفيف الحمل على قاعدة البيانات
export const authStatusCache = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [uid, entry] of authStatusCache) {
        if (now - entry.at > AUTH_STATUS_TTL_MS * 4) authStatusCache.delete(uid);
    }
}, 5 * 60 * 1000).unref();

export async function getAuthStatus(uid) {
    const cached = authStatusCache.get(uid);
    if (cached && Date.now() - cached.at < AUTH_STATUS_TTL_MS) return cached;
    const r = await servicesPool.query(
        'SELECT role, is_active, force_logout_flag, token_version FROM public.users WHERE user_id = $1',
        [uid]
    );
    const row = r.rows[0] || null;
    const entry = {
        at: Date.now(),
        exists: !!row,
        role: row ? row.role : null,
        tokenVersion: row ? (Number(row.token_version) || 0) : 0,
        active: !!(row && row.is_active && row.force_logout_flag !== true)
    };
    authStatusCache.set(uid, entry);
    return entry;
}

// 🔒 عمر جلسة الدخول: التوكن يحمل exp (SESSION_TTL_DAYS، افتراضياً 30 يوماً) ويُجدَّد تلقائياً عبر X-New-Token
// حين يقترب انتهاؤه، فالمستخدم النشط لا يخرج أبداً، والتوكن المسروق من جهاز متروك يموت وحده.
// الإبطال الفوري ما زال عبر token_version / is_active / force_logout_flag.
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) > 0 ? Number(process.env.SESSION_TTL_DAYS) : 30;
const SESSION_RENEW_WITHIN_S = Math.min(7, SESSION_TTL_DAYS / 2) * 86400;

export function signSessionToken(uid, role, tokenVersion) {
    // jti عشوائي: كل جلسة لها توكن مختلف حتى لو دخل المستخدم من جهازين بنفس الثانية (فيُنهي الخروج جلسة واحدة فقط)
    return jwt.sign({ uid: Number(uid), role, tv: Number(tokenVersion) || 0 }, ADMIN_JWT_SECRET, { expiresIn: `${SESSION_TTL_DAYS}d`, jwtid: crypto.randomUUID() });
}

// توكنات ما قبل هذا التعديل بلا exp: تبقى صالحة وتُستبدل بتوكن له exp عند أول طلب.
function sessionTokenNeedsRenewal(decoded) {
    return !decoded.exp || decoded.exp - Math.floor(Date.now() / 1000) < SESSION_RENEW_WITHIN_S;
}

// رقم المشرف صاحب التوكن إن كان توكن جلسة صالحاً لمشرف فعّال (وإلا null). لا يرمي أبداً.
/** The session behind a token ({ uid, role }) or null: same checks as requireAuth (signature, revoked, active, version). */
export async function sessionFromToken(token) {
    if (!token || isTokenRevoked(token)) return null;
    try {
        const decoded = jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
        const uid = Number(decoded.uid);
        if (!Number.isInteger(uid) || uid <= 0) return null;
        const status = await getAuthStatus(uid);
        const ok = status.exists && status.active && (Number(decoded.tv) || 0) === status.tokenVersion;
        return ok ? { uid, role: status.role } : null;
    } catch (e) {
        return null;
    }
}

export async function activeAdminUidFromToken(token) {
    const session = await sessionFromToken(token);
    return session && session.role === 'admin' ? session.uid : null;
}

export function bearerToken(req) {
    const authHeader = req.headers['authorization'] || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

// =========================================================================
// 🔒 تسجيل الخروج يُنهي التوكن على السيرفر أيضاً (وليس بالمتصفح فقط): بصمة التوكن (sha256) تُحفظ حتى انتهاء
// صلاحيته بجدول revoked_sessions وبالذاكرة، وكل فحص توكن يرفضها. يخص هذا الجهاز فقط: أجهزة المستخدم الأخرى تبقى.
// =========================================================================
const revokedTokens = new Map(); // sha256(token) -> انتهاء الصلاحية (ثوانٍ)
export const tokenKey = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export function isTokenRevoked(token) {
    const exp = revokedTokens.get(tokenKey(token));
    return exp !== undefined && exp * 1000 > Date.now();
}

export async function revokeToken(token, exp) {
    const key = tokenKey(token);
    // توكن قديم بلا exp: يُحفظ لأقصى عمر جلسة
    const expiresAt = Number(exp) > 0 ? Number(exp) : Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 86400;
    revokedTokens.set(key, expiresAt);
    await servicesPool.query(
        `INSERT INTO public.revoked_sessions (token_sha256, expires_at) VALUES ($1, to_timestamp($2))
         ON CONFLICT (token_sha256) DO NOTHING`,
        [key, expiresAt]
    );
    // اتصالات socket المفتوحة بهذا التوكن تُقطع فوراً
    for (const socket of io.of('/').sockets.values()) {
        if (socket.data.tokenKey === key) socket.disconnect(true);
    }
}

async function ensureRevokedSessions() {
    try {
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.revoked_sessions (
                token_sha256 TEXT PRIMARY KEY,
                expires_at TIMESTAMPTZ NOT NULL
            )
        `);
        await servicesPool.query('DELETE FROM public.revoked_sessions WHERE expires_at < NOW()');
        const { rows } = await servicesPool.query('SELECT token_sha256, EXTRACT(EPOCH FROM expires_at)::bigint AS exp FROM public.revoked_sessions');
        for (const row of rows) revokedTokens.set(row.token_sha256, Number(row.exp));
    } catch (err) {
        console.error('⚠️ تعذر تحميل الجلسات المنتهية بتسجيل الخروج:', err.message);
    }
}
ensureRevokedSessions();
setInterval(() => {
    const now = Date.now() / 1000;
    for (const [key, exp] of revokedTokens) if (exp < now) revokedTokens.delete(key);
    servicesPool.query('DELETE FROM public.revoked_sessions WHERE expires_at < NOW()').catch(() => {});
}, 60 * 60 * 1000).unref();

export async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ success: false, error: 'يجب تسجيل الدخول أولاً.', code: 'AUTH_REQUIRED' });
    }

    let decoded;
    try {
        // الجلسة تنتهي بعد SESSION_TTL_DAYS بلا نشاط (انظر signSessionToken)؛ الإبطال الفوري عبر token_version أو حالة الحساب.
        decoded = jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
        console.warn('[AUTH] رفض JWT:', e.name, e.message);
        return res.status(401).json({ success: false, error: 'انتهت الجلسة، يرجى تسجيل الدخول من جديد.', code: 'TOKEN_INVALID' });
    }
    if (isTokenRevoked(token)) {
        return res.status(401).json({ success: false, error: 'تم تسجيل الخروج من هذه الجلسة، يرجى تسجيل الدخول من جديد.', code: 'SESSION_REVOKED' });
    }
    const uid = Number(decoded.uid);
    if (!Number.isInteger(uid) || uid <= 0) {
        return res.status(401).json({ success: false, error: 'رمز الدخول غير صالح.', code: 'TOKEN_INVALID' });
    }

    try {
        const status = await getAuthStatus(uid);

        if (!status.exists || !status.active) {
            return res.status(401).json({ success: false, error: 'تم إنهاء جلستك أو تعطيل حسابك، يرجى تسجيل الدخول من جديد.', code: 'SESSION_REVOKED' });
        }
        // 🔒 التوكن يجب أن يطابق رقم نسخة الجلسة الحالي بقاعدة البيانات (توكنات ما قبل هذا التعديل بلا tv = 0)
        const tokenTv = Number(decoded.tv) || 0;
        const dbTv = status.tokenVersion;
        if (tokenTv !== dbTv) {
            return res.status(401).json({ success: false, error: 'تم إنهاء جلستك، يرجى تسجيل الدخول من جديد.', code: 'SESSION_REVOKED' });
        }
        req.auth = { uid, role: status.role };
        if (sessionTokenNeedsRenewal(decoded)) {
            res.setHeader('X-New-Token', signSessionToken(uid, status.role, status.tokenVersion));
        }

        next();
    } catch (err) {
        console.error('❌ خطأ أثناء التحقق من هوية المستخدم:', err.message);
        return res.status(500).json({ success: false, error: 'تعذر التحقق من الهوية.' });
    }
}

export async function isActiveAdmin(uid) {
    try {
        const status = await getAuthStatus(Number(uid));
        return status.exists && status.active && status.role === 'admin';
    } catch (e) {
        return false;
    }
}



// =========================================================================
// 🆕 [إصلاح ثغرة حرجة]: كانت هذه الدالة معرّفة لكن غير مستخدمة إطلاقاً على أي
// من مسارات /api/admin/*، أي أن أي شخص (حتى بدون تسجيل دخول) كان قادراً على
// استدعاء تلك المسارات مباشرة (مثلاً عبر Postman) وتعديل صلاحيات أي مستخدم
// أو تسجيل خروج الجميع، لأن الحماية كانت موجودة فقط بواجهة المتصفح
// (access-guard-style) وهي حماية شكلية يسهل تجاوزها من console المتصفح.
//
// الآن أصبحت middleware حقيقية تُطبَّق على كل مسارات الأدمن: تتحقق من هيدر
// x-admin-user-id (يرسله الفرونت إند مع كل طلب)، وتتأكد أن صاحب هذا المعرّف
// فعلاً role = 'admin' وأن حسابه مُفعّل وغير مسجَّل خروجه إجبارياً، قبل
// السماح للطلب بالمتابعة. أي طلب بدون هيدر صالح يُرفض بـ 403 فوراً.
// =========================================================================
export async function requireAdmin(req, res, next) {

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ success: false, error: 'مطلوب تسجيل دخول كمشرف (توكن مفقود).' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
    } catch (e) {
        return res.status(401).json({ success: false, error: 'جلسة المشرف منتهية أو غير صالحة، يرجى تسجيل الدخول من جديد.' });
    }
    if (isTokenRevoked(token)) {
        return res.status(401).json({ success: false, error: 'تم تسجيل الخروج من هذه الجلسة، يرجى تسجيل الدخول من جديد.', code: 'SESSION_REVOKED' });
    }

    if (decoded.role !== 'admin' || !decoded.uid) {
        return res.status(403).json({ success: false, error: 'لا تملك صلاحية المشرف اللازمة لهذا الإجراء.' });
    }

    try {
        const result = await servicesPool.query(
            'SELECT role, is_active, force_logout_flag, token_version FROM public.users WHERE user_id = $1',
            [decoded.uid]
        );

        // 🔒 جلسة منتهية (حساب محذوف/معطّل، خروج إجباري، تغيّر الدور أو كلمة المرور) = 401 مثل requireAuth، فتُخرج
        // الواجهة المستخدم بدل أن تبقى على "لا تملك صلاحية". 403 فقط لجلسة سليمة لحساب ليس مشرفاً.
        const ended = { success: false, error: 'انتهت جلستك، يرجى تسجيل الدخول من جديد.', code: 'SESSION_REVOKED' };
        if (result.rows.length === 0) return res.status(401).json(ended);

        const { role, is_active, force_logout_flag, token_version } = result.rows[0];

        if (!is_active || force_logout_flag === true || (Number(decoded.tv) || 0) !== (Number(token_version) || 0)) {
            return res.status(401).json(ended);
        }
        if (role !== 'admin') {
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية المشرف اللازمة لهذا الإجراء.' });
        }

        req.adminUserId = decoded.uid;
        next();
    } catch (e) {
        console.error('❌ خطأ في التحقق من صلاحية المشرف:', e.message);
        // 🛡️ عند حدوث خطأ في التحقق نفسه (وليس بالصلاحية) نرفض الطلب أيضاً
        // (Fail-closed) لأن هذه مسارات حساسة، بعكس المسارات العامة الأخرى.
        return res.status(500).json({ success: false, error: 'تعذر التحقق من صلاحية المشرف.' });
    }
}

// =========================================================================
// [نظام حد الطلبات/الأحداث لكل مستخدم]: افتراضياً "مفتوح" بدون أي حد.
// المشرف قادر على تحديد رقم أقصى (مثلاً 20) ونوع الفترة (يومي/أسبوعي/شهري)
// من لوحة إدارة المستخدمين. يتم فحص هذا الحد عند كل "طلب/حدث" (نقرة اتصال
// أو واتساب) قبل تسجيلها، عبر عمود "user_identifier" في جدول الإحصائيات
// الذي يخزن رقم المستخدم الحقيقي (user_id) عند تسجيل الدخول.
// =========================================================================
export async function checkUserRequestQuota(userId) {
    // بدون معرف مستخدم (زائر) => لا يوجد حد مطبق إطلاقاً
    if (!userId) {
        return { allowed: true, unlimited: true };
    }

    try {
        const userResult = await servicesPool.query(
            'SELECT request_limit, request_limit_period FROM public.users WHERE user_id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            // مستخدم غير مسجل بقاعدة البيانات (ضيف مثلاً) => بدون حد
            return { allowed: true, unlimited: true };
        }

        const { request_limit, request_limit_period } = userResult.rows[0];

        // الحد الافتراضي: مفتوح تماماً (بدون أي رقم محدد)
        if (!request_limit || request_limit <= 0) {
            return { allowed: true, unlimited: true };
        }

        const period = ['daily', 'weekly', 'monthly'].includes(request_limit_period) ? request_limit_period : 'daily';
        const intervalMap = { daily: '1 day', weekly: '7 days', monthly: '1 month' };
        const intervalSql = intervalMap[period];

        const countResult = await servicesPool.query(
            `SELECT COUNT(*) FROM "public"."map_service_stats"
             WHERE user_identifier = $1 AND request_date >= NOW() - INTERVAL '${intervalSql}'`,
            [String(userId)]
        );

        const used = parseInt(countResult.rows[0].count, 10) || 0;
        const remaining = Math.max(0, request_limit - used);

        return {
            allowed: used < request_limit,
            unlimited: false,
            limit: request_limit,
            period,
            used,
            remaining
        };
    } catch (err) {
        console.error('⚠️ خطأ أثناء فحص حد الطلبات، سيتم السماح بالطلب (Fail-open):', err.message);
        // في حال أي خطأ غير متوقع لا نمنع المستخدم من استخدام الخدمة الأساسية
        return { allowed: true, unlimited: true, error: true };
    }
}

// =========================================================================
// 🔒 كلمات المرور القديمة المحفوظة كنص صريح (قبل bcrypt) كانت تُشفَّر فقط عند أول دخول لصاحبها، فالحساب
// الخامل يبقى نصاً مقروءاً بالقاعدة. هنا تُشفَّر كلها مرة عند الإقلاع: bcrypt للنص المخزَّن نفسه، فيبقى
// الدخول بنفس كلمة المرور (verifyPasswordWithMigration يقارن بـ bcrypt). لا يُطبع أي قيمة، العدد فقط.
// =========================================================================
async function hashPlaintextPasswords() {
    try {
        const { rows } = await servicesPool.query(
            `SELECT user_id, password_hash FROM public.users
             WHERE password_hash IS NOT NULL AND password_hash <> '' AND password_hash !~ '^\\$2[aby]\\$[0-9]{2}\\$'`
        );
        let done = 0;
        for (const row of rows) {
            const hashed = await bcrypt.hash(row.password_hash, BCRYPT_SALT_ROUNDS);
            // الشرط على القيمة القديمة: لا نكتب فوق كلمة مرور تغيّرت أثناء التشغيل
            const res = await servicesPool.query(
                'UPDATE public.users SET password_hash = $1 WHERE user_id = $2 AND password_hash = $3',
                [hashed, row.user_id, row.password_hash]
            );
            done += res.rowCount;
        }
        if (rows.length) console.log(`🔒 شُفّرت ${done} كلمة مرور قديمة كانت محفوظة كنص صريح`);
    } catch (err) {
        console.error('⚠️ تعذر تشفير كلمات المرور القديمة:', err.message);
    }
}
hashPlaintextPasswords();
