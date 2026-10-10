# 更新日志

本文件记录无极军团模式各版本的实际变更。**只写已经落地并经验证的内容**；
未验证的设计不写入此处，另见 `docs/`。

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
