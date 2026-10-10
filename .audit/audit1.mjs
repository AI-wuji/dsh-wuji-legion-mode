import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const dirs = fs.readdirSync(ROOT).filter(d =>
  (d.startsWith('wuji-expert-') || d.startsWith('wuji-leader-')) &&
  fs.statSync(path.join(ROOT, d)).isDirectory()
).sort();

const experts = dirs.filter(d => d.startsWith('wuji-expert-'));
const leaders = dirs.filter(d => d.startsWith('wuji-leader-'));

const out = { expertCount: experts.length, leaderCount: leaders.length, total: dirs.length };

// 1) framework claims: byte sizes
const sizes = {};
for (const d of dirs) {
  const p = path.join(ROOT, d, 'SKILL.md');
  sizes[d] = fs.statSync(p).size;
}
const expertSizes = experts.map(d => sizes[d]);
const leaderSizes = leaders.map(d => sizes[d]);
out.expertSizeMin = Math.min(...expertSizes);
out.expertSizeMax = Math.max(...expertSizes);
out.leaderSizeMin = Math.min(...leaderSizes);
out.leaderSizeMax = Math.max(...leaderSizes);
out.expertSizes = Object.fromEntries(experts.map(d => [d, sizes[d]]));
out.leaderSizes = Object.fromEntries(leaders.map(d => [d, sizes[d]]));

// 2) section inventory
function sections(text) {
  const lines = text.split(/\r?\n/);
  const secs = [];
  lines.forEach((l, i) => {
    const m = /^(#{1,4})\s+(.*)$/.exec(l);
    if (m) secs.push({ level: m[1].length, title: m[2].trim(), line: i + 1 });
  });
  return secs;
}

const sectionMap = {};
const sample = {};
for (const d of dirs) {
  const text = fs.readFileSync(path.join(ROOT, d, 'SKILL.md'), 'utf8');
  sectionMap[d] = sections(text).map(s => `${'#'.repeat(s.level)} ${s.title}`);
}
// unique expert section signature
const expertSigs = {};
for (const d of experts) {
  const k = sectionMap[d].join(' | ');
  (expertSigs[k] ||= []).push(d);
}
out.expertSignatureGroups = expertSigs;
out.expertSignatureCount = Object.keys(expertSigs).length;

const leaderSigs = {};
for (const d of leaders) {
  const k = sectionMap[d].join(' | ');
  (leaderSigs[k] ||= []).push(d);
}
out.leaderSignatureGroups = leaderSigs;
out.leaderSignatureCount = Object.keys(leaderSigs).length;

fs.writeFileSync('E:\\wuji-projects\\dsh-wuji-legion-mode\\.audit\\out1.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  expertCount: out.expertCount, leaderCount: out.leaderCount,
  expertSizeMin: out.expertSizeMin, expertSizeMax: out.expertSizeMax,
  leaderSizeMin: out.leaderSizeMin, leaderSizeMax: out.leaderSizeMax,
  expertSignatureCount: out.expertSignatureCount,
  leaderSignatureCount: out.leaderSignatureCount,
}, null, 2));
