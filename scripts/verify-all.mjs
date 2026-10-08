// 无极军团 4.0 一次跑完全部静态校验。
// 用法：node scripts/verify-all.mjs
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const steps = [
  ['生成 bundle patch', ['build-wuji-preset.mjs']],
  ['生成物同步校验', ['build-wuji-preset.mjs', '--check']],
  ['preset 结构与包存在性', ['check-wuji-preset.mjs']],
  ['config schema 与包契约一致', ['verify-preset-config.mjs']],
  ['参谋部调度核心单测', [join(repo, 'packages/wuji-staff/staff-core.test.js')]],
  ['参谋部插件形状与 dsh-tools 契约', ['verify-staff-plugin.mjs']],
  ['缺包 / 错字段必须被拦下（回归）', ['verify-preset-regression.mjs']],
];

let failed = 0;
for (const [label, [script, ...scriptArgs]] of steps) {
  process.stdout.write(`\n=== ${label} ===\n`);
  try {
    // 允许步骤指向仓库内任意路径（如 packages/ 下的测试），
    // 因此绝对路径直接使用，相对路径按 scripts/ 解析。
    const target = script.includes(':') || script.startsWith('/') ? script : join(here, script);
    execFileSync(process.execPath, [target, ...scriptArgs], { stdio: 'inherit' });
  } catch {
    failed += 1;
    console.error(`[verify-all] 步骤失败: ${label}`);
  }
}

console.log('');
if (failed === 0) {
  console.log('[verify-all] 全部通过。');
  console.log('注意：静态校验只覆盖结构与包存在性；preset 在真实会话中的加载');
  console.log('（选择器可见、阿极 persona 生效、其他 preset 不受影响）仍需在 DSH 内确认。');
} else {
  console.log(`[verify-all] ${failed} 个步骤失败。`);
}
process.exit(failed === 0 ? 0 : 1);
