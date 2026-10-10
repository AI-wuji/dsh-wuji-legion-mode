#!/usr/bin/env node
// 从无极军团 4.0 的 catalog/p3 生成 DSH 角色技能文件。
//
// 设计要点：
//   1. **不手写角色文件** —— 66/57 个文件手写既慢又必然格式不一致。
//      源数据改了重跑即可，符合「可随时增加、减少、合并」的要求。
//   2. **归属用 frontmatter 的 family 字段**，不用目录嵌套 ——
//      dsh-skill-filesystem 的发现只有一层深，嵌套目录会让专家全部落空。
//   3. **换掉上游四个恒为 false 的运行时字段**（见 docs/角色格式规范.md）：
//      runtime_admission/effectiveness/active_release/cold_reason 在 4.0 里
//      57/57 都是 false/not_run，照搬会让模型以为专家不可用而不敢派。
//
// 用法：
//   node scripts/build-wuji-roles.mjs           生成
//   node scripts/build-wuji-roles.mjs --check   校验生成物与源数据一致
//   node scripts/build-wuji-roles.mjs --stats   只看统计

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = 'E:/wuji-projects/wuji-legion-codex-4.0/catalog/p3';

// 角色文件输出到 bundle 的 skills 下（随 preset 挂载），同时也进仓库 skills/。
const OUT_DIRS = [
  join(repo, 'skills'),
  join(repo, 'packages', 'wuji-bundle', 'skills'),
];

// 正文框架：委托给 rewrite-roles-framework.mjs（单一来源，避免两遍分叉）。
//
// ⚠️ 历史教训：框架渲染曾是**独立的一遍**（build 生成 → rewrite 重写），
// 结果 verify-all.mjs 跑 build-wuji-roles.mjs 时把重写内容**覆盖回旧结构**，
// 且当时误判为「重写失败」。现在渲染并入生成流程，生成即所得，不会再分叉。
const FRAMEWORK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'rewrite-roles-framework.mjs');

const CHECK = process.argv.includes('--check');
const STATS_ONLY = process.argv.includes('--stats');

// ── 读源数据 ────────────────────────────────────────────────────────────────
function readSource() {
  const expertsPath = join(SOURCE_ROOT, 'experts.json');
  const delegationPath = join(SOURCE_ROOT, 'delegation-manifest.json');
  if (!existsSync(expertsPath) || !existsSync(delegationPath)) {
    console.error(`[wuji-roles] 找不到 4.0 源数据：${SOURCE_ROOT}`);
    console.error('  需要的文件：experts.json、delegation-manifest.json');
    process.exit(1);
  }
  return {
    experts: JSON.parse(readFileSync(expertsPath, 'utf8')),
    delegation: JSON.parse(readFileSync(delegationPath, 'utf8')),
  };
}

// ── 非本生成器产出的角色（WorkBuddy 专家团复刻）────────────────────────────
// 这些角色来自 WorkBuddy `prompt-meta-team`，**不来自** `catalog/p3`。
// 本生成器不渲染它们，因此：
//   ① 清理阶段必须跳过，否则每次 build 都会删掉（曾真实发生，6 个专家被删）；
//   ② 一致性检查必须跳过，否则会误报 ORPHAN。
// 它们的真源是 `skills/` 里的手写/半手工文件 + `delegation-manifest.json` 的配方登记。
const FOREIGN = new Set([
  'wuji-expert-narrative-architect',
  'wuji-expert-image-prompt-architect',
  'wuji-expert-precedent-researcher',
  'wuji-expert-objective-critic',
  'wuji-expert-scoring-expert',
  'wuji-expert-skill-evolution',
]);

// ── 建立索引 ────────────────────────────────────────────────────────────────
function buildIndex({ experts, delegation }) {
  // 角色 id -> 角色定义
  const roleById = new Map(experts.roles.map((r) => [r.id, r]));

  // 角色 id -> 引用它的配方（用于推导 domain / typed_intents / family）
  const roleRefs = new Map();
  for (const recipe of delegation.recipes) {
    for (const ref of recipe.expert_refs) {
      if (!roleRefs.has(ref.role_id)) roleRefs.set(ref.role_id, []);
      roleRefs.get(ref.role_id).push({
        recipe_id: recipe.recipe_id,
        domains: recipe.domains ?? [],
        typed_intents: recipe.typed_intents ?? [],
        family: recipe.leader.family_id,
        leader_id: recipe.leader.id,
        assignment: ref.assignment,
        required: ref.selection?.required === true,
        acceptance_defaults: recipe.acceptance_defaults ?? [],
      });
    }
  }

  return { roleById, roleRefs };
}

// ── 从 family_id 推导短名（lead.software -> software）──────────────────────
const shortFamily = (familyId) => String(familyId).replace(/^lead\./, '');

// ── 生成一个主帅文件 ────────────────────────────────────────────────────────
function renderLeader(familyId, recipes, index) {
  const short = shortFamily(familyId);
  const first = recipes[0];
  const leaderId = first.leader.id;

  // 该族统辖的全部角色
  const roles = new Set();
  for (const r of recipes) for (const e of r.expert_refs) roles.add(e.role_id);

  // 该族的全部 domain / intent（用于参谋部匹配）
  const domains = [...new Set(recipes.flatMap((r) => r.domains ?? []))].sort();
  const intents = [...new Set(recipes.flatMap((r) => r.typed_intents ?? []))].sort();

  // 每个配方一个 stage
  const recipeSections = recipes.map((r) => {
    const members = r.expert_refs.map((e) => {
      const base = index.roleById.get(e.role_id)?.baseline_id ?? e.role_id;
      return `  - \`wuji-expert-${base}\`${e.selection?.required ? '（必需）' : '（按需）'} — ${e.assignment ?? '（未注明）'}`;
    });
    return [
      `### 配方 \`${r.recipe_id}\``,
      '',
      `- **负责人**：\`${r.leader.id}\``,
      `- **职责**：${r.leader.responsibility ?? '（未注明）'}`,
      `- **领域**：${(r.domains ?? []).join('、') || '（未注明）'}`,
      `- **类型意图**：${(r.typed_intents ?? []).join('、') || '（未注明）'}`,
      `- **默认验收**：${(r.acceptance_defaults ?? []).join('、') || '（未注明）'}`,
      '- **成员**：',
      ...members,
      '',
    ].join('\n');
  });

  const callable = [
    `当子任务的领域命中 ${domains.map((d) => `\`${d}\``).join('、')}，`,
    `或类型意图命中 ${intents.slice(0, 6).map((i) => `\`${i}\``).join('、')}${intents.length > 6 ? ' 等' : ''} 时承接。`,
    '由参谋部按 domain=3 / typed_intent=2 打分选择；无匹配或最高分并列时返回 selection_gap，',
    '此时只阻塞该分支，不得全能力兜底。',
  ].join('');

  const description = [
    `无极军团 4.0 主帅「${short}」专家团：`,
    `承接 ${domains.slice(0, 4).join('/') || '本族'} 领域的子任务。`,
    `当任务涉及 ${domains.slice(0, 3).join('、') || '本族领域'} 时加载本文件。`,
    `它组织本族专家完成交付并汇总回交，不代写成员制品。`,
  ].join('');

  return `---
name: wuji-leader-${short}
description: ${description}
kind: leader
family: ${short}
source_family_id: ${familyId}
leader_id: ${leaderId}
recipes: [${recipes.map((r) => r.recipe_id).join(', ')}]
---

# 主帅：${short}（${familyId}）

> **主帅即专家团。** 它不是额外的指挥层，而是本领域子任务的组织者与汇总者。
> 它按子任务条件**只引用必要的成员**，未用成员保持冷态 —— 不默认加载全部候选。

## 五要素

- **goal**：${first.leader.responsibility ?? `组织本族子任务的拆解、执行与回交`}
- **inputs**：阿极的需求表（子任务目标、输入、交付物、验收、禁止动作、写范围）
- **process**：
  1. 确认本子任务的目标与验收，缺口回交阿极，不自行推断用户决定
  2. 按条件选择**必要**成员，不加载全部候选
  3. 把成员的具体目标、输入、产物位置、验收、禁止动作、写范围一并交代
  4. 交由宿主原生 \`subagent\` 实际执行（不能只给角色名称）
  5. 核对该成员本次要求，完成则关闭实例；失败则沿依赖使受影响下游失效
- **output**：本子任务的产物 + 验证证据 + 未完成项与剩余风险
- **acceptance**：${[...new Set(recipes.flatMap((r) => r.acceptance_defaults ?? []))].join('、') || '范围未扩大、结论有证据、相关检查已执行'}

## 职责边界

- **anti_trigger**：${roles.size === 0 ? '（本族暂无成员）' : '本族领域之外的任务不承接；成员能独立完成的小改动不升级到本主帅；不代替阿极理解用户目标'}
- **scope_rule**：只组织与汇总，**不代写成员制品**；每个精确引用都需要读写授权，不推断用户决定
- **cancellation**：把局部检查点回交阿极；外部未知项保留原生槽位直到可信关闭

## 可引用成员（${roles.size} 个）

${[...roles].sort().map((id) => {
  const base = index.roleById.get(id)?.baseline_id ?? id;
  const owner = index.roleRefs.get(id) ?? [];
  const shared = new Set(owner.map((r) => r.family)).size > 1;
  return `- \`wuji-expert-${base}\`${shared ? '（共享专家）' : ''}`;
}).join('\n')}

## 配方（${recipes.length} 条）

${recipeSections.join('\n')}

## DSH 运行时

- **callable**：${callable}
- **tools**：\`subagent\`（派出成员）、\`workflow\`（多成员并发时）、\`wuji_staff_plan\`（排并发分组）

## 并发规则

多个成员**仅在同时满足**以下条件时可并发：

1. 各自有**独立产物**
2. 依赖已满足
3. **写集不冲突**（同一目录或其子目录视为冲突）→ 用 \`wuji_staff_plan\` 判定
4. 共享并发槽允许

不为并发而拆分无独立交付物的步骤。`;
}

// ── 生成一个专家文件 ────────────────────────────────────────────────────────
function renderExpert(role, refs, index) {
  const base = role.baseline_id;
  const fe = role.five_elements ?? {};
  const families = [...new Set(refs.map((r) => r.family))];
  const primaryFamily = shortFamily(families[0]);
  const domains = [...new Set(refs.flatMap((r) => r.domains))].sort();
  const intents = [...new Set(refs.flatMap((r) => r.typed_intents))].sort();

  // 上游确实存在**共享专家**：14 个专家被多个族引用，
  // 例如 delivery-acceptance 被 bugfix/office/business/publish 四族共用。
  // 这是 4.0 的设计（「主帅按条件只引用必要的共享专家职责」），不是数据错误，
  // 因此必须如实表达，不能强行归属到单一主帅名下。
  const isShared = families.length > 1;

  const description = [
    `无极军团 4.0 专家「${base}」（${role.kind}）：`,
    `${fe.goal ?? '本职责范围内的工作'}。`,
    `当子任务需要 ${fe.goal ?? base}，且属于 ${domains.slice(0, 3).join('、') || '本领域'} 时加载。`,
  ].join('');

  const callable = [
    `当子任务的目标是「${fe.goal ?? base}」且领域属于 ${domains.map((d) => `\`${d}\``).join('、') || '本族'} 时被主帅引用。`,
    role.anti_trigger ? `反触发：${role.anti_trigger}` : '',
  ].filter(Boolean).join('');

  const ownershipLines = families.map((f) => {
    const short = shortFamily(f);
    const isPrimary = short === primaryFamily;
    const why = refs.find((r) => r.family === f);
    return `- 主帅 \`wuji-leader-${short}\`（${f}）${isPrimary && isShared ? ' —— **主属**' : ''}` +
      `${why ? `\n    - 配方 \`${why.recipe_id}\`（${why.required ? '必需成员' : '按需成员'}）` : ''}`;
  }).join('\n');

  return `---
name: wuji-expert-${base}
description: ${description}
kind: expert
role_kind: ${role.kind}
family: ${primaryFamily}
families: [${families.map(shortFamily).join(', ')}]
shared: ${isShared}
baseline_id: ${base}
design_target: ${role.design_target ?? '（未注明）'}
source_id: ${role.id}
---

# 专家：${base}

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。
${isShared ? `\n> **本角色是共享专家**，被 ${families.length} 个主帅引用。任何引用它的主帅都可以按条件使用它，\n> 它不专属于某一个团。\n` : ''}
## 五要素

- **goal**：${fe.goal ?? '（源数据未注明）'}
- **inputs**：${fe.inputs ?? '（源数据未注明）'}
- **process**：${fe.process ?? '（源数据未注明）'}
- **output**：${fe.output ?? '（源数据未注明）'}
- **acceptance**：${fe.acceptance ?? '（源数据未注明）'}

## 职责边界

- **anti_trigger**：${role.anti_trigger ?? '（源数据未注明）'}
- **scope_rule**：${role.scope_rule ?? '（源数据未注明）'}
- **cancellation**：${role.cancellation ?? '（源数据未注明）'}

## 归属${isShared ? '（共享，' + families.length + ' 个主帅）' : ''}

${ownershipLines}

## DSH 运行时

- **callable**：${callable}
- **tools**：\`subagent\` 起真实子代理执行；读 \`wuji_staff_plan\` 确认自己的写范围是否与他人冲突
- **domains**：${domains.join('、') || '（未注明）'}
- **typed_intents**：${intents.join('、') || '（未注明）'}

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 \`catalog/p3/experts.json\`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。`;
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
const source = readSource();
const index = buildIndex(source);
const { delegation } = source;

// 按族聚合配方
const byFamily = new Map();
for (const recipe of delegation.recipes) {
  const fam = recipe.leader.family_id;
  if (!byFamily.has(fam)) byFamily.set(fam, []);
  byFamily.get(fam).push(recipe);
}

const files = new Map(); // 相对文件名 -> 内容

for (const [familyId, recipes] of byFamily) {
  const short = shortFamily(familyId);
  files.set(`wuji-leader-${short}/SKILL.md`, renderLeader(familyId, recipes, index));
}

for (const role of source.experts.roles) {
  const refs = index.roleRefs.get(role.id) ?? [];
  if (refs.length === 0) {
    console.error(`[wuji-roles] 角色 ${role.id} 未被任何配方引用，跳过（需先修源数据）`);
    continue;
  }
  files.set(`wuji-expert-${role.baseline_id}/SKILL.md`, renderExpert(role, refs, index));
}

const leaderCount = [...files.keys()].filter((f) => f.startsWith('wuji-leader-')).length;
const expertCount = [...files.keys()].filter((f) => f.startsWith('wuji-expert-')).length;

console.log(`[wuji-roles] 主帅 ${leaderCount} 个，专家 ${expertCount} 个，共 ${files.size} 个角色文件`);

if (STATS_ONLY) {
  console.log('');
  console.log('各族成员数：');
  for (const [f, recs] of byFamily) {
    const roles = new Set(recs.flatMap((r) => r.expert_refs.map((e) => e.role_id)));
    console.log(`  ${shortFamily(f).padEnd(12)} ${String(roles.size).padStart(2)} 个成员 / ${recs.length} 条配方`);
  }
  process.exit(0);
}

// ── 写入或校验 ──────────────────────────────────────────────────────────────

// 生成前先自检：用与 host 同一个 yaml 包解析每个文件的 frontmatter。
// 为什么放在写入之前：host 对畸形 frontmatter 的处理是「整条 skill 静默消失」
// （只留一条 warning），写完再查等于把缺陷发出去才发现。前置校验拦在源头。
// 这是「前置限制 > 后置验证」的一次具体落地。
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEGACY_KEYS = ['disableModelInvocation', 'modelInvocable', 'userInvocable'];

function validateFrontmatter() {
  let yamlParse;
  // 项目目录解析不到 yaml（未安装），故显式从 DSH profiles 的 node_modules 解析。
  // 必须与 host 用同一个包，否则解析行为可能不同，前置校验就失去意义。
  const req = createRequire(pathToFileURL(join(repo, 'noop.js')));
  for (const candidate of [
    'C:/Users/Administrator/.dsh/profiles/node_modules/yaml',
    'yaml',
  ]) {
    try {
      ({ parse: yamlParse } = req(candidate));
      break;
    } catch { /* 继续找下一个候选 */ }
  }
  if (!yamlParse) {
    console.error('[wuji-roles] 找不到 yaml 包，无法做前置 frontmatter 校验。');
    console.error('  项目目录解析不到 yaml，请从 DSH profiles 的 node_modules 解析。');
    process.exit(3);
  }

  const problems = [];
  for (const [rel, content] of files) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    if (!m) { problems.push(`${rel}: 缺少 frontmatter 分隔符`); continue; }
    const raw = m[1];

    for (const line of raw.split(/\r?\n/)) {
      if (/^[\t]/.test(line) || /^[ ]*\t/.test(line)) {
        problems.push(`${rel}: 缩进含 Tab（host 会解析失败）`);
        break;
      }
    }

    let doc;
    try {
      doc = yamlParse(raw);
    } catch (e) {
      problems.push(`${rel}: frontmatter 不是合法 YAML —— ${String(e.message).split('\n')[0]}`);
      continue;
    }
    if (doc === null || typeof doc !== 'object') {
      problems.push(`${rel}: frontmatter 不是键值映射`);
      continue;
    }

    const name = doc.name;
    if (typeof name !== 'string' || !NAME_RE.test(name)) {
      problems.push(`${rel}: name 不合法（${JSON.stringify(name)}），须匹配 ${NAME_RE}`);
    }
    if (typeof doc.description !== 'string' || doc.description.trim() === '') {
      problems.push(`${rel}: description 缺失或为空`);
    }
    for (const key of LEGACY_KEYS) {
      if (key in doc) {
        problems.push(`${rel}: 用了驼峰别名 ${key}；host 会【拒绝整条 skill】，须写连字符形式`);
      }
    }
  }

  if (problems.length) {
    console.error(`[wuji-roles] 前置校验失败，共 ${problems.length} 条，未写入任何文件：`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(4);
  }
  console.log(`[wuji-roles] 前置校验通过：${files.size} 个文件的 frontmatter 均为合法且 host 可接受`);
}

validateFrontmatter();

let mismatched = 0;

for (const outDir of OUT_DIRS) {
  if (CHECK) {
    for (const [rel, content] of files) {
      const target = join(outDir, rel);
      if (!existsSync(target)) {
        console.error(`  MISSING ${target}`);
        mismatched += 1;
        continue;
      }
      const actual = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
      // 只比对 frontmatter 段：正文由 rewrite-roles-framework.mjs 渲染，
      // 生成器手里的 content 只有 frontmatter。全文件比对会把正文判成 STALE（假阳性）。
      const cut = (s) => {
        const e = s.indexOf('\n---\n', 4);
        return e < 0 ? s : s.slice(0, e + 5);
      };
      if (cut(actual) !== cut(content)) {
        console.error(`  STALE   ${target}`);
        mismatched += 1;
      }
    }
    // 检查是否有孤儿角色文件（源数据里已删，生成物还在）
    for (const entry of readdirSync(outDir)) {
      if (FOREIGN.has(entry)) continue;
      if (!entry.startsWith('wuji-leader-') && !entry.startsWith('wuji-expert-')) continue;
      if (!files.has(`${entry}/SKILL.md`)) {
        console.error(`  ORPHAN  ${join(outDir, entry)}（源数据中已不存在）`);
        mismatched += 1;
      }
    }
  } else {
    // 先清掉旧的生成物（只清带前缀的，不动其他技能）
    // ⚠️ 例外见模块级 FOREIGN 的注释。
    for (const entry of readdirSync(outDir)) {
      if (FOREIGN.has(entry)) continue;
      if (entry.startsWith('wuji-leader-') || entry.startsWith('wuji-expert-')) {
        rmSync(join(outDir, entry), { recursive: true, force: true });
      }
    }
    for (const [rel, content] of files) {
      const target = join(outDir, rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, 'utf8');
    }
  }
}

if (CHECK) {
  if (mismatched) {
    console.error(`[wuji-roles] 校验失败：${mismatched} 处与源数据不一致，请重跑 build-wuji-roles.mjs`);
    process.exit(1);
  }
  console.log('[wuji-roles] 校验通过：所有角色文件与 4.0 源数据一致。');

  // --check 也要验证正文框架，否则「frontmatter 对但正文是旧结构」会静默通过。
  execFileSync(process.execPath, [FRAMEWORK_PATH, '--check'], { stdio: 'inherit', cwd: repo });
} else {
  // ── 正文按官方框架渲染 ────────────────────────────────────────────────────
  // 必须在**文件写入之后**执行：写在前一步会被随后的 writeFileSync 覆盖回旧结构。
  // （这正是本脚本早先的 bug —— 框架渲染放在写入之前，看起来像「重写失败」，
  //   实际是被生成物覆盖。见 docs/ROLE-FRAMEWORK.md。）
  const fw = execFileSync(process.execPath, [FRAMEWORK_PATH, '--apply'], { cwd: repo, encoding: 'utf8' });
  process.stdout.write(fw);
  console.log(`[wuji-roles] 已写入 ${OUT_DIRS.map((d) => d.replace(repo, '.')).join(' 与 ')}`);
}
