// 证明 verify-self-built-load.mjs 真能抓到「工具定义缺 output」这个缺陷。
//
// 这是用户实际遇到的第二次事故：
//   agent-preset/invalid: wuji-staff (@wuji/dsh-wuji-staff):
//   Cannot read properties of undefined (reading 'render')
//
// 做法：临时把 live 包的 output 块去掉，跑门禁，必须失败；然后还原。
//
// 用法：node scripts/__prove-apply-guard.mjs
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const live = 'C:/Users/Administrator/.dsh/profiles/node_modules/@wuji/dsh-wuji-staff/lib/index.js';
const backup = join(repo, '.apply-guard-backup.tmp');

const source = readFileSync(live, 'utf8');

// 把 `output: { ... }` 整块删掉。用括号配平定位，避免误删。
function stripOutputBlock(src) {
  const marker = 'output: {';
  const start = src.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  let i = src.indexOf('{', start);
  const from = i;
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  // 连同后面的逗号一起去掉
  let end = i + 1;
  if (src[end] === ',') end += 1;
  return src.slice(0, start) + src.slice(end);
}

const stripped = stripOutputBlock(source);
if (!stripped || stripped === source) {
  console.error('前置条件不满足：未能定位并移除 output 块');
  process.exit(1);
}

copyFileSync(live, backup);
try {
  writeFileSync(live, stripped, 'utf8');
  console.log('已注入缺陷：移除工具定义的 output 块');
  console.log('');

  let guardFailed = false;
  let output = '';
  try {
    output = execFileSync(process.execPath, [join(repo, 'scripts/verify-self-built-load.mjs')], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (err) {
    guardFailed = true;
    // Windows 上子进程的 stderr 可能只出现在 err.stderr，也可能被 shell 包装；
    // 同时收集所有可用来源，避免断言因管道行为而误判。
    output = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n');
  }

  // 门禁必须 (a) 失败，(b) 点名缺陷原因（render / output / apply）。
  const flagged =
    /render/i.test(output) || /output/i.test(output) || /apply/i.test(output);

  console.log('');
  if (!guardFailed) {
    console.error('结论：门禁在缺陷下仍然通过 —— 它是摆设，必须修。');
    process.exitCode = 1;
  } else if (!flagged) {
    console.error('结论：门禁虽然失败了，但没有点名缺陷原因 —— 报错不够具体。');
    console.error(`实际输出:\n${output}`);
    process.exitCode = 1;
  } else {
    console.log('结论：门禁正确拦下了该缺陷，并点名了失败原因。');
  }
} finally {
  copyFileSync(backup, live);
  if (existsSync(backup)) unlinkSync(backup);
  console.log('已还原 live 文件。');
}
