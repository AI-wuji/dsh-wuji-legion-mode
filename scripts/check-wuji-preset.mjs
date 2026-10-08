#!/usr/bin/env node
// 校验生成的 wuji preset patch 文件可被 DSH 的 YAML loader 接受。
//
// DSH 在自己的 loader 里给 `!!js` 注册了自定义 schema（cordis.patch.yml 头部注明
// “`!!js` expressions allowed”），原生 js-yaml 不认识该标签。因此这里显式补一个
// 宽松类型，只做结构校验，不求值表达式。
//
// 用法：node scripts/check-wuji-preset.mjs

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(repo, 'packages', 'wuji-bundle', 'cordis.patch.yml');

// 借用 DSH profile 里的 js-yaml（宿主已装，无需新增依赖）
const require = createRequire(import.meta.url);
const yaml = require('C:/Users/Administrator/.dsh/profiles/node_modules/js-yaml');

// js-yaml v4 要求 Type 实例，不接受 plain object
const jsType = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  construct: (data) => ({ __js: data }),
});

const types = yaml.DEFAULT_SCHEMA.extend({ explicit: [jsType] });

let doc;
try {
  doc = yaml.load(readFileSync(file, 'utf8'), { schema: types });
} catch (err) {
  // 只打印定位信息，避免整份 YAML 灌进输出
  const m = err.mark ? ` 行 ${err.mark.line + 1} 列 ${err.mark.column + 1}` : '';
  console.error(`[wuji] YAML 解析失败:${m} ${err.reason ?? err.message}`);
  process.exit(1);
}

const problems = [];
const expect = (cond, msg) => {
  if (!cond) problems.push(msg);
};

expect(Array.isArray(doc), '顶层必须是数组');
expect(doc?.length === 1, `顶层应只有 1 个元素，实际 ${doc?.length}`);

const insert = doc?.[0]?.insert;
expect(Array.isArray(insert), '第 1 个元素必须有 insert 数组');
expect(insert?.length === 1, `insert 应只有 1 行，实际 ${insert?.length}`);

const row = insert?.[0];
expect(row?.id === 'preset-wuji', `row.id 应为 preset-wuji，实际 ${row?.id}`);
expect(row?.name === '@deepseek-ai/dsh-agent-preset', `row.name 应为 @deepseek-ai/dsh-agent-preset，实际 ${row?.name}`);
expect(row?.config?.id === 'wuji', `config.id 应为 wuji，实际 ${row?.config?.id}`);
expect(typeof row?.config?.order === 'number', `config.order 应为数字，实际 ${row?.config?.order}`);
// 选择器显示的就是 name / description
expect(typeof row?.config?.name === 'string' && row.config.name.length > 0, 'config.name 缺失（选择器里会没有显示名）');
expect(
  typeof row?.config?.description === 'string' && row.config.description.length > 0,
  'config.description 缺失（选择器里会没有说明）',
);

const plugins = row?.config?.plugins;
expect(Array.isArray(plugins) && plugins.length > 0, 'config.plugins 必须是非空数组');

const ids = new Set();
for (const p of plugins ?? []) {
  expect(typeof p?.id === 'string' && p.id.length > 0, '每个插件行都需要 id');
  expect(typeof p?.name === 'string' && p.name.length > 0, `插件 ${p?.id} 缺少 name`);
  expect(!ids.has(p?.id), `插件 id 重复: ${p?.id}`);
  ids.add(p?.id);
}

// 插件行会嵌在 cordis:group 的 config 里（如 delegation / compaction 分组），
// 所以必须递归展开后再找，不能只扫顶层。
const flatten = (rows) => {
  const out = [];
  for (const row of rows ?? []) {
    out.push(row);
    if (Array.isArray(row?.config)) out.push(...flatten(row.config));
  }
  return out;
};
const allRows = flatten(plugins);

// 自研行白名单：这些是**有意**保留的自研能力，其余 @wuji/* 一律禁止。
//
// 历史上 4.0 改造把自研运行时全部删掉了（wuji-host 20 个模块、wuji-runtime 分组），
// 因为它们的职责官方插件都能承接。唯有一件事官方没有对应包：
//
//   `@wuji/dsh-wuji-staff` —— 参谋部的确定性调度核心
//   （打分选择 / 依赖图 / 写集冲突 / 并发分组 / 缺口传播）
//
// 已核实官方 289 个包中没有调度器；而这件事必须确定性、可复现，
// 不能每次由模型现场生成脚本（烧 token、有延迟、且每次产出可能不同）。
// 因此经明确决策后以插件形式保留，并在此登记 —— 任何白名单外的 @wuji/* 行
// 都会让校验失败，防止自研面重新蔓延。
const ALLOWED_SELF_BUILT = new Set(['@wuji/dsh-wuji-staff']);

const runtime = allRows.find((p) => p?.id === 'wuji-runtime');
expect(!runtime, 'wuji-runtime 自研分组应已于 4.0 改造移除，不得重新引入');

const selfBuilt = allRows
  .map((p) => String(p?.name ?? ''))
  .filter((n) => n.startsWith('@wuji/') && !ALLOWED_SELF_BUILT.has(n));
expect(
  selfBuilt.length === 0,
  `preset 出现白名单外的自研包：${selfBuilt.join(', ')}（如需新增请先论证官方无对应能力，并加入 ALLOWED_SELF_BUILT）`,
);

// 参谋部必须存在且挂在 preset 内 —— 这是「军团自动调用、用户无需选择」的保证
expect(
  allRows.some((p) => String(p?.name ?? '') === '@wuji/dsh-wuji-staff'),
  '参谋部 @wuji/dsh-wuji-staff 必须挂在 preset 内（挂 host 层会污染其他 preset）',
);

// 官方编排面必须存在：这是 4.0「复杂任务真实执行」的能力来源
const byId = new Map(allRows.map((p) => [p?.id, p]));
const requiredOfficial = [
  ['tool-workflow', '@deepseek-ai/dsh-tool-workflow'],
  ['tool-subagent', '@deepseek-ai/dsh-tool-subagent'],
  ['workflow-ptc', '@deepseek-ai/dsh-workflow-ptc'],
  ['tool-goal', '@deepseek-ai/dsh-tool-goal'],
  ['tool-todo', '@deepseek-ai/dsh-tool-todo'],
  ['present', '@deepseek-ai/dsh-tool-present'],
];
for (const [id, name] of requiredOfficial) {
  const row = byId.get(id);
  expect(Boolean(row), `缺少官方编排行 ${id}（${name}）`);
  if (row) expect(row.name === name, `${id} 应为 ${name}，实际 ${row.name}`);
}

// 关键回归：preset 引用的每个官方包都必须真实存在于本机 DSH。
//
// 这是 4.0 改造中真实踩到的坑：preset 里写了 `@deepseek-ai/dsh-workflow-worker-thread`，
// 该包在本版 DSH 中不存在。@deepseek-ai/dsh-agent-preset-registry 的 activation audit
// 会因 import 失败而**拒绝整个 mount** —— 症状是 preset 已注册但选择器里看不到、
// 新建会话仍落到 standard，且不报错到用户可见处。因此必须静态拦下。
const asarPath = 'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
let availablePackages = null;
try {
  const { readFileSync } = await import('node:fs');
  const fd = readFileSync(asarPath);
  const headerSize = fd.readUInt32LE(12);
  const header = JSON.parse(fd.subarray(16, 16 + headerSize).toString('utf8'));
  const scope = header.files?.dsh?.files?.node_modules?.files?.['@deepseek-ai']?.files ?? {};
  availablePackages = new Set(
    Object.keys(scope).map((n) => (n.startsWith('dsh-') ? `@deepseek-ai/${n}` : n)),
  );
} catch (err) {
  console.warn(`[wuji] 跳过包存在性校验（无法读取 DSH app.asar: ${err.code ?? err.message}）`);
}

if (availablePackages) {
  for (const row of allRows) {
    const name = String(row?.name ?? '');
    if (!name.startsWith('@deepseek-ai/')) continue;
    // 子路径导出（如 `@deepseek-ai/dsh-tool-subagent-control/list-agents`）按包根校验。
    const pkgName = name.startsWith('@')
      ? name.split('/').slice(0, 2).join('/')
      : name.split('/')[0];
    expect(
      availablePackages.has(pkgName),
      `preset 引用了本机 DSH 不存在的包：${name}（行 id=${row.id}）—— 会导致整个 preset mount 被拒`,
    );
  }
}

// 技能目录必须挂在 preset 自己的 skill-filesystem 行上（隔离要求）。
// 技能根必须是 skills 目录本身：dsh-skill-filesystem 只发现一层深
// （`<root>/<name>/SKILL.md`），指向包根或 preset 根都会让全部技能落空。
const skillFs = byId.get('skill-filesystem');
expect(skillFs?.name === '@deepseek-ai/dsh-skill-filesystem', '缺少 @deepseek-ai/dsh-skill-filesystem');
const dirs = skillFs?.config?.customSkillDirs ?? [];
expect(Array.isArray(dirs) && dirs.length > 0, 'skill-filesystem 未挂载 customSkillDirs');
expect(
  dirs.some((d) => JSON.stringify(d).includes("'skills'") || JSON.stringify(d).includes('"skills"')),
  'customSkillDirs 未指向 skills 目录本身（会导致技能一层深发现全部落空）',
);
// 技能随 bundle 发布，因此必须通过 bundle 包名反查包根，不能用 baseUrl 相对解析。
expect(
  dirs.some((d) => JSON.stringify(d).includes('@wuji/dsh-wuji-bundle/package.json')),
  'customSkillDirs 应通过 @wuji/dsh-wuji-bundle 包名反查包根（baseUrl 不是包目录）',
);

// persona 必须存在且是阿极。
// 字段名是 `prefix`（@deepseek-ai/dsh-persona 的必填字段），不是旧 2.0 的 `text`。
// 这里两者都读，只为在写错字段时给出更易懂的报错；字段合法性由
// verify-preset-config.mjs 按包内真实 schema 严格把关。
const persona = plugins?.find((p) => p?.id === 'persona');
expect(persona?.name === '@deepseek-ai/dsh-persona', '缺少 @deepseek-ai/dsh-persona');
const personaText = String(persona?.config?.prefix ?? persona?.config?.text ?? '');
expect(personaText.includes('阿极'), 'persona 未包含阿极身份（prefix 为空或未写阿极）');

// Laya 已废弃，回归防护
const full = readFileSync(file, 'utf8');
expect(!/laya/i.test(full), '生成物仍含 Laya 痕迹（应已于 2026-09-29 废弃）');
expect(!full.includes('wuji_route'), '生成物仍含未实现的 wuji_route 工具');

if (problems.length) {
  console.error(`[wuji] 校验失败（${problems.length} 项）:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// 包存在性已由上面的 availablePackages 检查覆盖；这里再跑一次独立实现
// （scripts/verify-preset-imports.mjs），因为它同时校验 cordis:group 嵌套行，
// 且可作为单文件诊断入口。
try {
  const { execFileSync } = await import('node:child_process');
  const { dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  execFileSync(process.execPath, [join(here, 'verify-preset-imports.mjs'), file], { stdio: 'pipe' });
} catch (err) {
  const out = String(err.stdout ?? '') + String(err.stderr ?? '');
  console.error('[wuji] 插件包存在性校验失败：');
  console.error(out.split('\n').filter((l) => l.trim()).map((l) => `  ${l}`).join('\n'));
  process.exit(1);
}

console.log(`[wuji] 校验通过：preset=${row.config.id} order=${row.config.order} 插件 ${plugins.length} 条`);
console.log(`[wuji] 插件 id: ${plugins.map((p) => p.id).join(', ')}`);
