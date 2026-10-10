# 更新日志

本文件记录无极军团模式各版本的实际变更。**只写已经落地并经验证的内容**；
未验证的设计不写入此处，另见 `docs/`。

---

## [4.2.0] — 2026-10-10

**角色框架统一**：73 个角色（57 专家 + 16 主帅）正文从「结构化字段转录」
重写为**统一框架 + 差异化职责**。篇幅 1.5–2 KB → 4.3–4.9 KB。

### 框架来源（不是自创）

官方元指令模板 **W5 §2.1**：`# 角色` / `# 任务` / `# 流程` / `# 约束` / `# 输出`，
原文称此结构为「五要素齐全，输出稳定」。

权威顺序见 4.0 执行计划 **L123**：`W5/W6 原文与模板 ＞ WorkBuddy 专家团`；
**L1052** 明确其用途为「**全部角色框架**」。WorkBuddy 12 份专家即照此模板产出。
源文件：`.codex\attachments\…\已粘贴的文本.txt`（34 KB）。

### 新增

- **`docs/ROLE-FRAMEWORK.md`**：框架出处、章节映射、实测数据、诚实边界。
- **`scripts/rewrite-roles-framework.mjs`**：框架渲染器（`--apply` / `--check` / `--stats`）。

### 修复的真实缺陷

1. **框架渲染被覆盖**：渲染曾跑在 `writeFileSync` **之前**，写完即被生成物覆盖回旧结构。
   这正是「重写后又变回旧结构」的根因。现已并入 `build-wuji-roles.mjs` 生成流程。
2. **主帅成员行显示 `undefined`**：实测 `expert_refs` 85 条中**仅 4 条**有 `assignment`。
   已改为缺失时回退到该专家的 `goal`（上游真实数据，非编造）。
3. **`verify-wuji-roles.mjs` 断言旧章节名**，框架改后失效；已更新为新框架六章节。
4. **`--check` 误报 STALE**：改为只比对 frontmatter 段（正文由框架渲染器负责）。

### 诚实边界

- `process` 字段对全部 57 条是**同一占位符**，故「工作流程」一节为**按框架补写**，
  非该领域专业步骤，已在每份文件内标注。
- `scope_rule` / `cancellation` 是**全局契约**，已标注为通用而非该专家独有。
- `所用 Skill` 属 **DSH 集成层**，上游 `experts.json` 无此概念（命中 0 次），已单独标注。
- 上游整体标注「**契约已写、专业效果未验证**」，本改动**不改变**该状态。

### 验证

`verify-all` 全部通过 · frontmatter **101/101** · 三方同步 **73/73** ·
幂等（连跑两次 `未变: 146`）· 实质内容三节 **57/57 全部不同**。

---

## [4.1.0] — 2026-10-10

**融合 WorkBuddy 专家团**：12 个 agent 变成真实 DSH 技能，技能总数 88 → 100。

### 新增

- **`scripts/build-workbuddy-roles.mjs`**：把 WorkBuddy `prompt-meta-team` 的
  agent 正文转成 DSH 技能。与 `build-wuji-roles.mjs` 分开，因为源头格式不同
  （结构化 JSON vs 人写的 Markdown 正文）—— 硬塞进一个脚本只会让两边都变复杂。
  正文**忠实转录，不改写语义**。

- **12 个 `wb-*` 技能**，归属到 6 个主帅族：
  governance 4（范策/镜观/衡分/容知）、video 3（卢影/陆镜/纪叙）、
  image 2（苏墨/顾形）、writing 1（唐砚）、audio 1（声场）、research 1（探源）。

- **`docs/WORKBUDDY-INTEGRATION.md`**：融合说明、归属判据、实测记录、诚实边界。

### 决策记录

- **加 `wb-` 前缀**：WorkBuddy 的 `video-prompt-architect` 与无极的
  `video-production` 职责相邻但不等同（前者是 H3/Seedance 提示词元指令，
  后者是 MusicCue/Shot/Timeline 版本一致与输出）。加前缀让两者**并存可选**，
  而不是互相覆盖。直接沿用原名会制造两套说法。
- **归属是人工判定的**：WorkBuddy 是单团队，本身没有「主帅族」概念。未登记
  归属的新 agent 会被脚本**拒绝生成** —— 不让人在归属不明时把角色塞进军团。

### 验证

- 24 个文件（12 agent × 2 目录）生成并同步，`--check` 一致；
- 中文零乱码（Node 校验，非 pwsh 显示）；
- 宿主规则对拍 **100/100 通过，0 失败**（含新增 12 个）；
- **真派发实测**：`wb-scoring-expert` 完成一次真实模式 C 打分，产物落盘
  10,037 B / 123 行，结论 35/100 · D。

### 诚实边界

**已实测的是 1 个，不是 12 个。** 其余 11 个只验证了「生成正确、格式合规、
可被加载」，**未逐个跑真实任务**。

源材料引用了大量 WorkBuddy 专有机制（`SendMessage` 回传、`rejected_edits.md`
回灌、preflight 12 项）。DSH 侧**没有这些宿主机制**，当前保留原文（因为它描述了
完整协作契约），但**不声称这些机制已接通**。

---

## [4.0.1] — 2026-10-10

四层委派打通、验证资产纳入版本控制、若干虚假声明更正。

### 修复

- **`maxDepth` 导致四层委派被阻断**（`46fa9f2`）
  `tool-subagent` / `tool-subagent-fork` 未设 `maxDepth`，而该字段 schema 默认值为
  `1`（`@deepseek-ai/dsh-subagent/lib/types/index.js:76`）。阿极→参谋部→主帅→专家
  需要 3 层，第 3 跳被拒：`subagent depth 2 exceeds maxDepth 1`。
  两处配置均改为 `maxDepth: 3`，重启后实测通过。

- **生成器缺少前置 frontmatter 校验**（`8bf5638`）
  宿主对畸形 frontmatter 的处理是**静默丢弃，只留 warning**。写完再查等于把缺陷
  发出去才发现。已在 `build-wuji-roles.mjs` 写入前增加校验，覆盖：`---` 分隔符、
  Tab 缩进、YAML 解析错误、`name` 格式（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`）、
  `description` 非空、以及会被宿主**显式拒绝整条技能**的 camelCase 别名
  （`disableModelInvocation` / `modelInvocable` / `userInvocable`）。

- **验证脚本报错顺序与宿主不一致**（`8bf5638`）
  宿主检查顺序为：`name`/`description` 必填 → `isSkillName` → invocation 策略
  （`dsh-skill-filesystem/lib/index.js:679-695`）。原脚本把 legacy 键检查排在最前，
  导致分类顺序与宿主相反。已按宿主顺序重排，88 个真实技能回归 88/88 通过。

- **验证资产游离于版本控制之外**（`1779410`）
  `.gitignore` 的 `*.tmp` 规则使 `.tmp/` 下 **66 个文件 / 9.2 MB** 全部不被跟踪，
  其中包括与宿主对拍的验证套件。**一次清理即不可恢复。**
  已加分层例外规则纳入 **56 个文件 / 152 KB**；大体积二进制仍忽略。

### 文档更正（原文有误，已改）

- **`docs/实现状态.md`**：原文称 preset 里「没有任何 `@wuji/*` 自研行」。
  实际有 1 行 `@wuji/dsh-wuji-staff`。已更正。

- **技能重名判定**：此前判断「`customSkillDirs`（rank 300）会遮蔽 `user-agents`
  （rank 500）」。**该判断错误**，两点事实都不对：
  ① `BUNDLED_SKILL_RANK` 实为 **600**，不是我沿用的 300；
  ② **层级不同时 rank 根本不参与** —— 权威规则是
  「the nearest layer's entry wins a duplicate name outright, and the rank order
  decides duplicates only within one layer」（`dsh-skill/lib/index.js:110-115`）。

- **`dsh-experimental-auto-review` 幻影引用**：该包在本机**不存在**
  （本机未安装任何 `@deepseek-ai/dsh-experimental-*` 包），却被 6 处当作可用能力引用。
  全部改为明确标注「未安装，不可用」，独立复核一律走新起 `subagent`。

- **`provider-managed` 类型隐患**：preset 中 codex / claude-code 两行的
  `maxDepth: provider-managed` 是字符串，而 schema 要求 `z.number()`。
  两行当前均为 `disabled: true`，故**不会触发**；已在原处标注启用前必须先改类型。

### 新增验证

- **四层端到端跑通**（`3e62fb0`）：阿极→参谋部→主帅→专家，专家层首次真实参与，
  回交 2 份报告 + 4 个复现文件。
- **16 个主帅族全部唤醒**（`b7695af`）：每族产出真实产物。

---

## 关于「16 族全部验证」的诚实说明

`b7695af` 的首轮结论是 **14/14 通过**。**该数字是错的。**

判定标准用了主帅自己的报告（正则匹配「技能已加载: 是」「链路: 通」）——
**两项都是被审者的自述**。4 个族压根没提到 `subagent`，也被算作通过。

改用独立审计员重查后的真值：

| 判定 | 数量 |
|---|---|
| 真委派 | **4** |
| 疑似代写 | 9 |
| 无法判定 | 1 |

最清晰的分野：真委派的 4 族都有**独立于 README 的专家产物**；
疑似代写的 9 族除 README 外**一个文件都没有**。

重验 10 族时改变了结构——强制专家自己写 `expert-output.md`，主帅只能写 3 行索引，
再由**未参与生成的独立审计员**判定作者。结果为 **10/10 真专家产物**。

**仍须保留的边界**：字节数吻合不能证明文件由另一进程写出（主帅理论上也能写）。
这是当前可得证据下的最强结论，不是日志级铁证。

---

## [4.0.0] — 2026-10-08

架构级替换：自研运行时全部换成 DSH 官方插件。

### 变更

- **删除自研运行时**（`d9b2526`）：`packages/wuji-host` 的 20 个 lib 模块
  连同 20 个测试文件移除。
- **保留唯一自研插件**（`4f443f0`）：`@wuji/dsh-wuji-staff`（参谋部），
  只做确定性调度 —— 选主帅、排并发、判依赖。保留理由是 workflow 脚本每次需模型
  重新生成，而调度结论必须可复现。由白名单强制管控
  （`scripts/check-wuji-preset.mjs:99`）。
- **白帽融入阿极**（`ee8946e`）：白帽不再是独立角色，**无开关**，
  约束的第一对象是阿极自己。
- **PonyTail 全局化**（`ee8946e`）：写入 `~/.dsh/AGENTS.md`，
  覆盖对话与一切任务，不只代码。
- **persona 字段修正**（`59a6006`）：改用必填的 `prefix`，原 `text` 会导致
  `invalidconfig: $.prefix missing required value` 并使整个 persona 失效。
- **生成 16 主帅 + 57 专家**（`ce294cb`）：从上游 4.0 源数据生成 DSH 技能。

### 修复

- 参谋部入口 import 路径错误，曾导致每个新会话失败（`6cb1ccb`）。
- 两个参谋部工具缺少必需的输出块（`39fd5cf`）。
- 白帽双向标定、参谋部触发条件可判定化（`cd21a49`）。

---

## [2.0.0] — 2026-09-05

面向小白用户的模式升级，结论在 4.0 中继续成立。

- PonyTail 跨域化，成为执行纲领（`8e6f94c`）。
- 边界写清、隔离保留。
- 模式展示页与全局版故事对齐（`b645e32`、`3aeb3b8`）。

---

## 许可与背书

- PonyTail 上游：[`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) · MIT
- 最小化原则：[Martin Fowler · YAGNI](https://martinfowler.com/bliki/Yagni.html)
- 安全开发边界：[NIST SP 800-218 SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
