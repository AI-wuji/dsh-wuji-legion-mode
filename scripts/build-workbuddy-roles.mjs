#!/usr/bin/env node
// 把 WorkBuddy prompt-meta-team 的 11 个 agent 正文转成 DSH 角色技能。
//
// 为什么单独一个脚本、不走 build-wuji-roles.mjs：
//   build-wuji-roles 的源是 wuji-legion-codex-4.0/catalog/p3/*.json（结构化字段），
//   而 WorkBuddy 的源是 11 份 Markdown 正文（人写的、有 frontmatter + 大量散文）。
//   两者源格式不同，硬塞进一个脚本只会让两边都变复杂。
//   本脚本只做「格式搬运」，不改写正文语义。
//
// 命名：技能名统一加 `wb-` 前缀，避免与现有 57 个 wuji-expert-* 撞名。
//   这是有意的：WorkBuddy 的 video-prompt-architect 与现有 video-production
//   职责相邻但不等同，加前缀让两者并存、可按需选择，而不是互相覆盖。
//
// 用法：
//   node scripts/build-workbuddy-roles.mjs           生成
//   node scripts/build-workbuddy-roles.mjs --check   只校验，不写
//   node scripts/build-workbuddy-roles.mjs --stats   只看统计

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 源：WorkBuddy 各专家的 agents/ 目录 ──────────────────────────────────────
// 早期只有 prompt-meta-team 一个来源，所以写死过。现在有第二个来源（model-dedup），
// 改为列表：**每个来源一个 plugin 目录**，逐个读 agents/*.md。
// 新增 WorkBuddy 专家时，只需在下面加一行 + 在 FAMILY_OF 登记归属。
const SOURCE_PLUGINS = [
  'C:/Users/Administrator/.workbuddy/plugins/marketplaces/my-experts/plugins/prompt-meta-team',
  'C:/Users/Administrator/.workbuddy/plugins/marketplaces/my-experts/plugins/model-dedup',
];
const SOURCE_DIR = join(SOURCE_PLUGINS[0], 'agents'); // 兼容旧引用/报错信息

const OUT_DIRS = [join(repo, 'skills'), join(repo, 'packages', 'wuji-bundle', 'skills')];

const CHECK = process.argv.includes('--check');
const STATS_ONLY = process.argv.includes('--stats');

// 技能名前缀。改这里就等于改全部 11 个技能的身份。
//
// ⚠️ 历史：源团 12 个 agent 里有 5 个（视觉资产设计师、分镜导演、视频提示词架构师、
// 声音设计与声场架构师、视频剪辑架构师）属于视频创作，用户判定视频侧方案为收费、
// 「付费的一律不做」，故**未建对应主帅、未接入配方**，这 5 个仍以 `wb-` 保留在库。
// 也就是说 `wb-` = 「留存但参谋部选不到」，不是命名遗留。
//
// 接入配方（有主帅族、非付费）的专家用 `wuji-expert-` 前缀；未接入的保持 `wb-`。
const PREFIX = 'wb-';
const PREFIX_ADMITTED = 'wuji-expert-';

// 已接入配方的 WorkBuddy 来源 agent —— 用 wuji-expert- 前缀。
// 判定依据：FAMILY_OF 里有归属 **且** 该族有可用主帅（见 skills/wuji-leader-*）。
//
// ⚠️ 这里必须登记**全部已接入的 agent**。漏登记的后果不是「名字不对」，而是
// 脚本把它重新生成为 wb-<name>，同时把既有的 wuji-expert-<name> 判为孤儿删掉
// —— 已经真实发生过两次（一次删了 64 个，一次删了 5 个）。
//
// 未登记（保持 wb- 留存）的只有视频侧那 5 个付费相关 agent + team-lead，见下。
const ADMITTED = new Set([
  'narrative-architect',
  'image-prompt-architect',
  'precedent-researcher',
  'objective-critic',
  'scoring-expert',
  'skill-evolution-architect',
  'model-dedup', // 新增：software 族，主帅 wuji-leader-software 存在
]);

// 明确**不接入**、以 wb- 留存的 agent（视频侧 5 个属付费，用户判定不做）。
// 这张表的作用是「诚实登记」，避免下次有人误以为漏了。
const NOT_ADMITTED = new Set([
  'visual-asset-designer',
  'storyboard-director',
  'video-prompt-architect',
  'soundstage-architect',
  'video-editing-architect',
  'prompt-meta-team-team-lead',
]);

// ── 角色 → 主帅族归属 ───────────────────────────────────────────────────────
// 这是**人工判定**，不是从源材料推导的 —— WorkBuddy 是单团队（prompt-meta-team），
// 没有「主帅族」这个概念，所以必须逐个指定它在无极里归谁管。
// 判据：该角色的实际产出物属于哪个领域的交付链。
const FAMILY_OF = {
  'prompt-meta-team-team-lead': { family: 'governance', why: '主理人=编排与治理，与 evolution/治理同层' },
  'narrative-architect':        { family: 'writing',    why: '小说推文/片花/漫剧的叙事结构 = 写作域' },
  'image-prompt-architect':     { family: 'image',      why: 'T2I/I2I 元指令 = 图像域' },
  'video-prompt-architect':     { family: 'video',      why: '视频生成提示词 = 视频域' },
  'visual-asset-designer':      { family: 'image',      why: '角色/道具/场景/音色四资产库 = 视觉资产域' },
  'storyboard-director':        { family: 'video',      why: '分镜/蒙太奇/运镜 = 后期与视频域' },
  'soundstage-architect':       { family: 'audio',      why: '声音工程/声场 = 音频域' },
  'video-editing-architect':    { family: 'video',      why: '剪辑 = 后期域' },
  'precedent-researcher':       { family: 'research',   why: '全网参考检索与成品比对 = 调研域' },
  'objective-critic':           { family: 'governance', why: '第三方客观批判 = 治理/审计域' },
  'scoring-expert':             { family: 'governance', why: '量化打分与档位 = 治理/验收域' },
  'skill-evolution-architect':  { family: 'governance', why: 'Skill 资产自进化 = 演化域' },
  // 来源：my-experts/model-dedup（第二个 WorkBuddy 插件来源）
  'model-dedup':                { family: 'software',   why: '模型文件字节级改写与哈希校验 = 软件/工程域（与 software-reverse 同为二进制处理）' },
};

// ── 解析源文件 ──────────────────────────────────────────────────────────────
function parseAgent(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { error: 'no frontmatter' };
  const fmRaw = m[1];
  const body = m[2];

  // 只取本脚本需要的字段。**刻意不用 yaml 库** —— 源文件的 frontmatter 里
  // 有的是未加引号的多行英文 description，交给 yaml 解析反而容易在冒号处断错。
  // 这里按行取，够用且不会误判。
  const name = (fmRaw.match(/^name:\s*(.+)$/m) ?? [])[1]?.trim();
  const zhName = (fmRaw.match(/^\s+zh:\s*"([^"]+)"/m) ?? [])[1];
  const enName = (fmRaw.match(/^\s+en:\s*"([^"]+)"/m) ?? [])[1];
  const maxTurns = (fmRaw.match(/^maxTurns:\s*(\d+)/m) ?? [])[1];
  // description 可能跨行（续行以空格开头），取到下一个顶层 key 为止
  const dm = fmRaw.match(/^description:\s*([\s\S]*?)(?=\r?\ndisplayName:|\r?\nprofession:|\r?\nmaxTurns:|$)/m);
  const description = dm ? dm[1].replace(/\s+/g, ' ').trim() : '';

  if (!name) return { error: 'no name' };
  return { name, zhName, enName, maxTurns, description, body };
}

// ── frontmatter 校验（与宿主规则一致，防写出会被静默丢弃的文件）─────────────
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function validate({ skillName, description }) {
  const errs = [];
  if (!NAME_RE.test(skillName)) errs.push(`技能名不合规: ${skillName}`);
  if (!description || description.length < 10) errs.push('description 缺失或过短');
  // 宿主会显式拒绝整条技能的 camelCase 别名 —— 我们不能写出这种文件
  const body = description;
  for (const legacy of ['disableModelInvocation', 'modelInvocable', 'userInvocable']) {
    if (body.includes(legacy)) errs.push(`description 含被拒绝的遗留键名: ${legacy}`);
  }
  return errs;
}

// 源 agent 名 → 无极技能名（后缀）。未列出的用源名。
//
// ⚠️ 为什么需要这张表：`delegation-manifest.json` 里的配方登记用的是
// **无极侧的名字**（`p3/meta_instruction/skill-evolution`），而 WorkBuddy 源
// agent 叫 `skill-evolution-architect`。不对齐的话，配方引用
// `wuji-expert-skill-evolution`、生成器产出 `wuji-expert-skill-evolution-architect`，
// 两边各留一份、互不相认。
const RENAME = {
  'skill-evolution-architect': 'skill-evolution',
};

function localNameOf(agentName) {
  return RENAME[agentName] ?? agentName;
}

// ── 渲染成 DSH 技能 ─────────────────────────────────────────────────────────
function skillNameOf(agentName) {
  const local = localNameOf(agentName);
  return (ADMITTED.has(agentName) ? PREFIX_ADMITTED : PREFIX) + local;
}

function render(agent, meta) {
  const skillName = skillNameOf(agent.name);
  const zhLabel = agent.zhName ? `${agent.zhName}` : agent.name;
  const enLabel = agent.enName ? ` / ${agent.enName}` : '';

  // description 用中文名 + 领域 + 触发场景，符合宿主「何时加载我」的语义
  const desc = [
    `无极军团专家「${zhLabel}」${enLabel}（${meta.family} 族）：`,
    `${agent.description.slice(0, 240)}`,
  ].join(' ');

  return `---
name: ${skillName}
description: ${desc.replace(/\n/g, ' ')}
kind: expert
family: ${meta.family}
source: workbuddy-${agent.plugin ?? 'prompt-meta-team'}
source_agent: ${agent.name}
display_name_zh: ${zhLabel}
display_name_en: ${agent.enName ?? ''}
max_turns: ${agent.maxTurns ?? '（源未注明）'}
---

# ${zhLabel}（${agent.name}）

> 本文件由 \`scripts/build-workbuddy-roles.mjs\` 从 WorkBuddy \`${agent.plugin ?? 'prompt-meta-team'}\` 的
> 原始 agent 正文生成。**正文内容忠实转录，未改写语义。**
>
> 来源：\`C:\\Users\\Administrator\\.workbuddy\\plugins\\marketplaces\\my-experts\\plugins\\${agent.plugin ?? 'prompt-meta-team'}\\agents\\${agent.name}.md\`
>
> **归属**：${meta.why}。在无极军团中由 \`wuji-leader-${meta.family}\` 主帅按条件引用。

## 原始职责说明

${agent.description}

---

${agent.body.trim()}
`;
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
for (const plugin of SOURCE_PLUGINS) {
  if (!existsSync(join(plugin, 'agents'))) {
    console.error(`[wb-roles] 找不到源目录：${join(plugin, 'agents')}`);
    console.error('  这是 WorkBuddy 的专家原始材料。缺了它无法生成。');
    process.exit(1);
  }
}

const files = [];
for (const plugin of SOURCE_PLUGINS) {
  const agentsDir = join(plugin, 'agents');
  // 记录来源插件名，供 render 写进 frontmatter 的 source 字段
  for (const f of readdirSync(agentsDir).filter((x) => x.endsWith('.md'))) {
    files.push({ file: f, path: join(agentsDir, f), plugin: plugin.split('/').pop() });
  }
}
const agents = [];
const problems = [];

for (const { file: f, path: srcPath, plugin } of files) {
  const raw = readFileSync(srcPath, 'utf8');
  const parsed = parseAgent(raw);
  if (parsed.error) {
    problems.push(`${f}: ${parsed.error}`);
    continue;
  }
  const meta = FAMILY_OF[parsed.name];
  if (!meta) {
    problems.push(`${f}: 未在 FAMILY_OF 中登记归属 —— 请先判定它归哪个主帅族`);
    continue;
  }
  parsed.plugin = plugin;
  const skillName = skillNameOf(parsed.name);
  const desc = `无极军团专家「${parsed.zhName ?? parsed.name}」（${meta.family} 族）： ${parsed.description}`;
  const errs = validate({ skillName, description: desc });
  if (errs.length) {
    problems.push(`${f}: ${errs.join('; ')}`);
    continue;
  }
  agents.push({ file: f, agent: parsed, meta });
}

if (problems.length) {
  console.error('[wb-roles] 源材料有问题，拒绝生成：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(2);
}

if (STATS_ONLY) {
  console.log(`[wb-roles] 可用 agent：${agents.length}`);
  const byFamily = {};
  for (const a of agents) byFamily[a.meta.family] = (byFamily[a.meta.family] ?? 0) + 1;
  for (const [k, v] of Object.entries(byFamily).sort()) console.log(`  ${k}: ${v}`);
  process.exit(0);
}

let written = 0;
let failed = 0;
let mismatched = 0;

for (const { agent, meta } of agents) {
  const skillName = skillNameOf(agent.name);
  const content = render(agent, meta);
  for (const dir of OUT_DIRS) {
    const outDir = join(dir, skillName);
    const outFile = join(outDir, 'SKILL.md');
    if (CHECK) {
      if (!existsSync(outFile)) {
        console.error(`  ✗ 缺失: ${outFile}`);
        failed++;
        continue;
      }
      if (readFileSync(outFile, 'utf8') !== content) {
        console.error(`  ✗ 与源不一致: ${outFile}`);
        mismatched++;
        continue;
      }
    } else {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(outFile, content, 'utf8');
      written++;
    }
  }
}

const total = agents.length * OUT_DIRS.length;
if (CHECK) {
  if (mismatched === 0 && failed === 0) {
    console.log(`[wb-roles] 校验通过：${total} 个文件与源一致`);
    process.exit(0);
  }
  console.error(`[wb-roles] 校验失败：缺失 ${failed}，不一致 ${mismatched}`);
  process.exit(1);
}

console.log(`[wb-roles] 生成 ${written} 个文件（${agents.length} 个 agent × ${OUT_DIRS.length} 个目录）`);

// 清理孤儿：源里已删的 agent，输出目录里还留着的，一并删掉。
//
// ⚠️ 只清「本脚本生成的」目录，判据是 [前缀 + 本脚本 agent 名] 的精确集合，
// **不是** 「凡 wuji-expert- 开头就是我的」。后者会删掉 build-wuji-roles.mjs
// 生成的 64 个 4.0 专家 —— 已经真实发生过一次（132 个目录）。
//
// 两个前缀都要看：某 agent 从 wb- 升为 wuji-expert- 后，旧 wb- 目录也在
// expected 之外，会在这里被一并清掉，避免两个前缀各留一份。
const MANAGED = new Set([
  ...agents.map((a) => PREFIX + a.agent.name),
  ...agents.map((a) => PREFIX_ADMITTED + a.agent.name),
  // 已升为 wuji-expert- 的，旧 wb- 名也要留在受管集合里，才能被清掉
  ...[...ADMITTED].map((n) => PREFIX + n),
]);
const expected = new Set(agents.map((a) => skillNameOf(a.agent.name)));
let removed = 0;

// ── 删除前护栏 ──────────────────────────────────────────────────────────────
// 本脚本只能删「它自己生成的」目录。判据不是前缀，而是：
//   ① 目录名 ∈ MANAGED（= 本脚本 agent 名 + 两种前缀的组合）
//   ② 目录内容确实是本脚本生成的（frontmatter 有 source_agent 字段）
// ② 是关键的兜底：4.0 的 64 个专家是 build-wuji-roles.mjs 生成的，它们的
// frontmatter 没有 source_agent。**没有 ① 就删，曾两次误删（64 个、5 个）。**
function isOwnOutput(dirPath) {
  const f = join(dirPath, 'SKILL.md');
  if (!existsSync(f)) return false;
  try {
    const head = readFileSync(f, 'utf8').slice(0, 600);
    return /^source_agent:\s/m.test(head);
  } catch {
    return false;
  }
}

for (const dir of OUT_DIRS) {
  if (!existsSync(dir)) continue;
  for (const d of readdirSync(dir)) {
    if (!MANAGED.has(d) || expected.has(d)) continue;
    const full = join(dir, d);
    if (!isOwnOutput(full)) {
      console.error(`[wb-roles] ⚠️ 拒绝删除非本脚本产物：${full}`);
      console.error('  （它没有 source_agent 字段，说明来自 build-wuji-roles.mjs）');
      continue;
    }
    rmSync(full, { recursive: true, force: true });
    removed++;
  }
}
if (removed) console.log(`[wb-roles] 清理孤儿目录 ${removed} 个`);
