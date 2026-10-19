import limits from '../shared/listing-video-limits.json' with { type: 'json' };

/** Upload limits for a listing video: a short clip, small enough to load sensibly on mobile networks. */
export const MAX_VIDEO_BYTES = limits.maxBytes;
export const MAX_VIDEO_SECONDS = limits.maxSeconds;
export const MAX_VIDEO_COUNT = limits.maxCount;

const mp4Box = (buf, offset, end) => {
    if (offset + 8 > end) return null;
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
        if (offset + 16 > end) return null;
        const extended = buf.readBigUInt64BE(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        size = Number(extended);
        header = 16;
    } else if (size === 0) size = end - offset;
    if (size < header || offset + size > end) return null;
    return { type, start: offset, data: offset + header, end: offset + size, next: offset + size };
};

function mp4Duration(buf) {
    let moov = null;
    for (let offset = 0; offset < buf.length;) {
        const box = mp4Box(buf, offset, buf.length);
        if (!box) return null;
        if (box.type === 'moov') { moov = box; break; }
        offset = box.next;
    }
    if (!moov) return null;
    for (let offset = moov.data; offset < moov.end;) {
        const box = mp4Box(buf, offset, moov.end);
        if (!box) return null;
        if (box.type === 'mvhd') {
            if (box.data + 20 > box.end) return null;
            const version = buf[box.data];
            const scaleOffset = box.data + (version === 1 ? 20 : 12);
            const durationOffset = box.data + (version === 1 ? 24 : 16);
            if (scaleOffset + 4 > box.end) return null;
            const timescale = buf.readUInt32BE(scaleOffset);
            if (!timescale) return null;
            let duration;
            if (version === 1) {
                if (durationOffset + 8 > box.end) return null;
                const raw = buf.readBigUInt64BE(durationOffset);
                if (raw === 0xffffffffffffffffn) return null;
                duration = Number(raw);
            } else {
                if (durationOffset + 4 > box.end) return null;
                duration = buf.readUInt32BE(durationOffset);
                if (duration === 0xffffffff) return null;
            }
            return duration / timescale;
        }
        offset = box.next;
    }
    return null;
}

/** Read an EBML variable integer. IDs retain their marker; sizes omit it. */
function ebmlVint(buf, offset, id = false) {
    if (offset >= buf.length || buf[offset] === 0) return null;
    let mask = 0x80;
    let length = 1;
    while (length <= 8 && !(buf[offset] & mask)) { mask >>= 1; length += 1; }
    if (length > 8 || offset + length > buf.length) return null;
    let value = id ? buf[offset] : buf[offset] & (mask - 1);
    for (let i = 1; i < length; i++) value = value * 256 + buf[offset + i];
    return { value, length };
}

function ebmlDuration(buf) {
    let segment = null;
    for (let offset = 0; offset < buf.length;) {
        const id = ebmlVint(buf, offset, true);
        if (!id) return null;
        const size = ebmlVint(buf, offset + id.length);
        if (!size) return null;
        const data = offset + id.length + size.length;
        const unknown = size.value === (2 ** (7 * size.length) - 1);
        const end = unknown ? buf.length : data + size.value;
        if (end > buf.length) return null;
        if (id.value === 0x18538067) { segment = { data, end }; break; }
        offset = end;
    }
    if (!segment) return null;
    let scale = 1_000_000;
    let duration = null;
    for (let offset = segment.data; offset < segment.end;) {
        const id = ebmlVint(buf, offset, true);
        if (!id) return null;
        const size = ebmlVint(buf, offset + id.length);
        if (!size) return null;
        const data = offset + id.length + size.length;
        const unknown = size.value === (2 ** (7 * size.length) - 1);
        const end = unknown ? segment.end : data + size.value;
        if (end > segment.end) return null;
        if (id.value === 0x1549a966) {
            for (let child = data; child < end;) {
                const childId = ebmlVint(buf, child, true);
                if (!childId) return null;
                const childSize = ebmlVint(buf, child + childId.length);
                if (!childSize) return null;
                const childData = child + childId.length + childSize.length;
                const childEnd = childData + childSize.value;
                if (childEnd > end) return null;
                if (childId.value === 0x2ad7b1 && childSize.value > 0 && childSize.value <= 8) {
                    scale = 0;
                    for (let i = 0; i < childSize.value; i++) scale = scale * 256 + buf[childData + i];
                }
                if (childId.value === 0x4489) {
                    if (childSize.value === 4) duration = buf.readFloatBE(childData);
                    else if (childSize.value === 8) duration = buf.readDoubleBE(childData);
                }
                child = childEnd;
            }
            break;
        }
        offset = end;
    }
    return Number.isFinite(duration) && scale > 0 ? duration * scale / 1_000_000_000 : null;
}

/** Detect a supported container from bytes; never trust the submitted file name or MIME header. */
export function videoType(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 16) return null;
    if (limits.types.includes('mp4') && buf.toString('ascii', 4, 8) === 'ftyp' && mp4Duration(buf) !== null) return 'mp4';
    if (buf.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
        limits.types.includes('webm') && buf.indexOf('webm', 0, 'ascii') !== -1 && ebmlDuration(buf) !== null) return 'webm';
    return null;
}

export function listingVideoCheck(buf) {
    if (!Buffer.isBuffer(buf) || buf.length === 0) return { error: 'empty' };
    if (buf.length > MAX_VIDEO_BYTES) return { error: 'too_large' };
    const type = videoType(buf);
    if (!type) return { error: 'invalid_or_unsupported' };
    const duration = type === 'mp4' ? mp4Duration(buf) : ebmlDuration(buf);
    if (!Number.isFinite(duration) || duration <= 0) return { error: 'invalid_or_unsupported' };
    if (duration > MAX_VIDEO_SECONDS) return { error: 'too_long' };
    return { type, duration };
}

export const VIDEO_MIME = { mp4: 'video/mp4', webm: 'video/webm' };
export const videoUrl = (id, type) => `/api/listing-videos/${id}.${type}`;
export function videoIdFromUrl(url) {
    const m = /^\/api\/listing-videos\/([a-f0-9-]{36})\.(mp4|webm)$/.exec(String(url || '').trim());
    return m ? m[1] : null;
}
