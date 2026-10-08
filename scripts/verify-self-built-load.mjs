// 真实加载 + 真实 apply 校验。
//
// 两次真实事故促使本脚本存在：
//
//   事故一：`lib/index.js` 写成 `from './staff-core.js'`（应为 `../`），
//           preset 挂载失败，GUI 报 `wuji-staff: never started`。
//           原因：单测直接 import core 绕过了入口；形状校验只扫文本，从未加载。
//
//   事故二：工具定义缺 `output` 块。`defineTool` 会**无条件**读取
//           `options.output.render`，于是运行时报
//           `Cannot read properties of undefined (reading 'render')`，
//           整行 fiber 失败、preset 再次拒绝挂载。
//           原因：门禁只做了 `typeof apply === 'function'`，从未**真的调用 apply**。
//
// 教训是一致的：**文本相似 / 类型正确，都不等于运行时不炸。**
// 因此本脚本做三件事，缺一不可：
//   1. 真的 import 入口；
//   2. 真的用假的 ctx 调用 apply()（这一步才能抓出 output 缺失）；
//   3. 校验注册出来的工具定义满足 defineTool 的必填契约。
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

// 纯 patch 包：无 main 行为，只需存在性。
const PATCH_ONLY = new Set(['@wuji/dsh-wuji-bundle']);

// 已知的宿主服务名。inject 了未知服务会让该行停在 pending —— 静默不可用。
const KNOWN_SERVICES = new Set([
  'tools',
  'sessionProjections',
  'skills',
  'commands',
  'jobs',
  'goal',
  'persona',
]);

let failed = 0;
const check = (label, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail && !ok ? `\n       ${detail}` : ''}`);
  if (!ok) failed += 1;
};

// dsh-tools 的 defineTool 会读出这些字段；缺任何一个都会在运行时报错。
const REQUIRED_OUTPUT_FIELDS = ['render'];

console.log('自研包真实加载 + 真实 apply 校验');
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
  const dot = pkgJson.exports?.['.'];
  const entry =
    (typeof dot === 'string' && dot) ||
    (typeof dot?.import === 'string' && dot.import) ||
    pkgJson.main;
  if (!entry) {
    check('package.json 声明了入口', false, 'exports["."] 与 main 都缺失');
    console.log('');
    continue;
  }
  const entryPath = join(pkgDir, entry);
  check(`入口文件存在（${entry}）`, existsSync(entryPath));

  // ── 1) 真的 import ──────────────────────────────────────────────────────
  let mod;
  try {
    mod = await import(pathToFileURL(entryPath).href);
    check('模块可以被真实 import', true);
  } catch (err) {
    check('模块可以被真实 import', false, err.message);
    console.log('');
    continue;
  }

  check('导出 name 字符串', typeof mod.name === 'string' && mod.name.length > 0);
  check('导出 apply 函数', typeof mod.apply === 'function');
  if (mod.inject !== undefined) {
    check('inject 是字符串数组', Array.isArray(mod.inject) && mod.inject.every((x) => typeof x === 'string'));
    const unknown = (mod.inject ?? []).filter((s) => !KNOWN_SERVICES.has(s));
    check(
      `inject 服务均已知（${JSON.stringify(mod.inject ?? [])}）`,
      unknown.length === 0,
      `未知服务: ${unknown.join(', ')} —— 该行会停在 pending`,
    );
  }

  // ── 2) 真的调用 apply() ────────────────────────────────────────────────
  // 用最小假 ctx：只提供 tools.register 与其它已知服务。
  const registered = [];
  const fakeCtx = {
    tools: { register: (t) => registered.push(t) },
    sessionProjections: { register: () => {} },
    skills: { register: () => {} },
    commands: { register: () => {} },
    get: () => undefined,
  };

  let applied = true;
  let applyError = '';
  try {
    await mod.apply(fakeCtx, {});
  } catch (err) {
    applied = false;
    applyError = err.message;
  }
  check('apply() 可以被真实调用（抓运行时契约错误）', applied, applyError);

  if (!applied) {
    console.log('');
    continue;
  }

  // ── 3) 校验注册出来的工具定义 ──────────────────────────────────────────
  check('apply() 至少注册了一个工具', registered.length > 0);
  for (const tool of registered) {
    const tname = tool?.name ?? '(未命名)';
    const missing = [];
    if (typeof tool?.name !== 'string' || !tool.name) missing.push('name');
    if (typeof tool?.description !== 'string' || !tool.description) missing.push('description');
    if (tool?.parameters === undefined) missing.push('parameters');
    if (tool?.output === undefined) {
      missing.push('output（defineTool 会无条件读 output.render，缺失即 preset 挂载失败）');
    } else {
      for (const f of REQUIRED_OUTPUT_FIELDS) {
        if (typeof tool.output[f] !== 'function') missing.push(`output.${f}`);
      }
    }
    if (typeof tool?.execute !== 'function') missing.push('execute');
    check(`工具 ${tname} 契约完整`, missing.length === 0, `缺少: ${missing.join(', ')}`);
  }

  console.log('');
}

console.log('');
if (failed) {
  console.error(`自研包加载/apply 校验失败（${failed} 项）—— preset 会挂载失败，GUI 无法新建会话`);
  process.exit(1);
}
console.log('自研包校验通过：可真实 import、可真实 apply、工具契约完整。');
