#!/usr/bin/env node
// WorkBuddy preflight 的执行器 —— 把「能机器判的，不交给 LLM 判」真正落地。
//
// 为什么需要这个：
//   WorkBuddy 的 preflight 规范写明「执行者：主理人」，也就是说它**本来是编排层的
//   人工动作**，不是模型层的自动门。融合进 DSH 后，如果没有可执行的实现，
//   评审角色收到的永远是「缺 preflight 报告」——规范存在但没人跑得动。
//   本脚本只实现**能确定性判定**的那些项；判不了的如实标 NOT_IMPL，
//   不假装检查过。
//
// 与 WorkBuddy 规范的对应：
//   #1  产物存在且非空           → 已实现
//   #2  sha256 已计算            → 已实现（本脚本直接算）
//   #3  头部版本标识存在          → 已实现（可配置正则）
//   #4–8 结构正确性              → 部分：仅实现「跨模型语法混写」的启发式检测
//   #9  字符数在上限内            → 已实现（可配 --max-chars）
//   #17 每条规则带证据等级         → 已实现（正则统计）
//   #21 无禁用空词               → 已实现
//   #22 无滑块数值写入提示词       → 已实现
//   其余（运镜/时长/档案等）      → NOT_IMPL，需领域知识或结构化输入
//
// 用法：
//   node scripts/wb-preflight.mjs <产物文件> [--max-chars N] [--json]
//   node scripts/wb-preflight.mjs <产物文件> --report <输出路径>
//
// 退出码：PASS=0 / FAIL=1 / BLOCKED=2

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename, dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('--'));
const AS_JSON = argv.includes('--json');
const REPORT_IDX = argv.indexOf('--report');
const REPORT_PATH = REPORT_IDX >= 0 ? argv[REPORT_IDX + 1] : null;
const MAX_CHARS_IDX = argv.indexOf('--max-chars');
const MAX_CHARS = MAX_CHARS_IDX >= 0 ? Number(argv[MAX_CHARS_IDX + 1]) : 0;

if (!target) {
  console.error('用法: node scripts/wb-preflight.mjs <产物文件> [--max-chars N] [--json] [--report <路径>]');
  process.exit(2);
}

const abs = resolve(target);

// ── #1 产物存在且非空 ────────────────────────────────────────────────────────
if (!existsSync(abs)) {
  emit(blocked(`#1 产物文件不存在: ${abs}`, { 1: 'FAIL: 文件不存在' }));
  process.exit(2);
}
const size = statSync(abs).size;
if (size === 0) {
  emit(blocked(`#1 产物为空文件: ${abs}`, { 1: 'FAIL: 0 字节' }));
  process.exit(2);
}

const text = readFileSync(abs, 'utf8');

// ── #2 sha256 ───────────────────────────────────────────────────────────────
// 直接算，不依赖文件里声明过哈希 —— 声明与实际是两回事。
const sha256 = createHash('sha256').update(text, 'utf8').digest('hex');

// ── #3 头部版本标识 ──────────────────────────────────────────────────────────
// 规范样例：`[domain: X, version: Y]` 或 `[preflight: X, version: Y]`
const head = text.slice(0, 800);
const versionTag = head.match(/\[(domain|model|score|preflight):\s*[^\]]*version:\s*[^\]]*\]/i);

// ── #9 字符数 ───────────────────────────────────────────────────────────────
const charCount = text.length;
const overLimit = MAX_CHARS > 0 && charCount > MAX_CHARS;

// ── #4–8（部分）跨模型语法混写启发式 ────────────────────────────────────────
// 只检测**已知互斥**的语法家族同时出现。这是启发式，不是权威判定。
const SYNTAX_FAMILIES = [
  { name: 'H3 官方字段', pat: /integrated_multimodal_description|non_diegetic_music|overall_soundscape/i },
  { name: 'fal.ai 时间码', pat: /\[\d{1,2}:\d{2}\]|\bAudio:|\bBGM:/ },
  { name: 'SDXL/booru 逗号标签习惯', pat: /\bmasterpiece\b.*\bbest quality\b/i },
  { name: 'Negative Prompt 槽位', pat: /^\s*Negative Prompt:/im },
  { name: 'YuE2 字段', pat: /\bcot\s*[:=]\s*(full|melody|none)\b/i },
  { name: 'Seedance Asset mapping', pat: /\bAsset mapping\b/i },
];
const presentFamilies = SYNTAX_FAMILIES.filter((f) => f.pat.test(text)).map((f) => f.name);

// ── #17 证据等级覆盖 ────────────────────────────────────────────────────────
// ⚠️ 这里有一个**源材料自带的规则冲突**，本脚本必须处理，不能机械执行：
//
//   image-prompt-architect.md 同时写着两条：
//     (a) 「每条模型语法事实带证据等级标记（证据标签是元指令内部要求，**保留在文件内**）」
//     (b) 「**纯产物约束**：落盘文件只写元指令本身，可直接复制使用」
//
//   而 WorkBuddy v1.10.0 的「纯产物交付纪律」把 (b) 定为硬门（G11 校验，违反退回重做）：
//   交付文件不得含解释、注意事项、教学式展开。
//
//   两条冲突时 (b) 优先 —— 因为产物是**要直接复制去喂生成模型**的，
//   里面写 `[官方]` 会被当成正文内容吃掉，反而污染提示词。
//   实践验证：wb-image-prompt-architect 实际交付时选择了 (b)，把证据等级
//   全部放进配套的「改写说明」文件，这是正确选择。
//
//   因此本检查**区分两类文件**：
//     - 纯产物（默认）：#17 判 NOT_APPLICABLE，并提示"应查配套说明文件"
//     - 说明/设计类文件（--doc 或文件名含「说明/设计/README」）：正常判
//
//   机械按 (a) 判纯产物失败是**误报** —— 曾真实发生过一次。
const looksLikeDoc = /说明|设计|README|规范|方案|报告|preflight/i.test(basename(abs));
const isDocMode = looksLikeDoc || argv.includes('--doc');
const evidenceMarked = (text.match(/\[(官方|合作方|社区实测|工程共识|实战素材|铁律)\]/g) ?? []).length;

// ── #21 禁用空词 ────────────────────────────────────────────────────────────
const BANNED = ['越详细越好', '完美', '极致', '非常震撼', '震撼人心'];
const bannedHits = BANNED.filter((w) => text.includes(w));

// ── #22 滑块数值写入提示词 ──────────────────────────────────────────────────
// 形如 cfg: 7 / steps=30 / strength 0.8 —— 这些属于参数，不该写进散文。
//
// ⚠️ 必须区分「写进提示词」和「在说明里讨论参数」：
//   - `CFG=1 时负向无效` 是在**讨论规则**，不是要写进提示词 → 不算违规
//   - `cfg: 7, steps: 30` 出现在**提示词正文**里 → 违规
//   机械扫描会把前者误报。曾真实发生过一次（qwen 改写说明里的 `CFG=1`）。
//
//   判据：只有当参数出现在**疑似提示词正文**（英文为主的长段落、或代码块）里才算违规。
//   中文说明句里的参数讨论一律放行。
const sliderHits = [];
for (const m of text.matchAll(/\b(cfg|steps|strength|denoise|guidance)\s*[:=]\s*[\d.]+/gi)) {
  const line = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index) === -1 ? undefined : text.indexOf('\n', m.index));
  // 该行若以中文为主（含中文字符），判定为「说明性讨论」，放行
  const hasCJK = /[\u4e00-\u9fff]/.test(line);
  const looksLikePromptBody = /^[\x00-\x7F\s,;:.()\-]*$/.test(line.trim());
  if (!hasCJK && looksLikePromptBody) sliderHits.push(m[0]);
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
const checks = [];
const add = (id, name, status, detail) => checks.push({ id, name, status, detail });

add(1, '产物存在且非空', 'PASS', `${size} 字节`);
add(2, 'sha256 已计算', 'PASS', sha256);
add(3, '头部版本标识', versionTag ? 'PASS' : 'REVISE', versionTag ? versionTag[0] : '未找到 `[... version: Y]` 标记');
add(4, '字段名官方一致', 'NOT_IMPL', '需要领域字段清单');
add(5, '必填字段齐全', 'NOT_IMPL', '需要结构化输入');
add(6, '结构标签位置', 'NOT_IMPL', '需要结构化输入');
add(7, '无跨模型语法混写', presentFamilies.length > 1 ? 'REBUILD' : 'PASS',
  presentFamilies.length > 1 ? `检出多个语法家族: ${presentFamilies.join(' / ')}` : `仅检出: ${presentFamilies.join(' / ') || '无'}`);
add(8, '参考标签编号连续', 'NOT_IMPL', '需要结构化输入');
add(9, '字符数在上限内', overLimit ? 'REVISE' : 'PASS',
  MAX_CHARS > 0 ? `${charCount} / 上限 ${MAX_CHARS}` : `${charCount} 字符（未设上限，未判定）`);
add(17, '证据等级覆盖', isDocMode
  ? (evidenceMarked > 0 ? 'PASS' : 'REVISE')
  : 'NOT_APPLICABLE',
isDocMode
  ? `文档模式：检出 ${evidenceMarked} 处证据等级标记`
  : `纯产物模式：本文件按 G11 纯产物约束编写，证据等级应在配套说明文件中查（本文件检出 ${evidenceMarked} 处，不参与判定）`);
add(21, '无禁用空词', bannedHits.length ? 'REVISE' : 'PASS', bannedHits.length ? bannedHits.join('、') : '无');
add(22, '无滑块数值写入', sliderHits.length ? 'REVISE' : 'PASS', sliderHits.length ? sliderHits.join('、') : '无');

const impl = checks.filter((c) => c.status !== 'NOT_IMPL');
const failed = impl.filter((c) => c.status !== 'PASS');
const worst = failed.some((c) => c.status === 'REBUILD') || failed.some((c) => c.status === 'BLOCKED')
  ? 'FAIL'
  : failed.length
    ? 'FAIL'
    : 'PASS';

const disposition = (() => {
  if (failed.some((c) => c.id === 1 || c.id === 2)) return 'BLOCKED';
  if (failed.some((c) => c.status === 'REBUILD')) return 'REBUILD';
  if (failed.length) return 'REVISE';
  return 'PASS（仅就已实现项而言）';
})();

const report = {
  target: abs,
  name: basename(abs),
  sha256,
  bytes: size,
  chars: charCount,
  checksTotal: 35,
  checksImplemented: impl.length,
  checksNotImplemented: checks.length - impl.length,
  checks,
  result: worst,
  disposition,
  honesty: [
    '本报告只覆盖已实现的检查项；NOT_IMPL 项未经检查，不得读作通过。',
    'WorkBuddy 规范共 35 项，本脚本已实现项数见 checksImplemented。',
    '判定为启发式的地方（#7 语法混写）可能误报或漏报，已在 detail 中说明依据。',
    'sha256 由本脚本直接计算，不采信文件内的声明值。',
  ],
};

if (REPORT_PATH) {
  const lines = [
    `[preflight: ${report.name}, version: 1]`,
    `产物路径: ${report.target}`,
    `sha256: ${report.sha256}`,
    `检查项总数: 35（本次已实现 ${report.checksImplemented} 项）`,
    `通过: ${checks.filter((c) => c.status === 'PASS').map((c) => c.id).join(',') || '（无）'}`,
    `未通过: ${failed.map((c) => `${c.id} → ${c.detail}`).join('\n        ') || '（无）'}`,
    `未实现: ${checks.filter((c) => c.status === 'NOT_IMPL').map((c) => c.id).join(',') || '（无）'}`,
    `结果: ${report.result}`,
    `处置: ${report.disposition}`,
    '',
    '## 诚实边界',
    ...report.honesty.map((h) => `- ${h}`),
  ];
  const out = REPORT_PATH === 'auto' ? join(dirname(abs), `${basename(abs, '.md')}-preflight.md`) : REPORT_PATH;
  writeFileSync(out, lines.join('\n') + '\n', 'utf8');
  console.error(`[preflight] 报告已落盘: ${out}`);
}

emit(report);
process.exit(worst === 'PASS' ? 0 : 1);

function blocked(msg, map) {
  return {
    target: abs, name: basename(abs), sha256: null, checksTotal: 35,
    checks: checksFromMap(map), result: 'FAIL', disposition: 'BLOCKED',
    note: msg,
  };
}
function checksFromMap(map) {
  return Object.entries(map).map(([id, v]) => ({ id: Number(id), name: '', status: v.split(':')[0].trim(), detail: v }));
}
function emit(obj) {
  if (AS_JSON || REPORT_PATH) {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
    return;
  }
  // 人类可读
  const icon = (s) => ({ PASS: '✅', REVISE: '⚠️', REBUILD: '❌', NOT_IMPL: '⬜', FAIL: '❌', BLOCKED: '🚫' }[s] ?? '?');
  console.log(`[preflight] ${obj.name}`);
  console.log(`  sha256: ${obj.sha256 ?? '（未计算）'}`);
  console.log(`  检查项总数: 35（已实现 ${obj.checksImplemented ?? '—'} 项）`);
  console.log('');
  for (const c of obj.checks) console.log(`  ${icon(c.status)} #${c.id} ${c.name} — ${c.detail}`);
  console.log('');
  console.log(`  结果: ${obj.result}`);
  console.log(`  处置: ${obj.disposition}`);
  if (obj.note) console.log(`  说明: ${obj.note}`);
  console.log('');
  console.log('  诚实边界:');
  for (const h of obj.honesty ?? ['（阻塞，未执行检查）']) console.log(`   - ${h}`);
}
