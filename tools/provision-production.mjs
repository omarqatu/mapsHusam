// One-time encrypted transport of operator-provided .env data to the Windows runner.
// The private key and plaintext configuration never leave the production host.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

const [mode, directory, deployPath] = process.argv.slice(2);
try {
    const privatePath = path.join(directory, 'deployment-private.pem');
    if (mode === 'key') {
        if (!fs.existsSync(privatePath)) {
            const pair = crypto.generateKeyPairSync('rsa', {
                modulusLength: 4096,
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
                publicKeyEncoding: { type: 'spki', format: 'pem' },
            });
            fs.writeFileSync(privatePath, pair.privateKey, { flag: 'wx', mode: 0o600 });
        }
        const publicKey = crypto.createPublicKey(fs.readFileSync(privatePath)).export({ type: 'spki', format: 'pem' });
        console.log(`PUBLIC_KEY_BASE64=${Buffer.from(publicKey).toString('base64')}`);
    } else if (mode === 'apply') {
        const envelope = JSON.parse(process.env.PROVISIONING_PAYLOAD || '{}');
        const key = crypto.privateDecrypt({
            key: fs.readFileSync(privatePath), oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        }, Buffer.from(envelope.key, 'base64'));
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
        const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
        const values = dotenv.parse(plaintext);
        for (const name of ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'GEOSERVER_TARGET', 'JWT_SECRET']) {
            if (!values[name]) throw new Error(`Provided configuration is missing ${name}.`);
        }
        if (values.JWT_SECRET.length < 32) throw new Error('JWT_SECRET is too short.');
        const filename = path.join(deployPath, '.env');
        const previous = path.join(directory, 'env-before-provisioning');
        if (fs.existsSync(filename)) fs.copyFileSync(filename, previous);
        else fs.rmSync(previous, { force: true });
        // Write atomically and keep a private local copy for updating the service environment without logging it.
        const staged = path.join(deployPath, '.env.provisioning');
        fs.writeFileSync(staged, plaintext, { mode: 0o600 });
        fs.renameSync(staged, filename);
        fs.writeFileSync(path.join(directory, 'service-values.json'), JSON.stringify(values), { mode: 0o600 });
        console.log('Production configuration decrypted and installed locally.');
    } else {
        throw new Error('Expected key or apply mode.');
    }
} catch (error) {
    // Cryptography/JSON errors carry no plaintext; never print the envelope or parsed environment.
    console.error(error.message);
    process.exitCode = 1;
}
