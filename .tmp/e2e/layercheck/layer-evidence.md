# 四层验证：逐层原始证据

> 记录原则：只记录**实际发生**的调用与返回。未发生的步骤明确标注「未发生」。

## 第 1 层：阿极（结构化需求表）

**任务**：调研 DSH 的 skill 发现机制有哪些已知限制。

| 契约项 | 内容 |
|---|---|
| 目标 | 查清 DSH 的 skill 发现机制在 4.0 无极军团运行时的已知限制 |
| 输入 | 本机 DSH 安装目录、profiles/node_modules/@wuji/dsh-wuji-bundle/skills、项目内 skills/preset 配置 |
| 交付物 | `research-findings.md`（带一手来源与版本适用性的证据清单） |
| 验收 | 每条结论可回溯到一手来源（本地文件路径或实测），无出处项显式标为缺口 |
| 禁止动作 | 不修改 DSH 安装目录与被调研的 skill 文件；不编造结论；不下结论式猜测 |
| 写范围 | 仅 `.tmp/e2e/layercheck/` 目录 |

（此表由阿极在动工前锁定。**说明**：这一步是阿极自己写下的，不是由工具生成，故证据为「本文件即证据」。）

## 第 2 层：参谋部（wuji_staff_plan 实际返回）

调用 `wuji_staff_select(domain=research, typed_intents=[调研, 证据核对, 限制梳理])`：

```
参谋部选定：research-decision
可引用成员：research、knowledge-base-qa
```

调用 `wuji_staff_recipes(domain=research)`：

```
无极军团 4.0 配方表（16 个主帅族，1 条，已按 research 过滤）：
【research】research-decision
  领域：research
  意图：research、source_review、technology_selection、compatibility_analysis
  成员：research、knowledge-base-qa
```

调用 `wuji_staff_plan`（3 个子任务 S1→S2→S3，显式声明 depends_on）：

```
参谋部执行计划：
  第 1 组（串行）：S1
  第 2 组（串行）：S2
  第 3 组（串行）：S3
注：这是构造出的计划，不代表已执行。
```

**判定**：S1/S2/S3 因显式依赖链被正确排为三组串行，未出现「错误并发」。
本工具的返回明确自述「不代表已执行」——即排程是**计划**而非**完成**。

## 第 3 层：主帅（wuji-leader-research 实际加载）

以 `skill` 工具加载 `wuji-leader-research`，**实际返回内容**要点：

- 标题：`主帅：research（lead.research）`；自述「**主帅即专家团**……它是本领域子任务的组织者与汇总者」
- **五要素齐全**：
  - goal：组织研究问题、证据范围、反例和决策回交 ✅
  - inputs：阿极的需求表（子任务目标、输入、交付物、验收、禁止动作、写范围）✅
  - process：5 步（确认验收→按条件选必要成员→交代五要素→交宿主原生 subagent 执行→核对并关闭实例）✅
  - output：产物 + 验证证据 + 未完成项与剩余风险 ✅
  - acceptance：primary-sources-or-known-gap、counterevidence-addressed、version-scope-stated ✅
- **可引用成员（2 个）**：`wuji-expert-knowledge-base-qa`（共享专家）、`wuji-expert-research`（必需）
- 职责边界：**不代写成员制品**，只组织与汇总
- 并发规则：4 条同时满足才并发，且明确要求「用 `wuji_staff_plan` 判定」

**关键差异（对照上次退化成两层的真因）**：本次主帅层是**显式加载 skill 得到的**，
不是仅凭 prompt 描述角色。主帅内容真实存在且含五要素与成员清单。

## 第 4 层：专家（子代理实际产物）

见本目录 `research-findings.md` 与 `research-verify.md`；产物内容与「是否为真实回交」的判定写在本文件末尾与主报告。
