// 回归测试：确认 check-wuji-preset.mjs 能拦下「引用不存在包」。
// 用法：node scripts/__regress-guard.mjs
import { readFileSync, writeFileSync, copyFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const preset = join(repo, 'preset', 'agent.cordis.yml');
const backup = join(repo, 'preset', 'agent.cordis.yml.__guardtest');

const GOOD = "'@deepseek-ai/dsh-workflow-ptc'";
const BAD = "'@deepseek-ai/dsh-workflow-worker-thread'";

copyFileSync(preset, backup);
let failed = 0;
try {
  // 1) 注入不存在的包，期望 check 失败
  const t = readFileSync(preset, 'utf8');
  if (!t.includes(GOOD)) throw new Error('fixture drift: GOOD not found');
  writeFileSync(preset, t.replace(GOOD, BAD), 'utf8');
  execFileSync(process.execPath, [join(repo, 'scripts', 'build-wuji-preset.mjs')], { stdio: 'ignore' });

  let caught = false;
  try {
    execFileSync(process.execPath, [join(repo, 'scripts', 'check-wuji-preset.mjs')], { stdio: 'pipe' });
  } catch (err) {
    caught = true;
    const out = String(err.stdout ?? '') + String(err.stderr ?? '');
    const named = out.includes('dsh-workflow-worker-thread');
    console.log(`[guard] 注入不存在的包 → check 失败: ${caught ? 'OK' : 'FAIL'}`);
    console.log(`[guard] 错误信息点名该包: ${named ? 'OK' : 'FAIL'}`);
    if (!named) failed += 1;
  }
  if (!caught) {
    console.log('[guard] 注入不存在的包 → check 未失败: **FAIL**（guard 无效）');
    failed += 1;
  }

  // 2) 还原后期望 check 通过
  renameSync(backup, preset);
  execFileSync(process.execPath, [join(repo, 'scripts', 'build-wuji-preset.mjs')], { stdio: 'ignore' });
  execFileSync(process.execPath, [join(repo, 'scripts', 'check-wuji-preset.mjs')], { stdio: 'pipe' });
  console.log('[guard] 还原正确包名 → check 通过: OK');
} finally {
  if (existsSync(backup)) {
    try { unlinkSync(preset); } catch {}
    renameSync(backup, preset);
    execFileSync(process.execPath, [join(repo, 'scripts', 'build-wuji-preset.mjs')], { stdio: 'ignore' });
  }
}

console.log(failed === 0 ? '[guard] 回归测试通过' : `[guard] 回归测试失败（${failed} 项）`);
process.exit(failed === 0 ? 0 : 1);
