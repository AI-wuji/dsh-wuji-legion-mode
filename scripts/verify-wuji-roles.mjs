// 校验生成的 73 个角色文件：格式统一、归属正确、DSH 能发现。
//
// 重点检查的是**真实可发现性**，不是文件内容好看：
//   dsh-skill-filesystem 的发现只有一层深，只认 <root>/<name>/SKILL.md。
//   任何嵌套目录都会让角色静默消失 —— 这是最容易犯且最难发现的错。
//
// 用法：node scripts/verify-wuji-roles.mjs

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = join(repo, 'skills');

let failed = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? `\n       ${detail}` : ''}`);
  if (!ok) failed += 1;
};

// ── 极简 frontmatter 解析（不引入 yaml 依赖）────────────────────────────
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

// ── 发现所有角色目录 ───────────────────────────────────────────────────
const entries = readdirSync(SKILLS).filter((e) => {
  const p = join(SKILLS, e);
  return statSync(p).isDirectory() && (e.startsWith('wuji-leader-') || e.startsWith('wuji-expert-'));
});

const leaders = entries.filter((e) => e.startsWith('wuji-leader-'));
const experts = entries.filter((e) => e.startsWith('wuji-expert-'));

console.log('角色技能文件校验');
console.log('');
console.log(`--- 发现性（DSH 的发现只有一层深）---`);
check(`主帅目录 ${leaders.length} 个`, leaders.length > 0);
check(`专家目录 ${experts.length} 个`, experts.length > 0);

// 每个必须在 <name>/SKILL.md，不能嵌套
let nested = 0;
let missingSkillMd = 0;
for (const dir of entries) {
  const skillMd = join(SKILLS, dir, 'SKILL.md');
  if (!existsSync(skillMd)) {
    missingSkillMd += 1;
    console.log(`       ${dir} 缺少 SKILL.md`);
  }
  // 检查是否有子目录（会造成发现落空或结构混乱）
  for (const sub of readdirSync(join(SKILLS, dir))) {
    if (statSync(join(SKILLS, dir, sub)).isDirectory()) {
      nested += 1;
      console.log(`       ${dir}/${sub} 是子目录 —— 角色文件不应嵌套`);
    }
  }
}
check('每个角色都在 <name>/SKILL.md', missingSkillMd === 0);
check('没有嵌套子目录', nested === 0);

// ── 格式统一性 ─────────────────────────────────────────────────────────
console.log('');
console.log('--- 格式统一性 ---');
const LEADER_REQUIRED = ['name', 'description', 'kind', 'family', 'source_family_id', 'leader_id', 'recipes'];
const EXPERT_REQUIRED = ['name', 'description', 'kind', 'role_kind', 'family', 'families', 'baseline_id', 'design_target', 'source_id'];

const problems = [];
const leaderFamilies = new Set();
const expertFamilies = new Map();

for (const dir of leaders) {
  const fm = parseFrontmatter(readFileSync(join(SKILLS, dir, 'SKILL.md'), 'utf8'));
  if (!fm) { problems.push(`${dir}: 无 frontmatter`); continue; }
  for (const f of LEADER_REQUIRED) if (!(f in fm)) problems.push(`${dir}: 缺字段 ${f}`);
  if (fm.kind !== 'leader') problems.push(`${dir}: kind 应为 leader，实为 ${fm.kind}`);
  if (fm.family !== dir.replace('wuji-leader-', '')) problems.push(`${dir}: family 与目录名不符`);
  leaderFamilies.add(fm.family);
}

for (const dir of experts) {
  const fm = parseFrontmatter(readFileSync(join(SKILLS, dir, 'SKILL.md'), 'utf8'));
  if (!fm) { problems.push(`${dir}: 无 frontmatter`); continue; }
  for (const f of EXPERT_REQUIRED) if (!(f in fm)) problems.push(`${dir}: 缺字段 ${f}`);
  if (fm.kind !== 'expert') problems.push(`${dir}: kind 应为 expert，实为 ${fm.kind}`);
  if (fm.baseline_id !== dir.replace('wuji-expert-', '')) problems.push(`${dir}: baseline_id 与目录名不符`);
  expertFamilies.set(dir, fm.family);
}

check('所有主帅字段完整且 kind 正确', !problems.some((p) => p.includes('wuji-leader')));
check('所有专家字段完整且 kind 正确', !problems.some((p) => p.includes('wuji-expert')));
if (problems.length) {
  console.log('       问题明细:');
  problems.slice(0, 12).forEach((p) => console.log(`         ${p}`));
}

// ── 归属正确性 ─────────────────────────────────────────────────────────
//
// 注意：上游确实存在**共享专家** —— 14 个专家被多个族引用
// （如 delivery-acceptance 被 4 个族共用，code-review 被 3 个族共用）。
// 这是 4.0「主帅按条件只引用必要的共享专家职责」的设计，不是数据错误。
// 因此校验的是「family 字段必须是 families 之一」，而不是「专家只属于一个主帅」。
console.log('');
console.log('--- 归属正确性 ---');
const orphans = [];
const sharedExperts = [];
for (const dir of experts) {
  const fm = parseFrontmatter(readFileSync(join(SKILLS, dir, 'SKILL.md'), 'utf8'));
  const fams = String(fm.families ?? '').replace(/[[\]]/g, '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!fams.length) { orphans.push(`${dir}: families 为空`); continue; }
  if (!fams.includes(fm.family)) {
    orphans.push(`${dir}: family=${fm.family} 不在 families=[${fams}] 中`);
  }
  for (const f of fams) {
    if (!leaderFamilies.has(f)) orphans.push(`${dir}: 引用了不存在的主帅 ${f}`);
  }
  if (fams.length > 1) sharedExperts.push(dir);
}
check('每个专家的 family 有效且引用存在的主帅', orphans.length === 0, orphans.slice(0, 8).join('\n       '));
check(`共享专家被正确标注（${sharedExperts.length} 个）`, sharedExperts.length > 0,
  '上游有 14 个跨族共享专家，一个都没标出来说明 families 字段没生成对');

// 反向：每个主帅都应有可引用成员。
// 计数以「本族配方 → 成员」为准，因为共享专家可能在别的族主属，但对本族仍可用。
console.log('');
const emptyLeaders = [];
for (const dir of leaders) {
  const text = readFileSync(join(SKILLS, dir, 'SKILL.md'), 'utf8');
  const members = text.match(/^    - `wuji-expert-[\w-]+`/gm) ?? [];
  if (members.length === 0) emptyLeaders.push(dir);
}
check('没有空主帅（每个主帅都有可引用成员）', emptyLeaders.length === 0, emptyLeaders.join(', '));

// ── 必填语义字段 ───────────────────────────────────────────────────────
// 章节名对应 docs/ROLE-FRAMEWORK.md 的框架映射表。
// 这批章节覆盖「职责 / 边界 / 输入 / 产出 / 权限」，缺任一即职责书不完整。
console.log('');
console.log('--- 必填语义字段 ---');
const REQUIRED_SECTIONS = [
  '## 我负责 / 我不负责',
  '## 输入契约（缺一即 BLOCKED）',
  '## 工作流程',
  '## 输出',
  '## 交付前自检清单（逐项打勾，不过不交）',
  '## 诚实标注',
];
let missingSections = 0;
for (const dir of entries) {
  const text = readFileSync(join(SKILLS, dir, 'SKILL.md'), 'utf8');
  for (const s of REQUIRED_SECTIONS) {
    if (!text.includes(s)) {
      missingSections += 1;
      console.log(`       ${dir} 缺章节 ${s}`);
    }
  }
}
check('所有角色含职责 / 输入 / 流程 / 输出 / 自检 / 诚实标注', missingSections === 0);

// 校验不再出现上游那四个恒为 false 的字段
const FORBIDDEN = ['runtime_admission', 'cold_reason', 'active_release'];
let forbiddenHits = 0;
for (const dir of entries) {
  const text = readFileSync(join(SKILLS, dir, 'SKILL.md'), 'utf8');
  for (const f of FORBIDDEN) {
    if (new RegExp(`^${f}:`, 'm').test(text)) {
      forbiddenHits += 1;
      console.log(`       ${dir} 仍含上游失效字段 ${f}`);
    }
  }
}
check('未搬入上游恒为 false 的运行时字段', forbiddenHits === 0);

// ── 参谋部可用性：family / domains 能被选择器读到 ──────────────────────
// domains / typed_intents 来自 delegation-manifest.json 的配方字段（各 21 条），
// 不在 experts.json 里 —— 故必须从生成物正文实际读出，不能只信 frontmatter。
console.log('');
console.log('--- 参谋部可用性 ---');
const withDomains = [...expertFamilies.keys()].filter((d) => {
  const text = readFileSync(join(SKILLS, d, 'SKILL.md'), 'utf8');
  return /在团队中的职责[\s\S]{0,400}?配方 `/.test(text);
});
check('每个专家都声明了配方归属（参谋部匹配依据）', withDomains.length === expertFamilies.size,
  `仅 ${withDomains.length}/${expertFamilies.size} 个有配方归属`);

console.log('');
console.log(`统计：主帅 ${leaders.length}，专家 ${experts.length}，主帅族 ${leaderFamilies.size}`);
console.log('');
if (failed) {
  console.error(`角色校验失败（${failed} 项）`);
  process.exit(1);
}
console.log('角色校验通过：格式统一、归属正确、DSH 可发现。');
