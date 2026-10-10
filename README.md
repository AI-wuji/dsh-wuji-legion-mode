# 无极军团模式 4.0 · dsh-wuji-legion-mode

> **让不懂 Skill、插件、MCP 是什么的小白，只用人话提出要求；进入这个模式后，无极军团自动调齐合适的能力把事情办成，而且越用越强。**

这是无极军团的 **DSH 可选择、独占、隔离运行模式**。它和同一账号下的 [`dsh-wuji-legion-global`](https://github.com/AI-wuji/dsh-wuji-legion-global) 有同一个初衷：让用户不必理解底层能力，就能用自然语言驱动一支有组织、有纪律、能协作和交付的智能体军团。

区别只有一个，但非常重要：

| 项目 | 全局版 `dsh-wuji-legion-global` | 当前模式版 |
|---|---|---|
| 定位 | 无极军团整体的系统设计、研究、能力目录和长期演进 | DSH 中可以直接选择并运行的 preset |
| 生效范围 | 描述全局架构与建设方向 | 只有用户选择“无极军团模式”的新会话 |
| 对其他模式影响 | 不负责运行时隔离 | 不修改、不污染其他 DSH 模式 |
| 主要问题 | 无极军团为什么这样设计、如何持续建设 | 用户进入模式后，如何让军团真正开始工作 |

## 4.0 更新说明

这次 4.0 是一次**架构级替换**：把自研运行时全部换成 DSH 官方插件，只保留一个自研插件。

- **删除全部自研运行时**：`packages/wuji-host` 的 20 个 lib 模块（任务图、投影、模型路由、上下文门控、委派门禁……）连同其 20 个测试文件一并移除。
- **唯一保留的自研插件**：`@wuji/dsh-wuji-staff`（参谋部）。它只做**确定性调度**——选主帅、排并发、判依赖，原本用 workflow 脚本写。保留理由是：脚本每次都要模型重新生成，而调度结论必须可复现。此包由校验脚本白名单强制管控（`scripts/check-wuji-preset.mjs:99`），白名单外的 `@wuji/*` 一律拒绝。
- **改挂官方插件**：复杂任务编排交给 `dsh-tool-workflow` + `dsh-tool-subagent`，长任务用 `dsh-tool-ralph`，跨回合目标用 `dsh-tool-goal`，交付回执用 `dsh-tool-present`。
- **对齐上游 4.0 的任务优先体系**：阿极唯一入口、懒人行动、白帽判断、证据优先、按需加载窄专业能力。
- **净效果**：自研面收敛到一个调度插件，preset 其余全是官方行 + persona；维护面积大幅下降，能力覆盖面反而上升。

详细设计见 [`docs/WUJI-4.0-DSH-DESIGN.md`](docs/WUJI-4.0-DSH-DESIGN.md)，逐版本变更见 [`CHANGELOG.md`](CHANGELOG.md)。

## WorkBuddy 专家团融合

已把 WorkBuddy `prompt-meta-team` 的 **12 个 agent** 真融合进军团，作为 `wb-*` 开头的
DSH 技能随 preset 挂载。技能总数 **88 → 100**。

| 中文名 | 技能 | 族 | 领域 |
|---|---|---|---|
| 范策 | `wb-prompt-meta-team-team-lead` | governance | 元指令总架构与编排 |
| 唐砚 | `wb-narrative-architect` | writing | 小说推文/漫剧叙事结构 |
| 苏墨 | `wb-image-prompt-architect` | image | T2I/I2I 图像提示词 |
| 卢影 | `wb-video-prompt-architect` | video | H3 / Seedance 视频提示词 |
| 顾形 | `wb-visual-asset-designer` | image | 四资产库与一致性协议 |
| 陆镜 | `wb-storyboard-director` | video | 分镜/蒙太奇/运镜 |
| 声场 | `wb-soundstage-architect` | audio | 声音工程与声场 |
| 纪叙 | `wb-video-editing-architect` | video | 剪辑与节奏 |
| 探源 | `wb-precedent-researcher` | research | 全网参考与成品比对 |
| 镜观 | `wb-objective-critic` | governance | 第三方客观批判 |
| 衡分 | `wb-scoring-expert` | governance | 量化打分与档位 |
| 容知 | `wb-skill-evolution-architect` | governance | 能力资产演化 |

**已实测派发**：`wb-scoring-expert` 对一份元指令草案做了真实模式 C 打分，产物落盘
10,037 B / 123 行，结论 35/100 · D。它主动指出输入契约缺 sha256 与 preflight、
自行降级为 `NO_PREFLIGHT`、并做了档位稳健性检验。**其余 11 个只验证了生成与加载，
未逐个跑真实任务。**

源材料改动后重跑 `node scripts\build-workbuddy-roles.mjs` 即可，不需要手写技能文件。
详见 [`docs/WORKBUDDY-INTEGRATION.md`](docs/WORKBUDDY-INTEGRATION.md)。

## 2.0 历史说明

2.0 在原有模式上完成了一次面向小白用户的升级（PonyTail 跨领域化、边界写清、隔离保留）。这些结论在 4.0 中继续成立，只是运行时实现换成了官方插件。

## 一句话

用户只需要说：

> “把这个表格整理成一份 PPT，再发到指定群里。”

模式会根据目标自动判断需要哪些能力、是否需要拆解任务、哪些步骤可以并行，以及最终如何验证和回执。用户不需要手动选择 Skill、插件或 MCP。

## 这不是又一个多智能体框架

通用框架给开发者积木；无极军团模式给最终用户一份已经建制好的运行契约：

```text
用户用人话提出目标
        ↓
阿极：理解目标、澄清边界、维护需求、汇报结果
        ↓
PonyTail：先判断是否需要做、优先复用、选择最小正确路径
        ↓
按需拆分（仅对确实复杂的任务）
        ↓
官方原生编排：workflow / subagent / ralph / goal
        ↓
窄专业能力：按需加载 SKILL.md（代码/调研/写作/文档/数据/演示/飞书）
```

简单任务走短路径；复杂任务才展开。**不再自建调度层** —— 编排、委派、隔离、权限、压缩全部由 DSH 官方插件承担。

## 三个核心价值

### 1. 系统级无感调用

用户不需要知道“应该调用哪个 Skill”。模式根据自然语言目标选择飞书、搜索、写作、数据、演示、浏览器或开发能力，并保持必要的授权和副作用边界。

### 2. PonyTail 作为跨领域行动前置

PonyTail 不只用于代码。代码、调研、写作、文档、数据、演示、浏览器和飞书任务都遵循同一条最小正确行动原则：先确认目标，再复用已有资源，优先平台原生和已安装能力，最后才新增最小实现。

“少做”不能绕过授权、白帽安全、输入校验、错误处理、数据保护、可访问性、必要验证或完成证据。

### 3. 越用越强，但不靠堆叠

模式保留任务状态、反馈、记忆和行为探针。能力演化必须有证据、可回滚；不把未经验证的 README、标签或自我声明当成能力已经生效。

## 运行边界

### 选择无极军团模式后

- 加载阿极 persona、军团铁律和 PonyTail 常驻规则；
- 挂载官方编排面：`tool-workflow`、`tool-subagent` / `tool-subagent-fork`、`tool-ralph`、`tool-goal`、`tool-todo`、`tool-present`；
- 按任务需要加载领域适配器（PonyTail 系列）与 4.0 入口技能（`wuji-legion-4-0`、`wuji-leader-routing`）；
- 简单任务由阿极直接完成，复杂任务才拆分并委派；
- 产出物必须带完成证据：**「已派发」不等于「已完成」**，子 agent 的中间步骤不算证据。

### 没有选择这个模式时

- 不加载军团 persona、铁律、PonyTail 模式规则或军团技能；
- 不修改 Desktop 默认 preset，也不把军团组件写入其他模式；
- 其他 DSH 模式继续使用自己的 preset、插件和工作方式。

这是 DSH 的 preset 级隔离，不提供已开始会话的热切换。

## 设计原则：不造轮子

4.0 最重要的一条工程约束是**不重复实现宿主已有的能力**。本模式因此：

- **不建调度平台**：编排用 `workflow`，委派用 `subagent`，续跑用 `ralph`；
- **不建隔离层**：沙箱、权限、审批复用 DSH 原生实现；
- **不建状态库**：会话状态与检索用 `dsh-session-query-sqlite`；
- **不建上下文记账**：用 `dsh-token-meter` + `compaction-*`；
- **不自建专家进程**：窄专业能力写成 SKILL.md，按需加载，冷态零成本。

上游 4.0 的 Rust/SQLite 调度辅助（`task_circuit.go`、`task_scheduler.go`、`workspace_graph.go` 等）
在 DSH 上由官方插件承接；上游自述的 `runtime_admission=false`、`prepared_not_executed`
在本模式里被真实执行替代 —— 因为 DSH 的 `workflow` / `subagent` 是受支持的运行时真执行。

## 背书与边界

- 全局设计参照：[`dsh-wuji-legion-global`](https://github.com/AI-wuji/dsh-wuji-legion-global)
- PonyTail 上游：[`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail)
- PonyTail 核心 Skill：[`skills/ponytail/SKILL.md`](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md)
- PonyTail 许可证：[`MIT`](https://github.com/DietrichGebert/ponytail/blob/main/LICENSE)
- 最小化原则参考：[`Martin Fowler · YAGNI`](https://martinfowler.com/bliki/Yagni.html)
- 安全开发边界参考：[`NIST SP 800-218 SSDF 1.1`](https://csrc.nist.gov/pubs/sp/800/218/final)

全局版的研究依据和系统级设计，不等于当前模式已经调用了对应外部能力。当前仓库只对已经挂载、可调用并通过本地测试的部分作出实现声明。

## 当前版本与验证

模式版本：`4.0` · bundle 版本：`0.4.0`

```text
P0  4.0 阿极 persona、懒人行动、白帽与铁律          ✅
P1  官方编排面装配（workflow/subagent/ralph/goal）   ✅
P2  4.0 SKILL.md 与路由摘要按需加载                  ✅
P3  自研运行时全部移除                               ✅
P4  本地 profile 安装与隔离验证                      ✅
```

### 已实测（有产物可查）

| 项 | 结果 |
|---|---|
| **四层委派**（阿极→参谋部→主帅→专家） | ✅ 跑通。曾因 `maxDepth` 默认为 1 被阻断，已修 |

### 实测记录的诚实边界

四层验证的样本是 **16 个主帅族 + 17 个专家**，产出真实产物。但：

- 这证明的是**链路能跑通**，不是**每族专业质量达标**；
- 首轮曾报「14/14 通过」，那个数字是**假的** —— 判定标准用了主帅自己的报告（自述），4 个族压根没提 `subagent` 也被算过。改用独立审计后真值是 **4/14**；把专家产物强制独立落盘再重验，才得到 **10/10 真专家产物**；
- `subagent_fork` / `workflow` 两条路径**未单独验证**。

验证命令（在仓库根目录）：

```powershell
node scripts\verify-all.mjs
```

它依次跑：生成 bundle patch → 生成物同步校验 → preset 结构与**包存在性** → 缺包回归测试。

### 为什么「包存在性」是硬门禁

`@deepseek-ai/dsh-agent-preset-registry` 在 preset 子插件 import 失败时会
**拒绝整个 mount**，且不向界面报错 —— 症状是「preset 已注册但选择器里看不到、
新建会话仍是 standard」。

本项目正是因此长期失效：preset 里写的 `@deepseek-ai/dsh-workflow-worker-thread`
在本版 DSH 中**不存在**（正确包名是 `@deepseek-ai/dsh-workflow-ptc`）。
`verify-preset-imports.mjs` 按 DSH `app.asar` 的真实成员表逐个判定，把这类错误挡在安装前。

安装和模式边界说明见 [`docs/MODE-IMPLEMENTATION.md`](docs/MODE-IMPLEMENTATION.md)，PonyTail 接入说明见 [`docs/PONYTAIL-INTEGRATION.md`](docs/PONYTAIL-INTEGRATION.md)。

## 安装与使用

```powershell
node scripts\build-wuji-preset.mjs
```

然后在 **Desktop 内**用 plugin manager 安装 `packages/wuji-bundle` 目录
（`action: install_bundle`，`target` = bundle 绝对路径）。安装会写 Host 进程，需要完全权限或批准。

重启 DSH，新建会话，在 preset 选择器中选择“无极军团”。当前模式不会改变已有会话，也不会修改其他模式。

## 目录

- `preset/`：可选择的 DSH agent preset（persona + 官方插件行，无自研行）；
- `packages/wuji-bundle/`：bundle 声明与生成物（`cordis.patch.yml`）+ 技能目录；
- `skills/`：PonyTail 通用纲领、领域适配器与 4.0 入口技能；
- `scripts/`：构建、校验与本地安装脚本；
- `docs/`：运行边界、4.0 设计与集成说明。

如果你要研究无极军团整体如何设计、背书和演进，请看全局版；如果你要在 DSH 里实际进入并使用军团，请留在当前仓库。
