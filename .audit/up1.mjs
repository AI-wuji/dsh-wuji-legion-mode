import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'E:\\wuji-projects\\dsh-wuji-legion-mode\\skills';
const P3 = 'E:\\wuji-projects\\wuji-legion-codex-4.0\\catalog\\p3';

const up = JSON.parse(fs.readFileSync(P3 + '\\experts.json', 'utf8'));
const roles = up.roles;
console.log('roles:', roles.length, 'role_count field:', up.role_count);

// five_elements may be string in some entries
function fe(r) {
  let v = r.five_elements;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* keep */ } }
  return v || {};
}
const kinds = {};
roles.forEach(r => kinds[r.kind] = (kinds[r.kind] || 0) + 1);
console.log('kinds:', kinds);

// field value diversity
const fields = ['goal', 'inputs', 'output', 'acceptance', 'process'];
const div = {};
for (const f of fields) {
  const set = new Set(roles.map(r => JSON.stringify(fe(r)[f])));
  div[f] = set.size;
}
div.anti_trigger = new Set(roles.map(r => r.anti_trigger)).size;
div.scope_rule = new Set(roles.map(r => r.scope_rule)).size;
div.cancellation = new Set(roles.map(r => r.cancellation)).size;
div.owner_rule = new Set(roles.map(r => r.owner_rule)).size;
console.log('value diversity (of 57):', div);

// map baseline_id -> role
const byBaseline = {};
roles.forEach(r => { if (r.baseline_id) byBaseline[r.baseline_id] = r; });
const byId = {};
roles.forEach(r => byId[r.id] = r);

// local dirs
const experts = fs.readdirSync(ROOT).filter(d => d.startsWith('wuji-expert-') &&
  fs.statSync(path.join(ROOT, d)).isDirectory()).sort();

console.log('\nexperts on disk:', experts.length);

// for each expert, extract sections
function getSection(text, titleRe) {
  const lines = text.split(/\r?\n/);
  let start = -1, end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]) && titleRe.test(lines[i])) { start = i; continue; }
    if (start >= 0 && i > start && /^##\s+/.test(lines[i])) { end = i; break; }
  }
  if (start < 0) return null;
  return { lines, start, end, text: lines.slice(start, end).join('\n') };
}

const report = [];
for (const d of experts) {
  const p = path.join(ROOT, d, 'SKILL.md');
  const text = fs.readFileSync(p, 'utf8');
  const baseId = d.replace('wuji-expert-', '');
  const r = byBaseline[baseId];
  const sec = (re) => getSection(text, re);
  const secResp = sec(/^##\s+我负责\s*\/\s*我不负责/);
  const secIn = sec(/^##\s+输入契约/);
  const secOut = sec(/^##\s+输出\s*$/);
  const secCon = sec(/^##\s+约束/);

  report.push({
    dir: d, baseId,
    upstreamFound: !!r,
    upGoal: r ? fe(r).goal : null,
    upInputs: r ? fe(r).inputs : null,
    upOutput: r ? fe(r).output : null,
    upAcceptance: r ? fe(r).acceptance : null,
    upAnti: r ? r.anti_trigger : null,
    localResp: secResp ? secResp.text : null,
    localInput: secIn ? secIn.text : null,
    localOutput: secOut ? secOut.text : null,
    localConstraint: secCon ? secCon.text : null,
    respLine: secResp ? secResp.start + 1 : null,
    inLine: secIn ? secIn.start + 1 : null,
    outLine: secOut ? secOut.start + 1 : null,
  });
}
fs.writeFileSync('E:\\wuji-projects\\dsh-wuji-legion-mode\\.audit\\report.json', JSON.stringify(report, null, 2));

// quick check: how many upstream not found
const notFound = report.filter(r => !r.upstreamFound).map(r => r.dir);
console.log('local experts with NO upstream baseline_id match:', notFound.length, notFound);

// check goal appears verbatim in 我负责 section
let respOk = 0, respBad = [];
let inOk = 0, inBad = [];
let outOk = 0, outBad = [];
let antiOk = 0, antiBad = [];
for (const r of report) {
  if (!r.upstreamFound) continue;
  const g = (r.upGoal || '').trim();
  if (r.localResp && r.localResp.includes(g)) respOk++; else respBad.push({ dir: r.dir, upGoal: g, local: (r.localResp||'').replace(/\s+/g, ' ').slice(0, 260) });
  const i = (r.upInputs || '').trim();
  if (r.localInput && r.localInput.includes(i)) inOk++; else inBad.push({ dir: r.dir, upInputs: i, local: (r.localInput||'').replace(/\s+/g, ' ').slice(0, 300) });
  const o = (r.upOutput || '').trim();
  if (r.localOutput && r.localOutput.includes(o)) outOk++; else outBad.push({ dir: r.dir, upOutput: o, local: (r.localOutput||'').replace(/\s+/g, ' ').slice(0, 300) });
  const a = (r.upAnti || '').trim();
  if (r.localResp && r.localResp.includes(a)) antiOk++; else antiBad.push({ dir: r.dir, upAnti: a, local: (r.localResp||'').replace(/\s+/g, ' ').slice(0, 300) });
}
console.log('\n[goal verbatim in 我负责]', respOk, '/ 57  mismatches:', respBad.length);
console.log('[inputs verbatim in 输入契约]', inOk, '/ 57  mismatches:', inBad.length);
console.log('[output verbatim in 输出]', outOk, '/ 57  mismatches:', outBad.length);
console.log('[anti_trigger verbatim in 我负责]', antiOk, '/ 57  mismatches:', antiBad.length);

fs.writeFileSync('E:\\wuji-projects\\dsh-wuji-legion-mode\\.audit\\mismatch.json', JSON.stringify({ respBad, inBad, outBad, antiBad }, null, 2));
console.log('\n--- goal mismatches ---');
console.log(JSON.stringify(respBad, null, 2).slice(0, 4000));
