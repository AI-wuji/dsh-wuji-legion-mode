# 无极军团模式实现与验证

> 2026-10-08 更新（4.0）：自研运行时已全部移除，能力改由 DSH 官方插件承载。
> 3.0 的 `wuji-runtime` isolate realm 与 `@wuji/dsh-wuji-host` 已删除，见下方「4.0 改造」。

## 运行模型

无极军团不是 Desktop profile 的全局注入，而是 DSH 原生的用户 agent preset：

```text
repo/packages/wuji-bundle/
├── package.json            # dsh.bundle.patch → ./cordis.patch.yml
├── cordis.patch.yml        # 生成物：一条 - insert: 的 dsh-agent-preset 声明
├── lib/index.js            # 无副作用的空插件（bundle 只为被 loader 发现）
└── skills/                 # 16 个技能：14 个 PonyTail + 2 个 4.0 入口技能
```

DSH 在创建新会话前选择 preset。`wuji` 的 standing composition 只会挂载到选择了它的 agent scope；其他 preset 不会加载其中的 persona、官方编排工具或技能目录。已经开始的会话保持自己的 preset，不能中途切换。

## 4.0 改造（重要）

4.0 把**全部自研运行时**替换为 DSH 官方插件：

| 原自研模块（已删除） | 现由官方插件承接 |
|---|---|
| `staff.js` / `staff-service.js`（参谋部） | `dsh-tool-workflow` + `dsh-tool-subagent` |
| `role-task-graph.js`（任务图 / DAG） | `workflow` 脚本的 `pipeline` / `parallel` / `phase` |
| `commanders.js` / `expert-catalog.js`（主帅与专家目录） | `dsh-skill-filesystem` 按需加载 SKILL.md |
| `projection.js`（三张表投影） | `dsh-session-projection` + `dsh-session-query-sqlite` |
| `model-policy.js`（模型路由） | `dsh-agent-default-model` + preset 配置 |
| `context-gate.js`（上下文门控） | `dsh-token-meter` + `dsh-compaction-*` |
| `evolution.js` / `observability.js`（进化与遥测） | `dsh-session-telemetry` + 人工 review |
| `wuji-3-tools.js`（`wuji_*` 工具族） | 官方 `workflow` / `subagent` / `ralph` / `goal` / `present` |

全量删除清单：`packages/wuji-host/`（20 个 lib 模块 + 20 个测试 + package.json + node_modules）、
`scripts/sync-capability-registry.mjs`（依赖已删除的 `wuji-bridge.js`）。

**现在 preset 里没有任何 `@wuji/*` 自研行**，`scripts/check-wuji-preset.mjs` 会强制这一条回归。

## 3.0 装载形态（仍然有效）

**旧路径 `$DSH_HOME/.agent-presets/wuji/` 已失效。** 那是 DSH 旧版 preset 目录，
当前版本**不读取**它。

现在 preset 是 **bundle 里的一个 patch 文件**：

- 声明形态对齐官方 `dsh-agent-preset` 的 `editing-cordis-compositions` 规程
- `name` / `description` / `order` 取自 `preset/preset.yml`（选择器显示的就是它们）
- `plugins` 取自 `preset/agent.cordis.yml`
- 由 `scripts/build-wuji-preset.mjs` 生成，`--check` 可校验同步

**安装必须走 `plugin_manager` 的 `install_bundle`**，它自己完成包安装与 bundle 选择。
官方明确要求 “do not reproduce those steps with shell commands” ——
手工把包拷进 `profiles/node_modules` 或手改 profile `package.json` 的 bundles，
注册的 bundle **不会**被识别，preset 不会出现在选择器里。

### 技能目录为什么必须指向 `skills/` 本身

`dsh-skill-filesystem` 的发现**只有一层深**，只认 `<root>/<name>/SKILL.md`
和 `<root>/<name>.md`；嵌套的 `**/SKILL.md` 被刻意忽略。

因此 `customSkillDirs` 必须解析到 bundle 的 `skills/` 目录**本身**，
不能指向包根或 preset 根，否则 16 个技能全部落空且**不会报错**（静默消失）。

解析方式是 `createRequire(baseUrl).resolve('@wuji/dsh-wuji-bundle/package.json')`
再拼 `skills/`。不能用 `new URL('skills/', baseUrl)` —— `baseUrl` 是 loader 的
include root 锚点，不是包目录。

## 安装

安装由 Desktop 内的 plugin manager 完成（`install_bundle`，target 指向 bundle 目录）。
CLI 不可代劳：`dsh --profile desktop ...` 会报
`profile "desktop" is managed exclusively by the Electron application`。

在本仓库根目录先生成并校验 preset 声明：

```powershell
node scripts\build-wuji-preset.mjs
node scripts\build-wuji-preset.mjs --check
node scripts\check-wuji-preset.mjs
```

然后在 **Desktop 内**用 plugin manager 安装 `packages/wuji-bundle` 目录
（`action: install_bundle`，`target` = bundle 绝对路径）。安装会在 Host 进程里执行插件代码，
需要完全权限或批准。

安装会：

1. 安装 bundle 到 profile（4.0 后**无**自研依赖，不再需要 `@wuji/dsh-wuji-host` 与 `zod`）；
2. 把 `cordis.patch.yml` 的 preset 声明注册进 roster；
3. **不**修改 `agent-preset-registry` 的 `default`（保持 `standard`）；
4. **不**向 Host 平面插入任何军团行（bundle 的 Host patch 刻意为空）；
5. 保留其他 preset、插件与用户配置。

> `scripts/install-local-profile.ps1` 写入的是失效的 `.agent-presets/` 目录，
> **不是**当前生效路径。它只用于铺设 preset 源文件与技能目录供排查，
> 正常安装请走 plugin manager。

重启 DSH 后，新建会话时选择「无极军团」。
如果曾用旧安装器装过，需手工清理 `$DSH_HOME/.agent-presets/wuji/`（该目录已不会被读取）。

## 行为矩阵

| 新会话 preset | 阿极与铁律 | 官方编排工具 | 军团技能 |
|---|---:|---:|---:|
| `wuji` | 是 | 是 | 是 |
| `standard` / 极简 / 其他 preset | 否 | 否 | 否 |

## 验证

```powershell
node scripts\build-wuji-preset.mjs --check   # 生成物与源文件同步
node scripts\check-wuji-preset.mjs           # 结构 + 官方行齐备 + 自研行归零
```

`check-wuji-preset.mjs` 会强制三条回归：

1. **自研行必须为零** —— `wuji-runtime` / `@wuji/*` 一旦被加回就失败；
2. **官方编排行必须齐备** —— `tool-workflow`、`tool-subagent`、`tool-ralph`、`tool-goal`、`tool-todo`、`tool-present`；
3. **技能目录指向正确** —— `customSkillDirs` 必须解析到 bundle 的 `skills/` 本身。

原有的 20 个 host 单元测试随 `packages/wuji-host` 一并移除：它们验证的是已被官方插件替代的
自研实现，保留只会形成「测试通过但代码不生效」的假证据。

## 上下文预算

DSH 内置 `dsh-compaction-basic` 的源码默认 `thresholdRatio` 为 `0.8`（即 `contextWindow × 0.8`）。
本模式在 preset 中将其提前配置为 `0.4`，并配合 `dsh-compaction-tool-result-pruner`
（`thresholdChars: 8192`）裁剪过大的工具返回。

原 `wuji_status` 的 220000 / 240000 / 260000 硬门禁随自研 host 一并移除；
上下文会计改由 `dsh-token-meter` 提供，不再由本模式自定义阈值。

## 当前边界

- 模式选择影响**新会话**；DSH 原生禁止已开始会话换 preset。
- 普通 `subagent`/`subagent_fork` 会继承父会话的 preset generation；它们隔离上下文，不自动获得不同的工具策略。
- 技能是可调用能力，不把未验证入口伪装成已执行结果。实际入口仍在执行时探测并回报失败。
- 「已派发」不是「已完成」：只有子 agent 返回真实产物才算完成。
