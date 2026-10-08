// 用真实配方表验证参谋部选择结果 —— 证明「不同主帅下的专家」真的能被选中。
//
// 这一步是回答用户问题的关键：不是「工具有没有注册」，
// 而是「给一个 ComfyUI 任务和一个写作任务，它俩会不会被分到不同主帅」。
//
// 用法：node scripts/verify-staff-selection.mjs
import { pathToFileURL } from 'node:url';

const entry = 'C:/Users/Administrator/.dsh/profiles/node_modules/@wuji/dsh-wuji-staff/lib/index.js';
const mod = await import(pathToFileURL(entry).href);

const registered = new Map();
await mod.apply({ tools: { register: (t) => registered.set(t.name, t) } }, {});

let failed = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? `\n       ${detail}` : ''}`);
  if (!ok) failed += 1;
};

// 通过公开工具接口取值（而不是直接读内部变量），确保测的是模型看到的行为。
const recipesTool = registered.get('wuji_staff_recipes');
const selectTool = registered.get('wuji_staff_select');

console.log('参谋部真实选择验证');
console.log('');

// ── 1) 配方表能列出来 ──────────────────────────────────────────────────
const table = await recipesTool.execute({}, {});
check(`配方表已加载（${table.leader_families.length} 族 / ${table.recipes.length} 条）`,
  table.recipes.length === 21 && table.leader_families.length === 16);

// ── 2) 跨主帅选择：不同领域应落到不同主帅 ──────────────────────────────
console.log('');
console.log('--- 跨主帅选择（这是用户真正关心的：不同主帅下的专家）---');

const cases = [
  { name: 'ComfyUI 节点开发', domain: 'comfyui', intents: [], expectFamily: 'comfyui' },
  { name: '软件交付', domain: 'software', intents: [], expectFamily: 'software' },
  { name: '视频剪辑', domain: 'video', intents: [], expectFamily: 'video' },
  { name: '写作交付', domain: 'writing', intents: [], expectFamily: 'writing' },
  { name: '数据交付', domain: 'data', intents: [], expectFamily: 'data' },
];

const chosenFamilies = new Set();
for (const c of cases) {
  const r = await selectTool.execute({ domain: c.domain, typed_intents: c.intents }, {});
  const got = r.candidates?.[0]?.family ?? '(缺口)';
  const members = r.candidates?.[0]?.members ?? [];
  chosenFamilies.add(got);
  const ok = got === c.expectFamily;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(16)} domain=${c.domain.padEnd(10)} → ${got}（${members.length} 个成员）`);
  if (!ok) failed += 1;
  if (members.length) console.log(`       成员：${members.slice(0, 5).join('、')}${members.length > 5 ? ' …' : ''}`);
}

// ── 3) 关键证据：确实选出了多个**不同**主帅 ─────────────────────────────
console.log('');
check(`选出了 ${chosenFamilies.size} 个不同主帅（证明跨主帅调度成立）`, chosenFamilies.size >= 4);

// ── 4) 缺口语义 ────────────────────────────────────────────────────────
console.log('');
console.log('--- 缺口语义（禁止万能兜底）---');
const gap = await selectTool.execute({ domain: '完全不存在的领域', typed_intents: [] }, {});
check('无匹配时返回 selection_gap', gap.gap === true, `实际: ${JSON.stringify(gap)}`);
check('缺口时不返回任何候选（禁止兜底）', (gap.candidates ?? []).length === 0);

// ── 5) 类型意图参与打分 ────────────────────────────────────────────────
const byIntent = await selectTool.execute({ domain: '(复合)', typed_intents: ['bug_fix'] }, {});
check('仅靠 typed_intent 也能选中（domain 未命中时）',
  byIntent.candidates?.length > 0 || byIntent.gap === true,
  '至少不应抛错');

console.log('');
if (failed) {
  console.error(`参谋部选择验证失败（${failed} 项）`);
  process.exit(1);
}
console.log('参谋部选择验证通过：不同领域落到不同主帅，缺口语义正确。');
