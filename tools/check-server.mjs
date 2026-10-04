// Checks the backend without starting it (no database, no network): every file under server/ parses, and every import
// between them names an export that exists. Run by CI and the deploy job: `npm run check:server`.
// Needs `node --experimental-vm-modules` (the npm script passes it).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = new Map();

function load(file) {
  if (!modules.has(file)) {
    modules.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { identifier: file }));
  }
  return modules.get(file);
}

async function linker(specifier, referencing) {
  if (specifier.startsWith('.')) {
    const file = path.resolve(path.dirname(referencing.identifier), specifier);
    if (!fs.existsSync(file)) throw new Error(`${referencing.identifier}: no such file ${specifier}`);
    return load(file);
  }
  // A package: import it for real (packages do nothing on import) and expose the same names.
  const ns = await import(specifier);
  const names = Object.keys(ns);
  return new vm.SyntheticModule(names, function () {
    for (const name of names) this.setExport(name, ns[name]);
  }, { identifier: specifier });
}

const entry = load(path.join(ROOT, 'server.js'));
await entry.link(linker);
const files = [...modules.keys()].map((f) => path.relative(ROOT, f));
const onDisk = fs.readdirSync(path.join(ROOT, 'server'), { recursive: true })
  .filter((f) => f.endsWith('.js'))
  .map((f) => path.join('server', f));
const unused = onDisk.filter((f) => !files.includes(f));
if (unused.length) throw new Error(`not imported by server.js: ${unused.join(', ')}`);
console.log(`backend OK: ${files.length} files, all imports resolve (${pathToFileURL(ROOT).pathname})`);
