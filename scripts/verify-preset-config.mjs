// 按每个插件包真实的 Config schema 校验 preset 里的每个 config 块。
//
// 为什么需要它：`dsh-persona` 的 schema 是
//   z.object({ prefix: required, suffix, complete, includeRuntimeContext })
// 而本 preset 早期写的是 `text:`（旧 2.0 API）。这类错误只在 DSH 真正挂载
// preset 时才暴露，报错形如：
//   invalidconfig: $.prefix missing required value (at prefix)
// 用户必须重启 DSH 才能发现。本脚本把这一步提前到提交前。
//
// 做法：直接从 app.asar 读每个包的 lib/index.js，正则提取 `const Config = z.object({...})`
// 的键与 required/default 标记，再比对 preset 里该行提供的键。
//
// 用法：node scripts/verify-preset-config.mjs [patch路径]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ASAR = 'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
const PATCH = process.argv[2] ?? 'packages/wuji-bundle/cordis.patch.yml';

const buf = readFileSync(ASAR);
const hs = buf.readUInt32LE(12);
const header = JSON.parse(buf.subarray(16, 16 + hs).toString('utf8'));
const base = 16 + hs;
const scope = header.files.dsh.files.node_modules.files['@deepseek-ai'].files;

const readEntry = (e) =>
  buf.subarray(base + Number(e.offset), base + Number(e.offset) + Number(e.size)).toString('utf8');

/** 从一个包的 lib/index.js 里提取 Config schema 的键信息。 */
function extractSchema(pkgBare) {
  const node = scope[pkgBare];
  if (!node?.files?.lib) return null;
  const idx = node.files.lib.files?.['index.js'];
  if (!idx) return null;
  let src;
  try {
    src = readEntry(idx);
  } catch {
    return null;
  }
  // 定位 `const Config = z.object({` 的起始，然后做**括号配平**取到整个对象字面量。
  // 不能用 /z\.object\s*\(\s*\{[\s\S]*?\}\)/ 这类非贪婪正则：schema 里常有嵌套
  // 的 z.object({...})（如 tool-subagent 的 agentOptions / toolFilter），
  // 非贪婪匹配会提前在第一个 `})` 处截断，导致后续字段被误判为「不在 schema 中」。
  const start = /const\s+Config\s*=\s*z\s*\.\s*object\s*\(\s*\{/.exec(src);
  if (!start) return null;
  let i = src.indexOf('{', start.index);
  let depth = 0;
  let end = -1;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  const body = src.slice(src.indexOf('{', start.index) + 1, end);

  // 只取**顶层**字段：深度为 0 处的 `key:` 才是 Config 自己的字段。
  const fields = {};
  let d = 0;
  let lineStart = 0;
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // 深度为 0 且形如 `name: z.xxx(...)` 或 `name: z.object({`
    if (d === 0) {
      const m = /^([A-Za-z_$][\w$]*)\s*:\s*z\s*\.\s*([A-Za-z]+)\s*\(([^)]*)\)([^,\n]*)/.exec(trimmed);
      if (m) {
        const [, key, type, , mods] = m;
        fields[key] = {
          type,
          required: /\.required\s*\(\s*\)/.test(mods),
          hasDefault: /\.default\s*\(/.test(mods),
        };
      }
    }
    // 更新深度（含嵌套 object / 数组）
    for (const ch of line) {
      if (ch === '{' || ch === '[' || ch === '(') d += 1;
      else if (ch === '}' || ch === ']' || ch === ')') d -= 1;
    }
    lineStart += line.length + 1;
  }
  return Object.keys(fields).length ? fields : null;
}

// 解析 patch
const req = createRequire('C:/Users/Administrator/.dsh/profiles/node_modules/js-yaml/package.json');
const yamlMod = req('js-yaml');
const yaml = yamlMod.default ?? yamlMod;
const jsType = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: (d) => ({ __js: d }) });
const doc = yaml.load(readFileSync(PATCH, 'utf8'), { schema: yaml.DEFAULT_SCHEMA.extend({ explicit: [jsType] }) });

const row = doc.find((r) => r.insert?.some((x) => x.id === 'preset-wuji'))?.insert.find((x) => x.id === 'preset-wuji');
if (!row) {
  console.error('preset-wuji 未找到');
  process.exit(1);
}

const flat = [];
const walk = (rows, parent) => {
  for (const r of rows ?? []) {
    flat.push({ row: r, parent });
    if (Array.isArray(r.config)) walk(r.config, r.id);
  }
};
walk(row.config.plugins, 'preset-wuji');

const problems = [];
let checked = 0;
let withSchema = 0;

for (const { row: r } of flat) {
  const name = String(r.name ?? '');
  if (!name.startsWith('@deepseek-ai/')) continue;
  const pkgBare = name.split('/')[1];
  const schema = extractSchema(pkgBare);
  if (!schema) continue; // 包没导出可识别的 Config schema（如 group / 纯工具行）
  withSchema += 1;

  const cfg = r.config && !Array.isArray(r.config) ? r.config : {};
  const provided = new Set(Object.keys(cfg));

  // 1) 必填字段必须提供
  for (const [key, info] of Object.entries(schema)) {
    if (info.required && !provided.has(key)) {
      problems.push(
        `${r.id} (${name}): 缺少必填字段 \`${key}\` —— 挂载时会报 "invalidconfig: $.${key} missing required value"`,
      );
    }
  }
  // 2) 提供的字段必须是 schema 认识的（未识别键通常说明用了旧版 API 名）
  for (const key of provided) {
    if (!(key in schema)) {
      problems.push(
        `${r.id} (${name}): 字段 \`${key}\` 不在该包 schema 中（合法字段: ${Object.keys(schema).join(', ')}）`,
      );
    }
  }
  checked += 1;
}

console.log(`校验行数: ${checked}（其中 ${withSchema} 行有可识别 schema）`);
if (problems.length) {
  console.error('');
  console.error(`发现 ${problems.length} 个 config 问题：`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('config schema 校验通过。');
