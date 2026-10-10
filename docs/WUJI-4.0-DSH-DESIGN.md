# 无极军团 4.0 · DSH 模式版设计

> 目标：把 `wuji-legion-codex`（4.0）的**任务优先工作体系**移植成 DSH 的可选择 preset 模式，
> 并遵守一条硬约束：**DSH 官方插件能换的全部换掉，第三方高星能换的也换掉，自己写的越少越好。**

状态：设计稿（尚未实施）。所有权重、替换结论均基于本机实测的 DSH 包清单与源码。

---

## 一、4.0 是什么（源码事实）

从 `wuji-legion-codex@master` 读到的关键事实：

| 维度 | 4.0 的实际做法 |
|---|---|
| 定位 | 自述为「运行在现有 AI 宿主之上的**任务优先工作体系**」，不是模型宿主、不是调度平台 |
| 入口 | 阿极唯一入口，无口令无激活语，默认懒人行动 |
| 能力组织 | 原子能力 + 有界配方，按需加载，不预启动全体专家 |
| 编排 | `阿极 → 参谋部 → 子任务主帅/专家团 → 必要专家 → 主帅汇总 → 参谋部合并 → 阿极交付` |
| 路由 | `delegate` 支持复合子任务，每分支独立选帅；`selection_gap` 局部阻塞 |
| 自建代码 | Rust/SQLite 小辅助（状态、引用、幂等、权限、隔离、恢复）+ Python `tools/wuji4.py` |
| 专家目录 | `catalog/p3/experts.json`（57 项职责）、16 主帅族、21 条配方 |
| 测试 | Rust 201 项 + Python 269 项 |
| 已知缺口 | 官方自述 `prepared_not_executed`、`runtime_admission=false`、`formal_model_experts=0` |

**最关键的发现**：4.0 自己承认「准备契约 ≠ 已执行」，`runtime_admission=false`，`actual_agents_started=0`。
也就是说 4.0 花大力气建的调度层（Rust 调度器、task_circuit、task_scheduler、workspace_graph、DAG 排序）
**在 DSH 上绝大部分是多余的** —— DSH 的 `workflow` / `subagent` / `ralph` 是受支持的运行时真执行。

---

## 二、DSH 原生能力面（实测）

从 `app.asar` 头部解析出 **289 个 `@deepseek-ai/*` 官方包**。与 4.0 需求直接对应的：

| 4.0 需求 | DSH 官方包 | 说明 |
|---|---|---|
| 多子任务 DAG 编排 | `dsh-workflow` + `dsh-tool-workflow` | 脚本化 fan-out，有 phase/pipeline/barrier |
| 子代理委派 | `dsh-tool-subagent` + `dsh-subagent-spawn-in-process` | 原生 spawn/fork，continuable |
| 子代理管理 | `dsh-tool-subagent-control`（含 list-agents） | send_message / interrupt / list |
| 长任务自动续跑 | `dsh-tool-ralph` | maxRounds，自动回合驱动 |
| 会话目标 | `dsh-goal` + `dsh-goal-round-driver` + `dsh-tool-goal` | 持久目标，跨回合 |
| 上下文压缩 | `dsh-compaction-basic` + `dsh-compaction-tool-result-pruner` | 阈值可配 |
| 会话查询/投影 | `dsh-session-query-sqlite` + `dsh-session-projection` + `dsh-session-stats` | **SQLite 原生**，替代自建 Rust/SQLite |
| 技能系统 | `dsh-skill` + `dsh-skill-filesystem` + `dsh-tool-skill` | 原生 SKILL.md 加载 |
| Office 能力 | `dsh-skill-office` + `libreoffice-kit` | **官方 Office 套件**，替代 officecli 适配器 |
| MCP | `dsh-mcp-client` + `dsh-mcp-resources` | 原生 MCP，替代自建连接器 |
| 团队协作 | `dsh-experimental-agent-team` + `dsh-experimental-tool-agent-team` | 官方 agent team |
| 计划模式 | `dsh-plan-mode` + `dsh-tool-*` | 前置契约锁定 |
| 待办 | `dsh-tool-todo` | 任务清单 |
| 交付物 | `dsh-tool-present` + `dsh-client-ui-deliverables` | 官方交付物卡片 |
| 权限 | `dsh-authorization` + `dsh-permission-presets` + `dsh-user-approval` | 原生授权链 |
| 沙箱 | `dsh-sandbox-*` + `dsh-fs-sandbox` + `dsh-bash/pwsh-sandbox` | 原生隔离执行，替代自建隔离 |
| 审查 | ~~`dsh-experimental-auto-review`~~ **本机未安装** | 独立检查改用新起 `subagent`（2026-10-08 实测） |
| 脚本持久会话 | `dsh-tool-pwsh-persistent` / `dsh-tool-bash-persistent` | 保留 shell 状态 |
| 定时 | `dsh-schedule` + `dsh-experimental-schedule-bundle` | 排程 |

**结论：4.0 自建的东西，DSH 官方包里几乎都有对应物。**

---

## 三、替换策略与映射表

### 3.1 三档替换原则

- **A 档 · 官方直换**：DSH 有官方包 → 直接挂载，不写代码。
- **B 档 · 官方组合**：官方有原子但需配置拼装 → 写**配置**（YAML），不写 JS。
- **C 档 · 薄适配**：确实无对应物 → 只写最小 glue，且必须能删。

### 3.2 逐项映射

| # | 4.0 组件 | 4.0 自建量 | DSH 替换 | 档 | 自写量 |
|---|---|---|---|---|---|
| 1 | 阿极入口 / 懒人规则 | SKILL.md 4.3KB | `dsh-persona` config `text` | A | 0 |
| 2 | 参谋部路由（`delegate`） | Python + JSON 目录 | `dsh-tool-workflow` + `subagent` | A/B | 0（让模型按需选，不预建选择器） |
| 3 | 复合子任务 DAG | `task_circuit.go` 20KB + `task_scheduler.go` 9.6KB | `workflow` 的 `pipeline`/`parallel`/`phase` | A | 0 |
| 4 | 主帅/专家族（16 族 57 职责） | `experts.json` 147KB | `dsh-skill-filesystem` 的 SKILL.md 目录 | B | 0（改写成 skill 文件） |
| 5 | 配方（21 条） | `delegation-manifest.json` | SKILL.md 内的 SOP 段落 | B | 0 |
| 6 | 状态/引用/幂等 | Rust + SQLite | `dsh-session-query-sqlite` + `dsh-storage-json` | A | 0 |
| 7 | 隔离执行 | 自建 workspace 隔离 | `dsh-sandbox-windows-acl` + `dsh-fs-sandbox` | A | 0 |
| 8 | 权限/授权 | 自建授权检查 | `dsh-authorization` + `dsh-user-approval` | A | 0 |
| 9 | 证据/回执 | `verify.go` 15KB | 新起 `subagent`（独立复核）+ `dsh-message-feedback`（~~`dsh-experimental-auto-review`~~ 未安装） | A | 0 |
| 10 | 上下文记账 | `context-gate.js` 6.5KB | `dsh-token-meter` + `compaction-*` | A | 0 |
| 11 | 模型路由 | `model-policy.js` 4.3KB | `dsh-agent-default-model` + preset 配置 | A | 0 |
| 12 | Office 交付 | officecli 适配器 + invoke.ps1 | `dsh-skill-office` + `libreoffice-kit` | A | 0 |
| 13 | 演示 | Slidev 源码 + 大 lock | `dashi-ppt` skill（已在本机技能目录） | A | 0 |
| 14 | 飞书 | `feishu-lark` SKILL.md | 本机 `lark-*` 官方 skill 全家桶 | A | 0 |
| 15 | 图像 | `invoke.ps1` + 自建 provider | MCP 或官方 image 能力 | B | 0 |
| 16 | 进化/准入 | `evolution.js` + 准入台账 | 人工 review 流程，不写代码 | — | 0 |
| 17 | 会话目标/续跑 | `wuji4.py` 任务链 | `dsh-goal` + `dsh-tool-ralph` | A | 0 |

### 3.3 结论

**17 项需求中：A 档 13 项、B 档 4 项、C 档 0 项。自写 JS 目标为 0。**

即：新模式版**几乎可以做到零自研代码**，只写一个 preset 的 YAML 配置 + 一组 SKILL.md 文本。

---

## 四、目标架构

```
┌─ DSH presets/ ────────────────────────────────────────────┐
│  preset "无极军团" (order 50)                              │
│                                                           │
│  persona        阿极（4.0 懒人规则 + 白帽 + 11 铁律）      │
│       │                                                   │
│  ── 原生编排面（全部官方包，零自写） ──                    │
│  tool-workflow  复杂任务 DAG / fan-out                    │
│  tool-subagent  子任务委派（spawn / fork, continuable）    │
│  tool-ralph     长任务自动续跑                            │
│  tool-goal      跨回合目标                                │
│  tool-todo      任务清单                                  │
│  tool-present   交付物卡片                                │
│       │                                                   │
│  ── 原生能力面 ──                                         │
│  skill-filesystem  → 按需加载窄专业 SKILL.md              │
│  skill-office      → Word/Excel/PPT（官方 + LibreOffice） │
│  mcp-client        → 外部 MCP                             │
│  session-query-sqlite → 状态/检索                         │
│  sandbox-*         → 隔离执行                             │
│  authorization     → 权限边界                             │
│       │                                                   │
│  ── 隔离边界 ──                                           │
│  其他 preset 不挂载上述任何一项                            │
└───────────────────────────────────────────────────────────┘
```

与原 2.0 模式版的差别：**删掉 `wuji-runtime` isolate realm 和整个 `@wuji/dsh-wuji-host` 包**，
改为直接复用官方行列。

---

## 五、目录结构（目标）

```
dsh-wuji-legion-mode/
├── preset/
│   ├── preset.yml              # name/order/description
│   └── agent.cordis.yml        # 仅 persona + 官方插件行（无自研行）
├── skills/
│   ├── wuji-legion-4-0/SKILL.md     # 4.0 入口（从上游移植，文本）
│   └── wuji-leader-routing/SKILL.md # 主帅/配方摘要（从 leader-routing.md 移植）
├── scripts/
│   ├── build-wuji-preset.mjs   # 生成 profile patch（保留）
│   └── install-local-profile.ps1
└── docs/
    └── WUJI-4.0-DSH-DESIGN.md  # 本文
```

**删除清单**（自研代码，全部由官方包替代）：
`packages/wuji-host/lib/*.js`（20 个模块）、`packages/wuji-bundle/`、`skills/ponytail-*`（14 个，保留 PonyTail 主纲）。

---

## 六、分阶段实施计划

| 阶段 | 内容 | 自写代码 | 验收 |
|---|---|---|---|
| P0 | 只换 persona：把 4.0 规则的阿极入口写进 preset | 0 | 新会话可选中「无极军团」，其他 preset 不受影响 |
| P1 | 挂载官方编排面（workflow/subagent/ralph/goal/todo/present） | 0 | 复杂任务能真实 fan-out 并回执 |
| P2 | 移植 4.0 SKILL.md 与路由摘要为 skill 文件 | 0（文本） | 按需加载，上下文不膨胀 |
| P3 | 卸载自研 host 包与 bundle，验证回归 | 0 | 删除后行为不退化 |
| P4 | 接入官方 Office/飞书/MCP，替换 officecli 与自建适配器 | 0 | 真实产物验证 |

---

## 七、风险与边界

1. **上下文膨胀**：4.0 的 `experts.json` 有 147KB。**不得整包塞进 preset**，必须走 `skill-filesystem` 按需加载。
2. **「有目录 ≠ 已执行」**：4.0 自己都标了 `runtime_admission=false`。新模式版必须用 `workflow`/`subagent` 的真实返回值作证据，不能把 skill 目录当能力证明。
3. **`dsh-experimental-*` 稳定性**：agent-team、auto-review 标记为 experimental，作为可选增强，不进关键路径。**（2026-10-08 实测：本机连一个 `@deepseek-ai/dsh-experimental-*` 包都没装，所以这两项当前是「零可用」，不是「可选增强」。）**
4. **不碰全局配置**：遵守现有铁律十，不改模型/provider/凭据；preset 隔离只影响选中该模式的会话。
5. **PonyTail 归属**：上游是 MIT 的 `DietrichGebert/ponytail`（157.8k star），保留署名与许可证。

---

## 八、与现有 2.0 模式版的关系

现有 2.0 模式版已建成 preset 隔离骨架 + 自研 host 包（20 模块 + 20 测试）。
本设计**不推翻隔离骨架**，只把「自研运行时」换成「官方插件装配」：

- 保留：preset 隔离机制、安装脚本、构建脚本、能力注册表思路。
- 替换：`wuji-host` 自研模块 → 官方 `dsh-*` 包。
- 新增：4.0 的 SKILL.md 文本层（阿极入口 + 路由摘要）。

净效果：**维护面积大幅下降，能力覆盖面上升**，因为官方包由 DSH 自身维护和测试。
