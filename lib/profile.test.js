import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProfileEdit } from './profile.js';

const wa = (raw) => {
    let d = String(raw).replace(/\D/g, '');
    if (d.startsWith('0') && d.length === 10) d = '970' + d.substring(1);
    return d ? '+' + d : null;
};

test('keeps only the fields sent, cleaned', () => {
    assert.deepEqual(parseProfileEdit({ full_name: '  <b>سامي</b> ' }, wa), { value: { full_name: 'bسامي/b' } });
    assert.deepEqual(parseProfileEdit({ whatsapp_number: '0599123456' }, wa), { value: { whatsapp_number: '+970599123456' } });
    assert.deepEqual(parseProfileEdit({ email: ' A@B.ps ' }, wa), { value: { email: 'a@b.ps' } });
});

test('empty WhatsApp / email clear them; the name cannot be emptied', () => {
    assert.deepEqual(parseProfileEdit({ whatsapp_number: '', email: '' }, wa), { value: { whatsapp_number: null, email: '' } });
    assert.ok(parseProfileEdit({ full_name: '   ' }, wa).error);
});

test('refuses bad values and an empty edit', () => {
    assert.ok(parseProfileEdit({ email: 'not-an-email' }, wa).error);
    assert.ok(parseProfileEdit({ whatsapp_number: '12' }, wa).error);
    assert.ok(parseProfileEdit({ full_name: 'x'.repeat(101) }, wa).error);
    assert.ok(parseProfileEdit({ full_name: 5 }, wa).error);
    assert.ok(parseProfileEdit({}, wa).error);
    assert.ok(parseProfileEdit(null, wa).error);
    // the phone (the login) and the role are not editable here
    assert.ok(parseProfileEdit({ phone: '0599000000', role: 'admin' }, wa).error);
});
