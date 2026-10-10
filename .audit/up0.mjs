import fs from 'node:fs';
const P3 = 'E:\\wuji-projects\\wuji-legion-codex-4.0\\catalog\\p3';
const raw = JSON.parse(fs.readFileSync(P3 + '\\experts.json', 'utf8'));
console.log('top type:', Array.isArray(raw) ? 'array' : typeof raw);
if (!Array.isArray(raw)) console.log('top keys:', Object.keys(raw).slice(0, 30));
const list = Array.isArray(raw) ? raw : (raw.experts || raw.items || raw.roles || []);
console.log('count:', list.length);
console.log('sample keys:', Object.keys(list[0]));
console.log('sample[0]:', JSON.stringify(list[0], null, 2).slice(0, 2500));
