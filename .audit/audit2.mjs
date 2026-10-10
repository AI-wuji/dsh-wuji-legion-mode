import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const dirs = fs.readdirSync(ROOT).filter(d =>
  (d.startsWith('wuji-expert-') || d.startsWith('wuji-leader-')) &&
  fs.statSync(path.join(ROOT, d)).isDirectory()).sort();
const experts = dirs.filter(d => d.startsWith('wuji-expert-'));
const leaders = dirs.filter(d => d.startsWith('wuji-leader-'));

// body size = after closing frontmatter
function split(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { fm: '', body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}
const rows = [];
for (const d of dirs) {
  const text = fs.readFileSync(path.join(ROOT, d, 'SKILL.md'), 'utf8');
  const { fm, body } = split(text);
  rows.push({ d, total: Buffer.byteLength(text), fmB: Buffer.byteLength(fm), bodyB: Buffer.byteLength(body) });
}
const ex = rows.filter(r => r.d.startsWith('wuji-expert-'));
const le = rows.filter(r => r.d.startsWith('wuji-leader-'));
console.log('expert body bytes:', Math.min(...ex.map(r => r.bodyB)), '-', Math.max(...ex.map(r => r.bodyB)));
console.log('expert total bytes:', Math.min(...ex.map(r => r.total)), '-', Math.max(...ex.map(r => r.total)));
console.log('leader body bytes:', Math.min(...le.map(r => r.bodyB)), '-', Math.max(...le.map(r => r.bodyB)));
console.log('leader total bytes:', Math.min(...le.map(r => r.total)), '-', Math.max(...le.map(r => r.total)));

// exact section titles across experts
const expertTitles = new Map();
const leaderTitles = new Map();
for (const d of dirs) {
  const text = fs.readFileSync(path.join(ROOT, d, 'SKILL.md'), 'utf8');
  const t = split(text).body;
  const map = d.startsWith('wuji-expert-') ? expertTitles : leaderTitles;
  for (const m of t.matchAll(/^(#{2,3})\s+(.+)$/gm)) {
    const k = `${m[1]} ${m[2].trim()}`;
    map.set(k, (map.get(k) || 0) + 1);
  }
}
console.log('\n=== EXPERT H2/H3 titles (count/' + experts.length + ') ===');
[...expertTitles.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(3), k));
console.log('\n=== LEADER H2/H3 titles (count/' + leaders.length + ') ===');
[...leaderTitles.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(3), k));
