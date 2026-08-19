# 无极军团模式实现与验证

## 运行模型

无极军团不是 Desktop profile 的全局注入，而是 DSH 原生的用户 agent preset：

```text
$DSH_HOME/.agent-presets/wuji/
├── preset.yml
├── agent.cordis.yml
└── skills/
```

DSH 在创建新会话前选择 preset。`wuji` 的 standing composition 只会挂载到选择了它的 agent scope；其他 preset 不会加载其中的 persona、`wuji_*` 工具、能力目录或投影注册。已经开始的会话保持自己的 preset，不能中途切换。

`agent.cordis.yml` 中的 `wuji-runtime` group 将 `wujiStaff` 放进 Cordis `isolate` realm，避免 preset 服务泄漏到宿主根作用域；`sessionProjections`、subagent provider、sandbox、审批和持久化等 DSH 原生宿主服务仍留在 host plane。

## 安装

在本仓库根目录运行：

```powershell
.\scripts\install-local-profile.ps1
```

安装器会：

1. 安装 `@wuji/dsh-wuji-host`，供 preset composition 解析；
2. 安装 `$DSH_HOME/.agent-presets/wuji/` 与 preset-local skills；
3. **不**修改 `agent-presets.default`；
4. **不**向 `profiles/desktop/cordis.patch.yml` 插入 `wuji-host`；
5. 保留其他模式的 preset、插件和默认选择。

重启 DSH 后，新建会话时选择“无极军团”。如果曾使用旧版全局安装器，请先手工从 Desktop patch 移除 `agent-presets.default: wuji` 和 `wuji-host` 两行；安装器不猜测或重写用户自定义 YAML。

## 行为矩阵

| 新会话 preset | 阿极与铁律 | `wuji_*` 工具/skills | Wuji 投影 |
|---|---:|---:|---:|
| `wuji` | 是 | 是 | 是 |
| `standard` / 极简 / 其他 preset | 否 | 否 | 否 |

## 验证

```powershell
cd packages\wuji-host
npm install
npm test
```

测试覆盖投影、参谋部计划与派发、状态工具、主帅、官员、记忆、进化、冷恢复和 preset-scoped mock host 注册。`wuji_staff_dispatch` 只在 child 创建成功后标记任务为 `running` 并返回 `dispatched`；它不会把创建回执伪装为完成证据。

## 当前边界

- 模式选择影响**新会话**；DSH 原生禁止已开始会话换 preset。
- 普通 `subagent`/`subagent_fork` 会继承父会话的 preset generation；它们隔离上下文，不自动获得不同的工具策略。
- 能力目录是可调用能力的路由清单，不把未验证入口伪装成已执行结果。实际入口仍在执行时探测并回报失败。
