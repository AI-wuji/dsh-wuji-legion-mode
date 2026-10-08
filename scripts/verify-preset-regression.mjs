// 回归测试：确认两道门禁真的能拦下它们声称能拦下的错误。
//
// 覆盖两个真实踩过的坑：
//   1) preset 引用了本机 DSH 不存在的包  → check-wuji-preset.mjs / verify-preset-imports.mjs
//   2) config 用了包 schema 不认识/缺失的字段（如 persona 的旧 2.0 字段 `text`）
//      → verify-preset-config.mjs
//
// 用法：node scripts/verify-preset-regression.mjs
//
// 实现要点：每次用例都从「原始内容」在内存里派生，写盘 → 跑 → **立刻还原**，
// 不依赖上一次用例留下的备份文件，避免某个用例中途抛错后把仓库留在破损状态。
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const preset = join(repo, 'preset', 'agent.cordis.yml');
const run = (script, args = []) =>
  execFileSync(process.execPath, [join(repo, 'scripts', script), ...args], { stdio: 'pipe' });
const build = () => run('build-wuji-preset.mjs');

// 原始（正确）内容，全程作为唯一真相来源
const ORIGINAL = readFileSync(preset, 'utf8');
const restore = () => {
  writeFileSync(preset, ORIGINAL, 'utf8');
  build();
};

let failed = 0;
const ok = (label, cond) => {
  console.log(`[guard] ${label}: ${cond ? 'OK' : '**FAIL**'}`);
  if (!cond) failed += 1;
};

/** 期望某脚本失败，并回传其输出。 */
function expectFail(label, script, args) {
  try {
    run(script, args);
    ok(`${label} → 应失败但通过了`, false);
    return null;
  } catch (err) {
    ok(`${label} → 被拦下`, true);
    return String(err.stdout ?? '') + String(err.stderr ?? '');
  }
}

// 先确保起点是健康的
try {
  build();
  run('check-wuji-preset.mjs');
  run('verify-preset-config.mjs');
  console.log('[guard] 起点健康：build + check + config 均通过\n');
} catch (err) {
  console.error('[guard] 起点不健康，先修好再跑回归：');
  console.error(String(err.stdout ?? '') + String(err.stderr ?? ''));
  console.error(String(ORIGINAL).slice(0, 0));
  process.exit(1);
}

try {
  // ── 用例 1：引用不存在的包 ──────────────────────────────────────────────
  const GOOD = "'@deepseek-ai/dsh-workflow-ptc'";
  if (!ORIGINAL.includes(GOOD)) throw new Error('fixture drift: GOOD not found');
  writeFileSync(preset, ORIGINAL.replace(GOOD, "'@deepseek-ai/dsh-workflow-worker-thread'"), 'utf8');
  build();
  const out1 = expectFail('引用不存在的包', 'check-wuji-preset.mjs');
  if (out1 !== null) ok('错误信息点名该包', out1.includes('dsh-workflow-worker-thread'));
  restore();
  run('check-wuji-preset.mjs');
  console.log('[guard] 还原正确包名 → 通过\n');

  // ── 用例 2：persona 用旧 2.0 字段名 text（用户实际遇到的报错）──────────
  const PREFIX = '    prefix: |-';
  if (!ORIGINAL.includes(PREFIX)) throw new Error('fixture drift: "prefix: |-" not found');
  writeFileSync(preset, ORIGINAL.replace(PREFIX, '    text: |-'), 'utf8');
  build();
  const out2 = expectFail('persona 用旧字段名 text', 'verify-preset-config.mjs');
  if (out2 !== null) {
    ok('点名缺失的必填字段 prefix', out2.includes('prefix'));
    ok('点名非法字段 text', out2.includes('text'));
  }
  restore();
  run('verify-preset-config.mjs');
  console.log('[guard] 还原 prefix 字段 → 通过\n');

  // ── 用例 3：删掉必填字段却不改名（最隐蔽的一种）────────────────────────
  writeFileSync(preset, ORIGINAL.replace(PREFIX, '    suffix: |-'), 'utf8');
  build();
  const out3 = expectFail('persona 完全没有 prefix', 'verify-preset-config.mjs');
  if (out3 !== null) ok('点名缺失的必填字段 prefix', out3.includes('prefix'));
  restore();
  console.log('[guard] 还原 → 通过');
} finally {
  // 无论中途发生什么，仓库都必须回到原始健康状态
  restore();
  console.log('\n[guard] 已还原 preset 到原始内容');
}

console.log(failed === 0 ? '[guard] 回归测试通过' : `[guard] 回归测试失败（${failed} 项）`);
process.exit(failed === 0 ? 0 : 1);
