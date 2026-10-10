#!/usr/bin/env node
/**
 * rewrite-roles-framework.mjs
 *
 * 把 wuji-expert-* / wuji-leader-* 的正文从「结构化字段转录」重写为
 * **统一框架 + 差异化职责**。
 *
 * 框架来源（不是自创）：
 *   官方元指令模板 W5 §2.1（五要素），权威顺序见 4.0 执行计划 L123：
 *     「用户最新约束 → W5/W6 原文与模板 → WorkBuddy 专家团和可核实资料 → …」
 *   模板原文：
 *     # 角色  → 你是什么身份 / 什么专长的专家
 *     # 任务  → 一句话说清要帮我完成什么
 *     # 流程  → 按步骤执行
 *     # 约束  → 必须遵守的规则 / 绝对不能做的事
 *     # 输出  → 用什么格式，包含哪几块
 *   L106 称此结构为「五要素齐全，输出稳定」。
 *   L220 给出更完整版：角色定位、工作流程、输出规范、约束边界、所用 Skill。
 *   WorkBuddy 那 12 份即照此模板产出，故骨架统一。
 *
 * ⚠️ 诚实边界：本重构器**不编造领域内容**。它把源数据里真实存在的、
 *    每条各不相同的字段（goal / inputs / output / acceptance / anti_trigger /
 *    在团里的 assignment）填进统一框架。源数据中同一取值的字段
 *    （process / scope_rule / cancellation）**如实标注为通用契约**，
 *    不伪装成该专家独有。
 *
 * 用法：
 *   node scripts/rewrite-roles-framework.mjs            # 写入（默认）
 *   node scripts/rewrite-roles-framework.mjs --apply    # 写入（build-wuji-roles 调用时用）
 *   node scripts/rewrite-roles-framework.mjs --check    # 只报告差异，不写
 *   node scripts/rewrite-roles-framework.mjs --stats    # 统计
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const SOURCE = 'E:/wuji-projects/wuji-legion-codex-4.0/catalog/p3';
const SKILLS = join(REPO, 'skills');
const BUNDLE = join(REPO, 'packages', 'wuji-bundle', 'skills');

const CHECK = process.argv.includes('--check');
const STATS = process.argv.includes('--stats');
const APPLY = process.argv.includes('--apply');

// ── 载入源数据 ──────────────────────────────────────────────────────────────
const experts = JSON.parse(readFileSync(join(SOURCE, 'experts.json'), 'utf8'));
const compo = JSON.parse(readFileSync(join(SOURCE, 'composition-manifest.json'), 'utf8'));
const deleg = JSON.parse(readFileSync(join(SOURCE, 'delegation-manifest.json'), 'utf8'));

const FE = (r) => (typeof r.five_elements === 'string' ? JSON.parse(r.five_elements) : r.five_elements);

// 专家 → 它在各配方中的职责说明
//
// ⚠️ 实测：85 条 expert_refs 里**只有 4 条**带 `assignment` 字段；其余 81 条
// 只给 `selection`（required / any_intents）。所以 assignment **不是通用字段**，
// 不能假设存在。缺失时回退到该专家自己的 `goal` —— 那是上游真实数据，不是编造。
const STEP_DESC = {
  'p3/selector/code-implementation': '按明确语言与目标接口实现',
};
const assignmentOf = new Map();
for (const rec of deleg.recipes) {
  for (const e of rec.expert_refs ?? []) {
    const base = e.role_id.split('/').pop();
    if (!assignmentOf.has(base)) assignmentOf.set(base, []);
    const required = e.selection?.required !== false && !e.selection?.any_intents;
    assignmentOf.get(base).push({
      recipe: rec.recipe_id,
      assignment: e.assignment ?? null, // 可能为 null，渲染时回退到 goal
      required,
      anyIntents: e.selection?.any_intents ?? [],
    });
  }
}
// 专家 → 所属族
const familiesOf = new Map();
for (const r of compo.roles) {
  const base = r.source_role_id?.split('/').pop() ?? r.role_id?.split('/').pop();
  if (base) familiesOf.set(base, r.families ?? []);
}

// ── 工具 ────────────────────────────────────────────────────────────────────
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

// 从生成文件的 frontmatter 里读出元数据，保留它们（不重新推导，避免引入差异）
function readFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  if (end < 0) return null;
  const block = text.slice(4, end);
  const fm = {};
  for (const line of block.split('\n')) {
    const m = /^([A-Za-z_][\w-]*):\s?(.*)$/.exec(line);
    if (m) fm[m[1]] = m[2].trim();
  }
  return { fm, bodyStart: end + 5 };
}

// ── 专家正文重写 ────────────────────────────────────────────────────────────
function renderExpertBody(base, fm, role) {
  const fe = FE(role);
  const assigns = assignmentOf.get(base) ?? [];
  const fams = (fm.families ?? '').replace(/[\[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  const primary = fm.family ?? fams[0] ?? '';

  const inTeam = assigns.length
    ? assigns.map((a) => {
        // assignment 只有 4/85 条有；缺失时回退到该专家自己的 goal（上游真实数据）
        const what = a.assignment ?? fe.goal ?? '（源数据未注明）';
        const when = a.anyIntents.length ? `，触发意图：${a.anyIntents.join('、')}` : '';
        return `- 配方 \`${a.recipe}\`：${what}${a.required ? '（必需成员）' : '（按需成员）'}${when}`;
      }).join('\n')
    : '- （未在配方中登记）';

  return `# 专家：${base}

> 本文件是**一份职责书**，说明什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 不重复模型本身就会的通用知识。
${fams.length > 1 ? `\n> **共享专家**：被 ${fams.length} 个主帅引用，任何引用它的主帅都可按条件使用，不专属某一个团。\n` : ''}
## 我负责 / 我不负责

**我负责**：${fe.goal ?? '（源数据未注明）'}

**我不负责**：

- ${role.anti_trigger ? `**反触发**：${role.anti_trigger}` : '（源数据未注明反触发条件）'}
- 不属于本职责范围的相邻工作 —— 交由对应专家承接，详见下方「所用 Skill」。

## 输入契约（缺一即 BLOCKED）

**必需输入**：\`${fe.inputs ?? '（源数据未注明）'}\`

上述输入缺任一项时**直接报 \`BLOCKED\` 并说明缺哪项**，不得靠猜测补全。
**猜测输入不是输入**：信息不足时保留 \`unknown\`，不得伪造成已知。

## 在团队中的职责

${inTeam}

## 工作流程

按框架统一为四步（依据官方模板 §2.1「流程」，结合本角色的 goal / acceptance 展开）：

1. **校验输入** — 输入契约齐全？缺失即 \`BLOCKED\`，不进入下一步
2. **执行本职责** — 目标：${fe.goal ?? '（源数据未注明）'}
3. **自检达标** — 验收标准：${fe.acceptance ?? '（源数据未注明）'}
4. **回交** — 产出交给主帅，附路径与 sha256；未消解风险如实列出

> **诚实标注**：上游数据未提供分角色的详细步骤 —— \`process\` 字段对全部 57 条是
> **同一句占位符**（"按 workflow-contracts 当前领域流程…"）。以上四步为**按框架补写**，
> 属通用结构，非该领域的专业操作序列。**专业步骤需由真实执行中的经验补充。**

## 约束

- **验收标准**：${fe.acceptance ?? '（源数据未注明）'}
- **权限（通用契约）**：每个精确引用都需要明确的读写授权；**不推断用户未作出的决定**
- **取消（通用契约）**：返回局部检查点给主帅；外部未知项先查询，原生槽位保留至可信关闭
- **白帽**：缺证据保留 \`unknown\`，禁止越权与伪完成
- **版本**：交付需绑定版本、scope、读写权与回读句柄

> 权限与取消两条来自源数据的**全局约定**（\`scope_rule\` / \`cancellation\` 对所有角色同一取值），
> 是该角色的**底线**而非其专业特色。

## 输出

**产物**：\`${fe.output ?? '（源数据未注明）'}\`

交回主帅时必含：产物路径、sha256、验收标准自查结论、未消解风险（无则明确写"无"）。
不写教程式内容，不复述通用知识。

## 所用 Skill

- \`wb-preflight\` — 产物自检（sha256 绑定、版本标识、跨模型语法混写、禁用空词）
- 通用：\`subagent\` 起真实子代理执行；\`wuji_staff_plan\` 确认写范围是否与他人冲突

> **本节为 DSH 集成层内容，非上游转录。** 上游 \`experts.json\` 中不含
> \`wuji_staff_plan\` / \`subagent\` 等运行时概念（命中 0 次）。

## 交付前自检清单（逐项打勾，不过不交）

- [ ] 输入契约齐全，缺项已报 \`BLOCKED\` 而非猜测补全
- [ ] 产出符合验收标准：${fe.acceptance ?? '（源数据未注明）'}
- [ ] 反触发条件未触发（${role.anti_trigger ?? '未注明'}）
- [ ] 未越权：每个精确引用都有明确读写授权
- [ ] 未消解风险已如实记录
- [ ] 产物路径与 sha256 已给出

## 归属

${fams.length ? fams.map((f) => `- 主帅 \`wuji-leader-${f}\`` + (f === primary ? '（主属）' : '')).join('\n') : '- （未注册）'}

## 诚实标注

逐节说明来源，避免把补写内容读成上游事实：

| 本节内容 | 来源 |
|---|---|
| 我负责 / 我不负责 | 上游 \`goal\` + \`anti_trigger\`（转录） |
| 输入契约 | 上游 \`inputs\`（转录） |
| 在团队中的职责 | 上游 \`delegation-manifest.json\` 的 \`assignment\`（转录） |
| 工作流程 | ⚠️ **本轮按框架补写** |
| 约束 | 上游 \`acceptance\` + 通用 \`scope_rule\` / \`cancellation\` |
| 输出 | 上游 \`output\`（转录） |
| 所用 Skill | ⚠️ **本轮补写**（DSH 集成层，上游无此概念） |
| 交付前自检清单 | ⚠️ **本轮按框架补写** |
| 归属 | 上游配方与主帅数据（转录） |

**转录自上游**（\`catalog/p3/experts.json\`）：goal、inputs、output、acceptance、anti_trigger、scope_rule、cancellation。
**转录自上游**（\`catalog/p3/delegation-manifest.json\`）：配方归属、\`assignment\`、\`domains\`、\`typed_intents\`。

**本轮按框架补写**：正文结构、四步流程、所用 Skill、自检清单。框架依据 = 官方元指令模板
W5 §2.1（角色/任务/流程/约束/输出）；该模板在 4.0 执行计划中的权威顺序为
「W5/W6 原文与模板 ＞ WorkBuddy 专家团 ＞ …」。

上游 \`process\` 字段对全部 57 条是**同一句占位符**，不含真实步骤 ——
故「工作流程」一节**属通用结构，不是该领域的专业操作序列**，专业步骤需由真实执行经验补充。

上游对该目录的整体标注是「契约已写、专业效果未验证」。因此本文件证明的是
**职责已定义且可被选择**，**不证明该职责已被独立验收** —— 实际效果必须以真实产物回交为准。`;
}

// ── 主帅正文重写 ────────────────────────────────────────────────────────────
function renderLeaderBody(base, fm, recipes, expertIndex) {
  const fam = base.replace(/^wuji-leader-/, '');
  const mine = recipes.filter((r) => (r.leader?.family_id ?? '').replace(/^lead\./, '') === fam);
  const recipeBlocks = mine.length
    ? mine.map((r) => {
        const members = (r.expert_refs ?? []).map((e) => {
          const eb = e.role_id.split('/').pop();
          // assignment 仅 4/85 条存在；回退到该专家自己的 goal（上游真实数据）
          const role = roles.get(eb);
          const what = e.assignment ?? (role ? FE(role).goal : null) ?? '（源数据未注明）';
          const req = e.selection?.required !== false && !e.selection?.any_intents;
          const intents = e.selection?.any_intents ?? [];
          const when = intents.length ? `（触发意图：${intents.join('、')}）` : req ? '（必需）' : '';
          return `    - \`wuji-expert-${eb}\`${when} — ${what}`;
        }).join('\n');
        return `- **\`${r.recipe_id}\`**（${(r.domains ?? []).join('、')}）\n` +
          `  - 承接：${r.leader?.responsibility ?? '（未注明）'}\n` +
          `  - 成员：\n${members || '    - （无）'}\n` +
          `  - 验收默认：${(r.acceptance_defaults ?? []).join('、') || '（未注明）'}`;
      }).join('\n')
    : '- （本族无登记配方）';

  return `# 主帅：${fam}

> 本文件是**一份职责书**：说明本族承接什么、怎么组织专家、产出什么、边界在哪。
> 主帅**组织**成员完成交付并汇总回交，**不代写成员制品**。

## 我负责 / 我不负责

**我负责**：承接 \`${fam}\` 领域的子任务，按配方组织本族专家，汇总产物后向参谋部/阿极回交。

**我不负责**：

- **代写成员制品** —— 每个成员的产出必须由其本人回交，主帅不得代笔
- **跨族越权** —— 不属于本族的子任务转交对应主帅
- **编造主帅/专家** —— 找不到承接方时如实报 \`selection_gap\`，只阻塞该分支

## 输入契约（缺一即 BLOCKED）

必须明确：**目标**、**交付物**、**验收条件**、**写入范围**。
缺任一项先澄清，不进入派活。

## 工作流程

1. **接收子任务** — 来自参谋部/阿极，含目标、交付物、验收条件
2. **选配方** — 从下方配方中选匹配的 \`recipe\`；无匹配即报 \`selection_gap\`
3. **组织成员** — 按配方的 \`required\` / 按需 派活；每个成员**必须显式加载其技能**（在派单提示词首行写明「第一步：用 skill 工具加载 …」）
4. **汇总回交** — 收集各成员产物，校验路径与 sha256，汇总为统一交付

## 约束

- **只走配方**：任务路由只认 \`recipe\`（\`leader_assembly: task_recipe_only\`）
- **不代写**：主帅汇总，不产出成员应有的专业制品
- **真子代理**：派活必须真实委派；「已派发」不等于「已完成」，只有产物回交才算完成
- **写集冲突**：写入同一目录或其子目录的子任务不得并发，先查 \`wuji_staff_plan\`
- **白帽**：缺证据保留 \`unknown\`；不得伪完成

## 本族配方

${recipeBlocks}

## 输出

汇总交付需含：各成员产物路径 + sha256、验收结论、未消解风险。
单元级失败不得整体伪装成成功 —— 失败的成员须点名。

## 所用 Skill

- 本族专家技能 \`wuji-expert-*\`（见各配方成员）
- \`wb-preflight\` — 对本族产物做确定性前置检查
- 通用：\`subagent\` 真实派活；\`workflow\` 多步扇出；\`wuji_staff_plan\` 排程与写集冲突判定

## 交付前自检清单（逐项打勾，不过不交）

- [ ] 子任务属于本族，未越权
- [ ] 走了登记配方，未自创路由
- [ ] 成员均**显式加载**了各自技能（不只靠目录存在）
- [ ] 每个产物都有路径 + sha256
- [ ] 未代写任何成员制品
- [ ] 失败成员已点名，未整体伪装成功
- [ ] 未消解风险已如实记录

## 诚实标注

配方、成员、\`assignment\` 与验收默认值**转录自** \`catalog/p3/delegation-manifest.json\`。

**本轮按框架补写**：正文结构与四步流程，框架依据 = 官方元指令模板 W5 §2.1。

上游对该目录的整体标注是「契约已写、专业效果未验证」；本文件证明**组织关系已定义**，
**不证明该族的专业质量已达标**。`;
}

// ── 主流程 ──────────────────────────────────────────────────────────────────
const roles = new Map();
for (const r of experts.roles) roles.set(r.baseline_id, r);

const results = { written: 0, skipped: 0, missing: 0, changed: 0, unchanged: 0 };
const diffs = [];

function processDir(dir, kind) {
  const names = kind === 'expert'
    ? [...roles.keys()].map((b) => `wuji-expert-${b}`)
    : deleg.leader_family_ids.map((f) => `wuji-leader-${f.replace(/^lead\./, '')}`);

  for (const name of names) {
    const p = join(dir, name, 'SKILL.md');
    if (!existsSync(p)) { results.missing++; continue; }
    const text = readFileSync(p, 'utf8');
    const parsed = readFrontmatter(text);
    if (!parsed) { results.skipped++; continue; }
    const head = text.slice(0, parsed.bodyStart);

    let body;
    if (kind === 'expert') {
      const base = name.replace(/^wuji-expert-/, '');
      const role = roles.get(base);
      if (!role) { results.missing++; continue; }
      body = renderExpertBody(base, parsed.fm, role);
    } else {
      body = renderLeaderBody(name, parsed.fm, deleg.recipes, deleg);
    }

    const next = head + body + '\n';
    if (next === text) { results.unchanged++; continue; }
    results.changed++;
    diffs.push(`${name}: ${text.length} → ${next.length} 字符`);
    if (!CHECK && !STATS) {
      writeFileSync(p, next, 'utf8');
      results.written++;
    }
  }
}

processDir(SKILLS, 'expert');
processDir(SKILLS, 'leader');
processDir(BUNDLE, 'expert');
processDir(BUNDLE, 'leader');

if (STATS || CHECK) {
  console.log(`  将改写: ${results.changed}  未变: ${results.unchanged}  缺失: ${results.missing}`);
  diffs.slice(0, 15).forEach((d) => console.log('    ' + d));
  if (diffs.length > 15) console.log(`    … 另有 ${diffs.length - 15} 项`);
} else {
  console.log(`  ✅ 已写入: ${results.written}  未变: ${results.unchanged}  缺失: ${results.missing}`);
}
