# DSH Desktop 兼容性基线（阶段 0 探针结果）

> 探针日期：2026-09-29
> 方法：只读探测本机安装 + 官方 `apps/desktop/README.md`（master）
> 状态：**已完成。本阶段未修改任何运行逻辑。**

## 0. 结论摘要

1. 本机 DSH Desktop 的真实 profile 位置是 `~/.dsh/`（`DSH_HOME`），**不是**仓库内任何路径。
2. `wuji` preset **已经安装**在 `~/.dsh/.agent-presets/wuji/`，且**比仓库 HEAD 超前**——存在未回流到仓库的工作。
3. `~/.dsh/plugins/` 为**空**：当前项目走的是 preset 内挂载路线，**不是**官方外部插件路线。
4. `wuji.exe` 已构建可用（6.4 MB，57 个子命令），Go 确定性核心桥接面比原方案假设的更完整。
5. 已安装的 preset 本身**已经在用 DSH 原生插件**（`@deepseek-ai/dsh-*`），DSH Native First 原则部分已落地。

---

## 1. 本机环境事实

| 项 | 实测值 |
|---|---|
| Desktop 安装目录 | `C:\Users\Administrator\AppData\Local\Programs\DeepSeek Harness` |
| 主程序 | `DeepSeek Harness.exe`（Electron 壳） |
| 归档 | `resources\app.asar`（121 MB，内含完整 dsh 生产依赖树） |
| 未解包原生模块 | `resources\app.asar.unpacked\dsh\node_modules`（23 项） |
| 原生模块内容 | `@deepseek-ai/dsh-desktop-host`、`libreoffice-kit(-win32-x64)`、`@vscode/ripgrep-win32-x64`、`@img/sharp-win32-x64`、`@koromix/koffi-win32-x64`、`@swc/helpers`、`dsh-session-log-export` |
| Desktop 端口 | **19387**（Web 为 3080，可用 `webserver.config.port` 覆盖） |
| `version` 文件 | `44.0.0`（这是 Electron/Chromium 版本，**不是** dsh 版本） |

**注意**：系统提示中给出的 checkout 路径 `resources\app.asar\dsh\` 在本机**为空**。真实 dsh 源码封装在 `app.asar` 归档内，`app.asar.unpacked\dsh\` 只有 `node_modules`。要读 DSH 内部实现需解包 asar。

## 2. DSH Desktop 官方关键约束（已核验）

| 决策 | 官方原文要点 | 对本项目的约束 |
|---|---|---|
| 运行时 | `dsh` 在 Electron 下以 `ELECTRON_RUN_AS_NODE=1` + `--expose-internals` 运行，所有包操作使用 bundled pnpm | 插件不得假设系统有 Node/pnpm；打包不得引入无法解析的 import |
| 包来源 | `app.asar/dsh` 携带完整生产依赖树，**profile 只安装外部插件** | 核心能力应走 preset；外部能力走 `~/.dsh/plugins/` |
| 版本身份 | Electron 与 `@deepseek-ai/dsh` **永远同版本**；dsh 升级即 Desktop 发行 | 插件需声明对 dsh 版本的兼容区间 |
| 插件包响应 | 插件 bundle 响应标记 `no-store`（每次启动修订号会累积进 Chromium 磁盘缓存） | 不能依赖 bundle 的 HTTP 缓存语义 |
| Home 保护 | 卸载器**从不**触碰 `~/.dsh`（sessions/settings/credentials/plugins） | profile 是安全的持久化落点 |
| 插件管理 | Creator 与 **Web Plugin Manager** 使用 Desktop bundled pnpm，无需 PATH 上的 pnpm | 官方安装入口是 Web Plugin Manager，不是自写 PowerShell 复制 |
| Desktop 生命周期 | 更新须先等本地 analytics 接收（1 秒期限），再锁 API 准入、停止 Host | 插件变更须在 Host 停止后进行 |
| dsh CLI | 菜单 **Manage dsh Command…** 提供 Install/Repair/Remove，CLI 版本跟随 Desktop 发行，**Desktop 关闭时也可用** | 插件安装脚本可走 `dsh` CLI，但需处理 Desktop 运行期锁 |
| 运行时目录 | `runtime/bin` 仅加入**包安装进程**，不进入 Host PATH | 不能依赖 PATH 注入 |

## 3. Profile 实测结构

```
~/.dsh/
├── .agent-presets/          ← preset 根
│   └── wuji/                ← 已安装的 wuji preset
│       ├── preset.yml       (220 B,  2026-09-24 02:25)
│       ├── agent.cordis.yml (19698 B, 2026-09-24 02:35)
│       ├── node_modules/
│       ├── skills/          (ponytail + 15 个 ponytail-* 变体)
│       └── @wuji/dsh-wuji-host/
├── plugins/                 ← 空的，官方外部插件目录
├── profiles/
├── sessions/
├── storages/
├── logs/
├── backups/
├── .credentials.yaml
└── AGENTS.md
```

**编码核实**：早期用 PowerShell `Get-Content` 读到中文乱码，经按字节核对确认为**控制台 GBK 代码页的显示假象**，文件本身是合法 UTF-8。`preset.yml` 经 UTF-8 读取显示 `name: 无极军团`，**文件无损坏**。

## 4. 仓库与已安装 preset 的差异（已解决）

| 文件 | 仓库 HEAD | 已安装（处理前） | 结论 |
|---|---|---|---|
| `preset.yml` | 217 B / 2026-09-05 | 220 B / 2026-09-24 | **已核实**：逐行比较零差异，3 字节全部来自行尾（profile CRLF / 仓库 LF，3 行 × 1 B）。两者均为合法 YAML，**无需处理** |
| `agent.cordis.yml` | 18336 B / 2026-09-05 | 19698 B / 2026-09-24 | 差异为 9 行 Laya 实验内容 |

已安装 persona 中多出的 9 行，经逐行 `Compare-Object` 核对，**100% 为 Laya 相关，零其他内容**：

- `wuji_route` → 本地 Laya 决策模型（开源 Jev，CPU 毫秒级、零输出 token）
- 「3.0 确定性前置路由（Laya 决策模型）」整节及其 4 条规则
- 一行 `wuji_contract` 工具调用规则

### 4.1 Laya 是什么（已废弃）

Laya **不属于本项目**，是独立本地服务：

```
C:\Users\Administrator\DoubaoWork\chats\2026-09-23\new-chat-4\
├── laya_serve.py      ← Laya CPU 决策服务（HTTP :18081）
└── laya-tray.ps1      ← 托盘常驻版
```

桌面启动器 [启动Laya托盘.bat](C:\Users\Administrator\Desktop\启动Laya托盘.bat) 拉起 18081；
[启动Bonsai27B+Laya.bat](C:\Users\Administrator\Desktop\启动Bonsai27B+Laya.bat) 拉起 Laya(18081) + Bonsai 27B NInfer(18080)。
`wuji-legion-codex-3.0` 中的 `jev-methods-*` 仅为验证记录，非服务本体。

### 4.2 废弃理由与处置

**决定：砍掉 Laya。**

原因：

1. `wuji_route` / `wuji_contract` 在本仓库**零实现**（全仓 grep 无命中），persona 声明的工具并不存在，阿极调用即报错。
2. Laya 依赖用户手动点击桌面 `.bat` 才在 18081 上运行，preset 因此不可移植、不可复现。
3. 3.0 权威规范要求路由由**确定性参谋部 + 唯一专家命中**承担，并明确「不启动第二个全局 router」。Laya 作为全局前置分类器与该约束相悖。
4. 实测收益不足以支撑上述成本。

处置（已完成）：

- 已安装 persona 的 9 行 Laya 内容已移除，profile 与仓库**字节一致**（`3A2130CC3989ACC6`）。
- 备份：`~/.dsh/.agent-presets/wuji/agent.cordis.yml.bak-20260929-235758`
- `wuji_contract` 的**意图**以惰性注释保留在 `preset/agent.cordis.yml`（不作为生效规则），
  启用条件：工具实现 + 测试 + 参谋部投影字段就位。
- profile 全目录 Laya / `wuji_route` 残留检查：**无残留**。

> **注意**：DSH 正在运行，preset 可能被当前会话缓存。回退需**新建会话或重启 Desktop** 后才生效。


## 5. 已安装 preset 的实际架构（已部分符合 Native First）

已安装的 `agent.cordis.yml` 是 `cordis` preset 的分叉（保留其注释与结构，叠加无极 persona），工具层已大量使用 DSH 原生插件：

```
persona / agent-instructions
tool-bash · tool-pwsh · tool-fs · tool-fs-search
tool-jobs · tool-goal · tool-ask-user · tool-todo · tool-web
tool-cordis · tool-skill · skill-filesystem
planning(@deepseek-ai/dsh-plan-mode)
compaction(@deepseek-ai/dsh-compaction-basic, dsh-command-compact, dsh-compaction-tool-result-pruner)
delegation(@deepseek-ai/dsh-tool-subagent, dsh-tool-subagent-control,
           dsh-workflow-worker-thread, dsh-tool-workflow, dsh-tool-ralph)
wuji-runtime → @wuji/dsh-wuji-host
```

**已具备的 DSH 原生替换**（原方案中列为"待替换"，实际已用）：

| 原方案待替换项 | 实际已用 DSH 原生 |
|---|---|
| 自定义子任务派发 | `@deepseek-ai/dsh-tool-subagent` + `dsh-tool-subagent-control` |
| 自定义工具注册 | `dsh-tool-fs` / `dsh-tool-web` / `dsh-tool-todo` / `dsh-tool-jobs` |
| 自定义会话上下文 | `dsh-compaction-basic` + `dsh-compaction-tool-result-pruner` |
| 计划模式 | `@deepseek-ai/dsh-plan-mode` |
| 工作流 | `dsh-tool-workflow` + `dsh-workflow-worker-thread` + `dsh-tool-ralph` |

**仍为无极自建、需保留的**：`wuji-runtime`（参谋部/投影/军团工具/铁律/能力注册）。

> 阶段 1「把 wuji-host 改造成正规外部插件包」的必要性因此下降：
> preset 挂载路线是 DSH 官方支持的形态之一，且已工作。
> 是否迁到 `~/.dsh/plugins/` 应重新评估——迁移会**失去 preset 独占隔离**，
> 而隔离正是无极军团的核心约束（其他 preset 不加载军团组件）。

## 6. Go 确定性核心可用性

`E:\wuji-projects\wuji-legion-codex-3.0\bin\wuji.exe` — 6,411,264 B，可执行，退出码 0。

暴露 **57 个子命令**，覆盖：

- 路由与编排：`route` `response-policy` `orchestrate` `expert-bridge` `officer-select`
- 任务门禁：`task-gate` `task-claim` `task-record` `dispatch` `validate-receipt` `verify`
- 参谋部：`staff-create` `staff-update` `staff-status`
- 上下文：`context-select` `context-reduce` `context-recall` `context-mode-prepare` `context-mode-validate` `search-select`
- 证据与验收：`execution-record` `execution-result` `execution-project` `acceptance-reconcile` `audit-record`
- 需求与决策：`requirement-record` `requirement-project` `decision-record`
- 溯源与安全：`provenance-record` `provenance-resolve` `source-assess` `source-impact` `security-gate`
- 能力演进：`asset-select` `lineage-sync` `graph-govern` `source-audit` `evolve` `graph-sync`
- 记忆与知识：`user-memory` `knowledge-record` `knowledge-query`
- 其他：`change-capsule` `conversation-link` `conversation-resolve`

**映射结论**：原方案阶段 3/5/6 计划在 JS 中重写的内容，
`wuji.exe` **已全部提供确定性实现**。应改为薄桥接，不重写。

仓库侧另有 `capabilities/` 真实专家目录，17 个领域：
`code-review` `data` `documents` `frontend` `image` `presentation` `search`
`security` `video` `visual` `writing`（各含 `skills/wuji-*-suite`）。

## 7. 兼容性矩阵

| 维度 | 状态 | 依据 |
|---|---|---|
| Desktop Windows x64 | ✅ 已安装运行中 | 19387 端口活跃 |
| preset 挂载 | ✅ 已工作 | `~/.dsh/.agent-presets/wuji/` |
| preset 独占隔离 | ✅ 声明于 preset.yml | 其他 preset 不加载 wuji 组件 |
| bundled pnpm / 无系统 Node | ⚠️ 未验证 | `install-local-profile.ps1` 自建流程 |
| 官方 Plugin Manager 路线 | ❌ 未使用 | `~/.dsh/plugins/` 为空 |
| 外部插件包 | ❌ 未实现 | 无 plugin manifest |
| Desktop 关闭时 CLI 操作 | ⚠️ 未验证 | 需实测 |
| Desktop 更新后 preset 存活 | ⚠️ 未验证 | 需实测 |
| 中文/空格路径 | ⚠️ 未验证 | 需实测 |
| Go 桥接 | ✅ 二进制可用 | 未接线 |

## 8. 对原升级方案的修正

| 原方案条目 | 修正 |
|---|---|
| 阶段 1：改造成正规外部插件包 | **降级/重估**。preset 挂载是官方支持形态且已工作；迁到 plugins/ 会失去 preset 独占隔离 |
| 阶段 3/5/6：JS 重写治理层 | **改为薄桥接**。`wuji.exe` 57 子命令已全部覆盖 |
| 阶段 7：模型路由改造 | **仍需执行**。仓库版本无 Laya，安装态有，差异待厘清 |
| 阶段 2：preset 作用域迁移 | **大部分已完成**，仅需对齐安装态与仓库 |
| 新增前置阶段 -1 | **安装态 → 仓库回流**，否则 09-05 后的工作会丢失 |

## 9. 未决问题

1. ~~`wuji_route` / Laya 决策模型：代码在仓库何处？~~ → **已解决：不在本项目，已废弃**
2. ~~`wuji_contract` 工具：仓库无此工具。~~ → **已解决：意图以注释保留，待实现**
3. 已安装 preset 是从哪个分支/工作区生成的？ → **已解决：从未进过仓库，是直接在 profile 手改的**
4. 是否需要 `~/.dsh/plugins/` 路线？ → 待定，见 §8 修正

## 10. 下一步

阶段 0 已完成，**不再需要"回流"**（仓库 HEAD 即完整基线）。建议顺序：

1. **阶段 7：模型路由改造** — 删除硬编码 `gpt-5.6 → terra → sol` 优先级，
   改为继承宿主当前模型、只切 reasoning effort。改动小、风险低、收益立即可见。
2. **阶段 6：context 门禁** — 保留现有 token 阈值，补 3.0 字节级门禁
   （共享 4096B / 单契约 4096B / 总 replay 9216B / anchor coverage ≥60%）。
3. **阶段 4：Go 薄桥接** — 通过 `wuji.exe` 调用 `task-gate` `task-claim` `dispatch`
   `validate-receipt` `orchestrate` `expert-bridge`，不重写治理逻辑。
4. **修正文档矛盾** — 统一「`wuji` 是可选 preset」还是「默认 preset」。
5. **阶段 1/2 重估** — preset 挂载路线已工作且提供独占隔离，
   迁到 `plugins/` 会失去隔离，除非有明确跨 preset 复用需求，否则**不做**。
6. **Windows 真机验证** — 中文/空格路径、无系统 Node、Desktop 关闭时 CLI、更新后 preset 存活。

