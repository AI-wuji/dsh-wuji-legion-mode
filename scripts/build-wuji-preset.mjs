#!/usr/bin/env node
// 由 preset/agent.cordis.yml 生成 bundle 的 cordis.patch.yml。
//
// 官方形态（见 dsh-agent-preset 的 skills/editing-cordis-compositions/SKILL.md）：
// bundle 目录就是 package.json + cordis.patch.yml 两个文件，preset 以一条
// `- insert:` 的 `@deepseek-ai/dsh-agent-preset` 行声明，其 plugins 就是原来
// agent.cordis.yml 的裸插件数组。
//
// 安装必须交给 plugin_manager 的 install_bundle —— 它自己完成包安装与 bundle 选择。
// 不要手工往 profile node_modules 拷贝包，也不要手改 profile package.json：
// 官方原文 “do not reproduce those steps with shell commands”，那样注册的 bundle
// 不会被识别，preset 不会出现在选择器里。
//
// 用法：node scripts/build-wuji-preset.mjs [--check]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(repo, 'preset', 'agent.cordis.yml');
const bundleDir = join(repo, 'packages', 'wuji-bundle');
const outFile = join(bundleDir, 'cordis.patch.yml');

const PRESET_ID = 'wuji';
const PRESET_ROW_ID = 'preset-wuji';
const PRESET_ORDER = 50;
const BUNDLE_NAME = '@wuji/dsh-wuji-bundle';

// ---- 读取并规范化插件数组文本 -------------------------------------------
const raw = readFileSync(source, 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

// 去掉文件级注释头（从第一行到第一个非注释、非空行为止）
let start = 0;
while (start < lines.length && (lines[start].trim() === '' || lines[start].trimStart().startsWith('#'))) {
  start += 1;
}
const body = lines.slice(start).join('\n').replace(/\s+$/, '');

if (!body.startsWith('- ')) {
  console.error(`[wuji] ${source} 不是插件数组（首个有效行应以 "- " 开头）`);
  process.exit(1);
}

// ---- 技能目录由 preset/agent.cordis.yml 自己声明 ----------------------------
// 早期版本在本脚本里注入 customSkillDirs，但源文件已自带该配置，注入逻辑只会走
// 提前返回，属于重复真相。技能挂载的唯一真相是源文件里的 skill-filesystem 行；
// 本脚本只做结构包装，完整性由 scripts/check-wuji-preset.mjs 把关。
if (!/^\s*customSkillDirs:/m.test(body)) {
  console.error(
    '[wuji] preset/agent.cordis.yml 的 skill-filesystem 行缺少 customSkillDirs：' +
      'PonyTail 技能不会随 preset 挂载。',
  );
  process.exit(1);
}

// ---- 读取 preset.yml 的展示字段 ------------------------------------------
// 官方声明支持可选的 name / description / order（选择器里显示的就是它们）。
// 唯一真相是 preset/agent.cordis.yml + preset/preset.yml，不在本脚本里硬编码文案。
const metaRaw = readFileSync(join(repo, 'preset', 'preset.yml'), 'utf8');
const meta = {};
for (const line of metaRaw.replace(/\r\n/g, '\n').split('\n')) {
  const m = /^([A-Za-z_]+):\s*(.*)$/.exec(line.trim());
  if (m && !(m[1] in meta)) meta[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
if (!meta.name) {
  console.error('[wuji] preset/preset.yml 缺少 name，preset 在选择器里会没有显示名');
  process.exit(1);
}
const order = Number.isFinite(Number(meta.order)) ? Number(meta.order) : PRESET_ORDER;

// ---- 组装 patch 文件 ------------------------------------------------------
// 缩进规则：config.plugins 是 config 的子键，故插件行整体右移 10 空格。
const indent = (text, spaces) =>
  text
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : ' '.repeat(spaces) + line))
    .join('\n');

const header = [
  '# 无极军团 bundle 的 patch 层 —— 由 scripts/build-wuji-preset.mjs 生成，请勿手工编辑。',
  '#',
  '# 形态对齐官方 dsh-agent-preset 的 editing-cordis-compositions/SKILL.md：一条',
  '# `@deepseek-ai/dsh-agent-preset` 声明，plugins 为 preset/agent.cordis.yml 的内容，',
  '# name / description / order 取自 preset/preset.yml。',
  '#',
  '# 本层只声明 preset，不含任何 Host 平面行：军团能力全部由官方 @deepseek-ai/*',
  '# 插件行承载，挂在 preset 内，其他 preset 因此完全不受影响。',
  '#',
  '# 改 persona、铁律或工具装配 → 改 preset/agent.cordis.yml → 重跑本脚本。',
  '# `--check` 校验生成物与源文件是否同步。',
  '#',
  '# 安装：plugin_manager / action: install_bundle / target: 本 bundle 目录绝对路径。',
  '# 不要手工拷贝包或手改 profile package.json，那样注册的 bundle 不会被识别。',
  '',
  '- insert:',
  `    - id: ${PRESET_ROW_ID}`,
  "      name: '@deepseek-ai/dsh-agent-preset'",
  '      config:',
  `        id: ${PRESET_ID}`,
  ...(meta.name ? [`        name: ${meta.name}`] : []),
  ...(meta.description ? [`        description: ${meta.description}`] : []),
  `        order: ${order}`,
  '        plugins:',
].join('\n');

const output = `${header}\n${indent(body, 10)}\n`;

// ---- 输出或校验 ----------------------------------------------------------
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outFile, 'utf8');
  } catch {
    console.error(`[wuji] 生成物缺失: ${outFile}`);
    process.exit(1);
  }
  if (current !== output) {
    console.error('[wuji] 生成物与 preset/agent.cordis.yml 不同步，请重新运行 node scripts/build-wuji-preset.mjs');
    process.exit(1);
  }
  console.log('[wuji] 生成物已同步');
  process.exit(0);
}

mkdirSync(bundleDir, { recursive: true });
writeFileSync(outFile, output, 'utf8');
const pluginRows = (body.match(/^- id:/gm) || []).length;
console.log(`[wuji] 已生成 ${outFile}`);
console.log(`[wuji] 插件行 ${pluginRows} 条，preset id=${PRESET_ID} order=${PRESET_ORDER}`);
