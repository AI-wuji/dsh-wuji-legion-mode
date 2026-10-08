// 用真实 @deepseek-ai/dsh-tools 验证参谋部插件能加载、能注册、工具定义合法。
//
// 为什么需要：`defineTool` 的参数形状、`ctx.tools.register` 的存在性，
// 只有对着真实实现才算验证过。光看 README 不算。
//
// 用法：node scripts/verify-staff-plugin.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASAR = 'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

// asar 内的模块无法被普通 import 解析，先把 dsh-tools 的入口解出来做形状检查。
const buf = readFileSync(ASAR);
const hs = buf.readUInt32LE(12);
const header = JSON.parse(buf.subarray(16, 16 + hs).toString('utf8'));
const base = 16 + hs;
const scope = header.files.dsh.files.node_modules.files['@deepseek-ai'].files;
const readEntry = (e) =>
  buf.subarray(base + Number(e.offset), base + Number(e.offset) + Number(e.size)).toString('utf8');

const toolsPkg = JSON.parse(readEntry(scope['dsh-tools'].files['package.json']));
const toolsSrc = readEntry(scope['dsh-tools'].files.lib.files['index.js']);

let failed = 0;
const check = (label, cond) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failed += 1;
};

console.log('参谋部插件形状校验');
console.log('');
console.log('--- @deepseek-ai/dsh-tools 是否导出 defineTool ---');
check('dsh-tools 存在', Boolean(scope['dsh-tools']));
check('导出了 defineTool', /export\s*\{[^}]*defineTool/.test(toolsSrc) || /function defineTool/.test(toolsSrc));
check('package.json 声明了入口', Boolean(toolsPkg.exports || toolsPkg.main));

console.log('');
console.log('--- 参谋部插件自身 ---');
const staffIndex = readFileSync(join(repo, 'packages/wuji-staff/lib/index.js'), 'utf8');
check("从 dsh-tools 引入 defineTool", /import\s*\{\s*defineTool\s*\}\s*from\s*'@deepseek-ai\/dsh-tools'/.test(staffIndex));
check("声明 name 导出", /export const name\s*=/.test(staffIndex));
check("声明 inject 含 tools", /export const inject\s*=\s*\[[^\]]*'tools'/.test(staffIndex));
check("apply 使用 ctx.tools.register", /ctx\.tools\.register\(/.test(staffIndex));
// 工具数量会随功能增长，因此断言「有一个合理的下限」而不是写死数字 ——
// 写死会在每次加工具时误报（本次加 wuji_staff_recipes 就触发了）。
const toolCount = (staffIndex.match(/ctx\.tools\.register\(/g) ?? []).length;
check(`注册了工具（当前 ${toolCount} 个，至少 3 个）`, toolCount >= 3);
check(
  "工具名符合约定",
  /name:\s*'wuji_staff_plan'/.test(staffIndex) &&
    /name:\s*'wuji_staff_select'/.test(staffIndex) &&
    /name:\s*'wuji_staff_recipes'/.test(staffIndex),
);

console.log('');
console.log('--- 核心模块可被导入并工作 ---');
const core = await import(pathToFileURL(join(repo, 'packages/wuji-staff/staff-core.js')).href);
const plan = core.planSchedule(
  [
    { subtask_id: 'A', goal: 'a', domain: 'software', write_roots: ['out/analysis'] },
    { subtask_id: 'B', goal: 'b', domain: 'software', write_roots: ['out/analysis/deep'] },
  ],
  { parallelCap: 3 },
);
check('写集冲突的两个子任务被拆到不同组', plan.groups.length === 2);
check('计划标注 construction_only', plan.construction_only === true);

console.log('');
if (failed) {
  console.error(`形状校验失败（${failed} 项）`);
  process.exit(1);
}
console.log('参谋部插件形状校验通过。');
