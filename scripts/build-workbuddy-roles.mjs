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
const SOURCE_DIR =
  'C:/Users/Administrator/.workbuddy/plugins/marketplaces/my-experts/plugins/prompt-meta-team/agents';

const OUT_DIRS = [join(repo, 'skills'), join(repo, 'packages', 'wuji-bundle', 'skills')];

const CHECK = process.argv.includes('--check');
const STATS_ONLY = process.argv.includes('--stats');

// 技能名前缀。改这里就等于改全部 11 个技能的身份。
const PREFIX = 'wb-';

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

// ── 渲染成 DSH 技能 ─────────────────────────────────────────────────────────
function render(agent, meta) {
  const skillName = PREFIX + agent.name;
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
source: workbuddy-prompt-meta-team
source_agent: ${agent.name}
display_name_zh: ${zhLabel}
display_name_en: ${agent.enName ?? ''}
max_turns: ${agent.maxTurns ?? '（源未注明）'}
---

# ${zhLabel}（${agent.name}）

> 本文件由 \`scripts/build-workbuddy-roles.mjs\` 从 WorkBuddy \`prompt-meta-team\` 的
> 原始 agent 正文生成。**正文内容忠实转录，未改写语义。**
>
> 来源：\`C:\\Users\\Administrator\\.workbuddy\\plugins\\marketplaces\\my-experts\\plugins\\prompt-meta-team\\agents\\${agent.name}.md\`
>
> **归属**：${meta.why}。在无极军团中由 \`wuji-leader-${meta.family}\` 主帅按条件引用。

## 原始职责说明

${agent.description}

---

${agent.body.trim()}
`;
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
if (!existsSync(SOURCE_DIR)) {
  console.error(`[wb-roles] 找不到源目录：${SOURCE_DIR}`);
  console.error('  这是 WorkBuddy 的专家团原始材料。缺了它无法生成。');
  process.exit(1);
}

const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.md'));
const agents = [];
const problems = [];

for (const f of files) {
  const raw = readFileSync(join(SOURCE_DIR, f), 'utf8');
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
  const skillName = PREFIX + parsed.name;
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
  const skillName = PREFIX + agent.name;
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

// 清理孤儿：源里已删的 agent，输出目录里还留着的，一并删掉
const expected = new Set(agents.map((a) => PREFIX + a.agent.name));
let removed = 0;
for (const dir of OUT_DIRS) {
  if (!existsSync(dir)) continue;
  for (const d of readdirSync(dir)) {
    if (d.startsWith(PREFIX) && !expected.has(d)) {
      rmSync(join(dir, d), { recursive: true, force: true });
      removed++;
    }
  }
}
if (removed) console.log(`[wb-roles] 清理孤儿目录 ${removed} 个`);
