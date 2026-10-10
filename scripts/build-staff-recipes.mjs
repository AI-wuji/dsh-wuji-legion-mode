// 从 delegation-manifest.json 生成 packages/wuji-staff/data/recipes.json
//
// 为什么需要这个脚本：
//   recipes.json 是参谋部 wuji_staff_select / wuji_staff_recipes 真正读取的表。
//   它此前是手写派生产物，改 manifest 后不会自动同步 —— 曾导致参谋部
//   继续返回已退役成员。生成器让它成为可复现的派生结果。
//
// 用法：node scripts/build-staff-recipes.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';

const MANIFEST = 'E:/wuji-projects/wuji-legion-codex-4.0/catalog/p3/delegation-manifest.json';
const OUT = new URL('../packages/wuji-staff/data/recipes.json', import.meta.url).pathname
  .replace(/^\//, '');

const CHECK = process.argv.includes('--check');

const mj = JSON.parse(readFileSync(MANIFEST, 'utf8'));

// 主帅族列表
const families = mj.leader_family_ids.map((id) => id.replace(/^lead\./, ''));

// 配方：把 manifest 的完整结构压成参谋部需要的扁平形状
const recipes = mj.recipes.map((r) => ({
  id: r.recipe_id,
  leader: r.leader.id,
  family: r.leader.family_id.replace(/^lead\./, ''),
  domains: r.domains ?? [],
  typed_intents: r.typed_intents ?? [],
  // 成员只留 id（参谋部不需要 path）
  members: (r.expert_refs ?? []).map((e) => e.role_id.split('/').pop()),
  // 必需成员单列，供「谁必须参与」判定
  required_members: (r.expert_refs ?? [])
    .filter((e) => e.selection?.required === true)
    .map((e) => e.role_id.split('/').pop()),
  acceptance: r.acceptance_defaults ?? [],
}));

const out = {
  source: 'wuji-legion-codex-4.0/catalog/p3/delegation-manifest.json',
  generated_by: 'scripts/build-staff-recipes.mjs',
  leader_families: families,
  recipes,
};

if (CHECK) {
  let cur = null;
  try { cur = JSON.parse(readFileSync(OUT, 'utf8')); } catch { /* 缺失即不同步 */ }
  const same = cur && JSON.stringify(cur.recipes) === JSON.stringify(out.recipes)
    && JSON.stringify(cur.leader_families) === JSON.stringify(out.leader_families);
  if (same) {
    console.log(`  ok   recipes.json 与 manifest 同步（${recipes.length} 条配方 / ${families.length} 族）`);
    process.exit(0);
  }
  console.error(`  FAIL recipes.json 与 manifest 不同步 —— 请运行 node scripts/build-staff-recipes.mjs`);
  console.error(`       期望：${recipes.length} 条配方 / ${families.length} 族`);
  console.error(`       实际：${cur ? `${cur.recipes?.length} 条配方 / ${cur.leader_families?.length} 族` : '文件缺失'}`);
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`  已写入 recipes.json：${recipes.length} 条配方 / ${families.length} 族`);

// 打印 comfyui 族供人工核对
const comfy = recipes.filter((r) => r.family === 'comfyui');
console.log('');
console.log(`  comfyui 族配方 ${comfy.length} 条：`);
for (const r of comfy) {
  console.log(`    ${r.id.padEnd(26)} 成员 ${r.members.length}（必需 ${r.required_members.length}）`);
  console.log(`      必需：${r.required_members.join('、') || '（无）'}`);
}
