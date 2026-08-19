// 无极军团 · 投影单元逻辑测试
// 运行：node test/projection.test.js （需从 profile 目录运行，以便解析 zod 和 @wuji/dsh-wuji-host）
import { requirementProjection, taskProjection, officerAdviceProjection } from '@wuji/dsh-wuji-host';

let pass = 0;
let fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

console.log('=== 投影定义结构 ===');
for (const d of [requirementProjection, taskProjection, officerAdviceProjection]) {
  assert(`${d.key} 定义完整`, d && typeof d.key === 'string' && typeof d.init === 'function'
    && typeof d.apply === 'function' && typeof d.view === 'function'
    && typeof d.stateVersion === 'number' && d.schema);
}

console.log('=== 需求表 apply ===');
const r0 = requirementProjection.init();
assert('初始为空', r0.units.length === 0 && r0.activeUnitId === null);
const rSame = requirementProjection.apply(r0, { type: 'other/event', data: {} });
assert('无关事件返回同一引用', rSame === r0);
const r1 = requirementProjection.apply(r0, { type: 'wuji/requirement/change', data: { unitId: 'u1', patch: { goal: '做PPT', dont: '不要图片', constraints: [], acceptance: '可打开', sourceMsgId: 'm1' } } });
assert('change 新增单元', r1 !== r0 && r1.units.length === 1 && r1.units[0].id === 'u1' && r1.units[0].revision === 1);
const r2 = requirementProjection.apply(r1, { type: 'wuji/requirement/change', data: { unitId: 'u1', patch: { goal: '做可编辑PPT' } } });
assert('change 更新单元且 revision+1', r2.units[0].goal === '做可编辑PPT' && r2.units[0].revision === 2);
const r3 = requirementProjection.apply(r2, { type: 'wuji/requirement/activate', data: { unitId: 'u1' } });
assert('activate 切换活跃单元', r3.activeUnitId === 'u1');

console.log('=== 任务表 apply ===');
const t0 = taskProjection.init();
const t1 = taskProjection.apply(t0, { type: 'wuji/task/change', data: { taskId: 't1', patch: { deps: [], assignedTo: '视觉主帅', requirement: '做PPT', input: '数据', output: 'pptx', returnFormat: 'json', failurePolicy: 'reangle' } } });
assert('任务新增', t1.nodes.length === 1 && t1.nodes[0].taskId === 't1');
const t2 = taskProjection.apply(t1, { type: 'wuji/task/status', data: { taskId: 't1', status: 'success', evidence: 'hash123' } });
assert('任务状态更新+证据', t2.nodes[0].status === 'success' && t2.nodes[0].evidence === 'hash123');

console.log('=== 官员建议表 apply ===');
const o0 = officerAdviceProjection.init();
const o1 = officerAdviceProjection.apply(o0, { type: 'wuji/officer-advice/change', data: { adviceId: 'a1', patch: { officer: 'qa', content: '这个方案有风险', evidence: 'e1', userDecision: 'pending', affectedRequirement: 'u1' } } });
assert('建议新增且默认 pending', o1.advices.length === 1 && o1.advices[0].userDecision === 'pending');
const o2 = officerAdviceProjection.apply(o1, { type: 'wuji/officer-advice/decision', data: { adviceId: 'a1', userDecision: 'adopted' } });
assert('用户采纳建议', o2.advices[0].userDecision === 'adopted');

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
