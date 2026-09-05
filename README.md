# 无极军团模式 · dsh-wuji-legion-mode

> **让不懂 Skill、插件、MCP 是什么的小白，只用人话提出要求；进入这个模式后，无极军团自动调齐合适的能力把事情办成，而且越用越强。**

这是无极军团的 **DSH 可选择、独占、隔离运行模式**。它和同一账号下的 [`dsh-wuji-legion-global`](https://github.com/AI-wuji/dsh-wuji-legion-global) 有同一个初衷：让用户不必理解底层能力，就能用自然语言驱动一支有组织、有纪律、能协作和交付的智能体军团。

区别只有一个，但非常重要：

| 项目 | 全局版 `dsh-wuji-legion-global` | 当前模式版 |
|---|---|---|
| 定位 | 无极军团整体的系统设计、研究、能力目录和长期演进 | DSH 中可以直接选择并运行的 preset |
| 生效范围 | 描述全局架构与建设方向 | 只有用户选择“无极军团模式”的新会话 |
| 对其他模式影响 | 不负责运行时隔离 | 不修改、不污染其他 DSH 模式 |
| 主要问题 | 无极军团为什么这样设计、如何持续建设 | 用户进入模式后，如何让军团真正开始工作 |

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
参谋部：仅对确实复杂且已获准的任务拆解和派发
        ↓
主帅：按领域选择能力路线，不亲自执行重活
        ↓
专家 / 工兵：执行单一任务，返回产物和验证证据
```

简单任务走短路径；复杂任务才展开完整链路。PonyTail 负责“做什么、做多大、走哪条路径”，参谋部负责已获准任务的拆解，主帅负责领域选型，worker 负责执行。

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
- 注册 `wuji_*` 工具、任务/需求/官员投影、参谋部、主帅和治理能力；
- 按任务需要加载领域适配器和已验证能力；
- 简单任务直接完成，复杂任务才派发 worker；
- 产出物必须带完成证据，任务不会因“子 agent 已启动”就自动算成功。

### 没有选择这个模式时

- 不加载军团 persona、铁律、PonyTail 模式规则或 `wuji_*` 工具；
- 不修改 Desktop 默认 preset，也不把军团运行时写入其他模式；
- 其他 DSH 模式继续使用自己的 preset、插件和工作方式。

这是 DSH 的 preset 级隔离，不提供已开始会话的热切换。

## 背书与边界

- 全局设计参照：[`dsh-wuji-legion-global`](https://github.com/AI-wuji/dsh-wuji-legion-global)
- PonyTail 上游：[`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail)
- PonyTail 核心 Skill：[`skills/ponytail/SKILL.md`](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md)
- PonyTail 许可证：[`MIT`](https://github.com/DietrichGebert/ponytail/blob/main/LICENSE)
- 最小化原则参考：[`Martin Fowler · YAGNI`](https://martinfowler.com/bliki/Yagni.html)
- 安全开发边界参考：[`NIST SP 800-218 SSDF 1.1`](https://csrc.nist.gov/pubs/sp/800/218/final)

全局版的研究依据和系统级设计，不等于当前模式已经调用了对应外部能力。当前仓库只对已经挂载、可调用并通过本地测试的部分作出实现声明。

## 当前版本与验证

当前版本：`0.2.0`

```text
P0  preset 隔离、阿极、能力目录、三张表投影       ✅
P1  参谋部计划、DAG 校验、subagent 派发            ✅
P2  各域主帅路线选择                              ✅
P3  独立官员建议与显式会审合同                    ✅
P4  三层记忆、行为探针、版本化进化                 ✅
P5  PonyTail 跨领域规则、适配器与 worker 继承       ✅
```

验证命令：

```powershell
cd packages/wuji-host
npm test
```

安装和模式边界说明见 [`docs/MODE-IMPLEMENTATION.md`](docs/MODE-IMPLEMENTATION.md)，PonyTail 接入说明见 [`docs/PONYTAIL-INTEGRATION.md`](docs/PONYTAIL-INTEGRATION.md)。

## 安装与使用

```powershell
.\scripts\install-local-profile.ps1
```

然后重启 DSH，新建会话，在 preset 选择器中选择“无极军团”。当前模式不会改变已有会话，也不会修改其他模式。

## 目录

- `preset/`：可选择的 DSH agent preset；
- `packages/wuji-host/`：模式专用 host 插件、投影和工具；
- `skills/`：能力注册表、PonyTail 通用纲领和领域适配器；
- `scripts/`：本地安装脚本；
- `docs/`：运行边界、状态和集成说明。

如果你要研究无极军团整体如何设计、背书和演进，请看全局版；如果你要在 DSH 里实际进入并使用军团，请留在当前仓库。
