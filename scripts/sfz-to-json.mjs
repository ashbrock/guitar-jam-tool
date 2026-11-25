// Converts an SFZ instrument mapping into the app's instrument JSON (dev tool, run by hand).
// Usage: node scripts/sfz-to-json.mjs <file.sfz> <out.json> <name> <ext>
// Supports the subset used by our sample sets: <group> lovel/hivel and <region> lokey/hikey/
// pitch_keycenter/tune/volume/sample. Other opcodes are ignored.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , src, out, name, ext = 'm4a'] = process.argv;
if (!src || !out || !name) {
  console.error('Usage: node scripts/sfz-to-json.mjs <file.sfz> <out.json> <name> [ext]');
  process.exit(1);
}
const text = readFileSync(src, 'utf8')
  .split('\n')
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n');

const layers = [];
let group = null;
for (const m of text.matchAll(/<(group|region)>([^<]*)/g)) {
  const [, tag, body] = m;
  const op = {};
  for (const kv of body.matchAll(/(\w+)=([^\s]+)/g)) op[kv[1]] = kv[2];
  if (tag === 'group') {
    group = { lovel: Number(op.lovel ?? 1), hivel: Number(op.hivel ?? 127), regions: [] };
    layers.push(group);
  } else if (group) {
    group.regions.push({
      lokey: Number(op.lokey),
      hikey: Number(op.hikey),
      center: Number(op.pitch_keycenter),
      tune: Number(op.tune ?? 0),
      volume: Number(op.volume ?? 0),
      file: op.sample.replace('.$EXT', `.${ext}`),
    });
  }
}
const files = [...new Set(layers.flatMap((l) => l.regions.map((r) => r.file)))].sort();
writeFileSync(out, JSON.stringify({ name, files, layers }, null, 2) + '\n');
console.log(`${name}: ${layers.length} velocity layers, ${files.length} files`);
