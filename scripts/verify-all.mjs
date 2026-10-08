// 无极军团 4.0 一次跑完全部静态校验。
// 用法：node scripts/verify-all.mjs
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const steps = [
  ['生成 bundle patch', ['build-wuji-preset.mjs']],
  ['生成物同步校验', ['build-wuji-preset.mjs', '--check']],
  ['preset 结构与包存在性', ['check-wuji-preset.mjs']],
  ['缺包必须被拦下（回归）', ['verify-preset-regression.mjs']],
];

let failed = 0;
for (const [label, [script, ...scriptArgs]] of steps) {
  process.stdout.write(`\n=== ${label} ===\n`);
  try {
    execFileSync(process.execPath, [join(here, script), ...scriptArgs], { stdio: 'inherit' });
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
