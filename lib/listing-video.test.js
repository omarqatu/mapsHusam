// node --test lib/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_VIDEO_BYTES, listingVideoCheck } from './listing-video.js';

const box = (type, ...parts) => {
    const body = Buffer.concat(parts);
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, 'ascii');
    return Buffer.concat([head, body]);
};
// mvhd version 0: version/flags, creation, modification, timescale, duration.
const mvhd = (seconds) => {
    const b = Buffer.alloc(20);
    b.writeUInt32BE(1000, 12);
    b.writeUInt32BE(seconds * 1000, 16);
    return box('mvhd', b);
};
// The brand is what tells a phone's MOV ("qt  ") from an MP4 ("isom"); the boxes are the same.
const clip = (brand, seconds) => Buffer.concat([
    box('ftyp', Buffer.from(`${brand}\0\0\0\0`, 'ascii')),
    box('mdat', Buffer.alloc(64)),
    box('moov', mvhd(seconds)),
]);

test('an MP4 and an iPhone MOV clip are both accepted, with their duration read from the file', () => {
    assert.deepEqual(listingVideoCheck(clip('isom', 10)), { type: 'mp4', duration: 10 });
    assert.deepEqual(listingVideoCheck(clip('qt  ', 10)), { type: 'mp4', duration: 10 });
});

test('too long, too large, empty or not a video is refused', () => {
    assert.equal(listingVideoCheck(clip('qt  ', 61)).error, 'too_long');
    assert.equal(listingVideoCheck(Buffer.alloc(MAX_VIDEO_BYTES + 1)).error, 'too_large');
    assert.equal(listingVideoCheck(Buffer.alloc(0)).error, 'empty');
    assert.equal(listingVideoCheck(Buffer.from('not a video at all, just text')).error, 'invalid_or_unsupported');
});
