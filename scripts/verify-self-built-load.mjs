// 真实加载校验：把 preset 里每个 @wuji/* 自研包**真正 import 一遍**。
//
// 为什么需要这个脚本（一次真实事故）：
//   参谋部插件发布后，`verify-staff-plugin.mjs` 与单测全部通过，但用户在 GUI 里
//   **无法新建会话**，报 `agent-preset/invalid: wuji-staff (@wuji/dsh-wuji-staff):
//   never started`。
//
//   根因：`lib/index.js` 写的是 `import ... from './staff-core.js'`，而该文件实际在
//   上一级（`../staff-core.js`）。`never started` 表示该行 fiber 根本没被创建 ——
//   import 阶段就失败了。
//
//   原有校验为什么没抓到：单测直接 import `staff-core.js`（绕过了入口），形状校验
//   只用正则扫文本（没有真的加载）。**文本相似不等于模块可加载** —— 这正是本项目
//   反复强调「文本契约不冒充行为保证」的一个实例。
//
//   本脚本做的是唯一有效的事：真的 import。
//
// 用法：node scripts/verify-self-built-load.mjs

import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_MODULES = 'C:/Users/Administrator/.dsh/profiles/node_modules';

// preset 里登记的自研包（与 check-wuji-preset.mjs 的 ALLOWED_SELF_BUILT 对应）。
const SELF_BUILT = ['@wuji/dsh-wuji-bundle', '@wuji/dsh-wuji-staff'];

// 这些包是纯 patch（无 main 行为），只需存在性，不需要 import。
const PATCH_ONLY = new Set(['@wuji/dsh-wuji-bundle']);

let failed = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? `\n       ${detail}` : ''}`);
  if (!ok) failed += 1;
};

console.log('自研包真实加载校验（真的 import，不只是看文本）');
console.log('');

for (const pkg of SELF_BUILT) {
  const pkgDir = join(PROFILE_MODULES, pkg);
  console.log(`--- ${pkg} ---`);

  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    check('已安装到 profile', false, `找不到 ${pkgJsonPath}`);
    console.log('');
    continue;
  }
  check('已安装到 profile', true);

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

  if (PATCH_ONLY.has(pkg)) {
    const patch = join(pkgDir, 'cordis.patch.yml');
    check('patch 文件存在且非空', existsSync(patch) && readFileSync(patch, 'utf8').trim().length > 0);
    console.log('');
    continue;
  }

  // 解析入口：exports['.'] 或 main
  const entry =
    (typeof pkgJson.exports?.['.'] === 'string' && pkgJson.exports['.']) ||
    (typeof pkgJson.exports?.['.']?.import === 'string' && pkgJson.exports['.'].import) ||
    pkgJson.main;
  if (!entry) {
    check('package.json 声明了入口', false, 'exports["."] 与 main 都缺失');
    console.log('');
    continue;
  }
  const entryPath = join(pkgDir, entry);
  check(`入口文件存在（${entry}）`, existsSync(entryPath));

  // ★ 关键一步：真的 import。
  let mod;
  try {
    mod = await import(pathToFileURL(entryPath).href);
    check('模块可以被真实 import（DSH loader 会做同样的事）', true);
  } catch (err) {
    check('模块可以被真实 import（DSH loader 会做同样的事）', false, err.message);
    console.log('');
    continue;
  }

  // Cordis 插件的形状：name 必须是字符串，apply 必须是函数。
  check('导出 name 字符串', typeof mod.name === 'string' && mod.name.length > 0);
  check('导出 apply 函数', typeof mod.apply === 'function');
  if (mod.inject !== undefined) {
    check('inject 是字符串数组', Array.isArray(mod.inject) && mod.inject.every((x) => typeof x === 'string'));
  }

  // 该行 inject 的服务必须能被 DSH 提供，否则会变成 pending（静默不可用）。
  const KNOWN_SERVICES = new Set(['tools', 'sessionProjections', 'skills', 'commands', 'jobs', 'goal']);
  const unknown = (mod.inject ?? []).filter((s) => !KNOWN_SERVICES.has(s));
  check(
    `inject 的服务均已知（${JSON.stringify(mod.inject ?? [])}）`,
    unknown.length === 0,
    `未知服务: ${unknown.join(', ')} —— 该行会停在 pending`,
  );

  console.log('');
}

console.log('');
if (failed) {
  console.error(`自研包加载校验失败（${failed} 项）—— preset 会挂载失败，GUI 无法新建会话`);
  process.exit(1);
}
console.log('自研包加载校验通过：所有自研包可被真实 import，preset 不会因 import 失败而拒绝挂载。');
