// 参谋部确定性核心的单元测试。
//
// 覆盖的 5 项语义此前已在真实 workflow 里验证过一次；这里固化成回归测试，
// 防止后续改动破坏它们。
//
// 用法：node packages/wuji-staff/staff-core.test.js
import assert from 'node:assert/strict';
import {
  canonicalRoot,
  writeRootsConflict,
  planSchedule,
  scoreRecipes,
  selectRecipe,
} from './staff-core.js';

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    process.exitCode = 1;
  }
};

console.log('参谋部 staff-core 测试');

// ── 写集冲突 ────────────────────────────────────────────────────────────────
test('相同路径冲突', () => {
  assert.equal(writeRootsConflict(['out/a'], ['out/a']), true);
});

test('目录包含关系算冲突（父 vs 子）', () => {
  assert.equal(writeRootsConflict(['out/analysis'], ['out/analysis/sub']), true);
});

test('目录包含关系算冲突（子 vs 父，方向对称）', () => {
  assert.equal(writeRootsConflict(['out/analysis/sub'], ['out/analysis']), true);
});

test('同前缀但不同目录不冲突', () => {
  assert.equal(writeRootsConflict(['out/analysis'], ['out/analysis2']), false);
});

test('分割符与大小写差异不影响判定', () => {
  assert.equal(writeRootsConflict(['Out\\Analysis'], ['out/analysis/sub']), true);
});

test('canonicalRoot 去尾斜杠', () => {
  assert.equal(canonicalRoot('out/a/'), canonicalRoot('out/a'));
});

// ── 调度计划 ────────────────────────────────────────────────────────────────
const baseSubtasks = [
  { subtask_id: 'A-analysis', goal: 'a', domain: 'software', depends_on: [], write_roots: ['out/analysis'] },
  { subtask_id: 'B-report', goal: 'b', domain: 'writing', depends_on: ['A-analysis'], write_roots: ['out/report'] },
  { subtask_id: 'C-doc', goal: 'c', domain: 'writing', depends_on: [], write_roots: ['out/analysis/sub'] },
  { subtask_id: 'D-expert', goal: 'd', domain: 'unknown-domain', depends_on: [], write_roots: ['out/d'] },
  { subtask_id: 'E-free', goal: 'e', domain: 'software', depends_on: [], write_roots: ['out/e'] },
];

const groupOf = (plan, id) => plan.groups.findIndex((g) => g.includes(id));
const sameGroup = (plan, a, b) => plan.groups.some((g) => g.includes(a) && g.includes(b));

const plan = planSchedule(baseSubtasks, { gapIds: ['D-expert'], parallelCap: 3 });

test('计划生成成功', () => {
  assert.equal(plan.ok, true);
});

test('A 与 C 写集冲突，不同组', () => {
  assert.equal(sameGroup(plan, 'A-analysis', 'C-doc'), false);
});

test('B 依赖 A，排在 A 之后', () => {
  assert.ok(groupOf(plan, 'B-report') > groupOf(plan, 'A-analysis'));
});

test('A 与 E 无冲突，可同组', () => {
  assert.equal(sameGroup(plan, 'A-analysis', 'E-free'), true);
});

test('D 是缺口，被阻塞', () => {
  assert.deepEqual(plan.blocked_branches['D-expert'], ['D-expert']);
});

test('缺口未拖累其他分支（4 个非缺口全部进组）', () => {
  const scheduled = plan.groups.flat();
  assert.equal(scheduled.length, 4);
  assert.ok(!scheduled.includes('D-expert'));
});

test('缺口沿依赖传播到后继', () => {
  const withDep = [
    ...baseSubtasks.filter((s) => s.subtask_id !== 'B-report'),
    { subtask_id: 'B-report', goal: 'b', domain: 'writing', depends_on: ['D-expert'], write_roots: ['out/report'] },
  ];
  const p = planSchedule(withDep, { gapIds: ['D-expert'], parallelCap: 3 });
  assert.deepEqual(p.blocked_branches['B-report'], ['D-expert']);
});

test('计划带 construction_only 标注（不冒充已执行）', () => {
  assert.equal(plan.construction_only, true);
  assert.equal(plan.native_execution_observed, false);
});

test('同名输入产出同一计划（可复现）', () => {
  const again = planSchedule(baseSubtasks, { gapIds: ['D-expert'], parallelCap: 3 });
  assert.deepEqual(again.groups, plan.groups);
});

test('依赖成环时明确报错', () => {
  const cyclic = [
    { subtask_id: 'X', goal: 'x', domain: 'd', depends_on: ['Y'], write_roots: [] },
    { subtask_id: 'Y', goal: 'y', domain: 'd', depends_on: ['X'], write_roots: [] },
  ];
  const p = planSchedule(cyclic, {});
  assert.equal(p.ok, false);
  assert.equal(p.error, 'DEPENDENCY_CYCLE');
});

test('依赖不存在的子任务时明确报错', () => {
  const bad = [{ subtask_id: 'X', goal: 'x', domain: 'd', depends_on: ['nope'], write_roots: [] }];
  const p = planSchedule(bad, {});
  assert.equal(p.ok, false);
  assert.equal(p.error, 'UNKNOWN_DEPENDENCY');
});

test('subtask_id 重复时明确报错', () => {
  const dup = [
    { subtask_id: 'X', goal: 'x', domain: 'd', write_roots: [] },
    { subtask_id: 'X', goal: 'x2', domain: 'd', write_roots: [] },
  ];
  const p = planSchedule(dup, {});
  assert.equal(p.ok, false);
  assert.equal(p.error, 'DUPLICATE_SUBTASK_ID');
});

test('缺必填字段时明确报错', () => {
  const p = planSchedule([{ subtask_id: 'X' }], {});
  assert.equal(p.ok, false);
  assert.equal(p.error, 'INVALID_SUBTASK');
});

test('并发上限被夹在 1..3', () => {
  assert.equal(planSchedule(baseSubtasks, { parallelCap: 99 }).parallel_cap, 3);
  assert.equal(planSchedule(baseSubtasks, { parallelCap: 0 }).parallel_cap, 2); // 0 视为未提供
});

// ── 选择与缺口 ──────────────────────────────────────────────────────────────
const recipes = [
  { id: 'r-eng', domains: ['software'], typed_intents: ['implement', 'review'] },
  { id: 'r-write', domains: ['writing'], typed_intents: ['draft'] },
  { id: 'r-dup-a', domains: ['data'], typed_intents: [] },
  { id: 'r-dup-b', domains: ['data'], typed_intents: [] },
];

test('领域命中得 3 分', () => {
  const { bestScore } = scoreRecipes(recipes, { domain: 'software', typed_intents: [] });
  assert.equal(bestScore, 3);
});

test('领域 3 分 + 每个类型意图 2 分', () => {
  const { bestScore } = scoreRecipes(recipes, { domain: 'software', typed_intents: ['implement', 'review'] });
  assert.equal(bestScore, 7);
});

test('唯一最高分时不构成缺口', () => {
  const r = selectRecipe(recipes, { domain: 'software', typed_intents: ['implement'] });
  assert.equal(r.gap, false);
  assert.equal(r.candidates.length, 1);
});

test('无匹配构成缺口', () => {
  const r = selectRecipe(recipes, { domain: 'nothing', typed_intents: [] });
  assert.equal(r.gap, true);
  assert.match(r.reason, /无匹配/);
});

test('最高分并列构成缺口（不静默取其一）', () => {
  const r = selectRecipe(recipes, { domain: 'data', typed_intents: [] });
  assert.equal(r.gap, true);
  assert.match(r.reason, /并列/);
  assert.equal(r.candidates.length, 2);
});

console.log('');
if (process.exitCode) {
  console.error(`参谋部测试失败（通过 ${passed} 项）`);
} else {
  console.log(`参谋部测试全部通过（${passed} 项）`);
}
