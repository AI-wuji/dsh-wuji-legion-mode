<h1 align="center">⚔️ 无极军团模式 · dsh-wuji-legion-mode</h1>

<p align="center">
  <strong>把无极军团做成 DeepSeek Harness 中可主动选择、完整运行的独占模式。</strong><br>
  <em>Wuji Legion as a selectable, complete, and isolated operating mode for DeepSeek Harness.</em><br>
  <sub>选择它，进入一支有组织、有纪律、能调度与交付的智能体军团；离开它，其他模式仍按自己的规则运行。<br>Choose it to enter an organized, disciplined, and deliverable agent legion; leave it, and every other mode stays on its own terms.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-DeepSeek%20Harness-4D6BFE?style=flat-square" alt="DeepSeek Harness">
  <img src="https://img.shields.io/badge/Type-Selectable%20Mode-8B5CF6?style=flat-square" alt="Selectable Mode">
  <img src="https://img.shields.io/badge/Runtime-Isolated-F59E0B?style=flat-square" alt="Isolated Runtime">
  <img src="https://img.shields.io/badge/Orchestration-Wuji%20Legion-22C55E?style=flat-square" alt="Wuji Legion">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT">
</p>

<p align="center">
  <a href="https://ai-wuji.github.io/dsh-wuji-legion-mode/index.zh.html">中文在线展示页</a> · <a href="https://ai-wuji.github.io/dsh-wuji-legion-mode/">English Online Showcase</a>
</p>

---

## 🎯 一句话 / One-Liner

> **想让一支有组织、有纪律、可调度、可审查的智能体军团完成复杂目标时，选择无极军团模式；不选择时，DSH 的其他模式保持原样。**
>
> *Choose Wuji Legion Mode when a complex goal calls for an organized, disciplined, schedulable, and reviewable agent legion; leave it unselected and every other DSH mode remains unchanged.*

不是替换极简模式，也不是把军团规则塞进所有会话；它是一个由用户主动进入的完整运行环境。

*It does not replace minimal mode or inject legion rules into every conversation; it is a complete runtime environment entered deliberately by the user.*

---

## ⚔️ 它是什么 / What It Is

无极军团模式是面向 **DeepSeek Harness** 的一个**可选、独占、完整的多智能体运行模式**。它不是普通聊天人格，更不是默认全局插件：只有用户选择该模式，阿极、铁律、参谋部、主帅、独立官员、任务投影、记忆和治理工具才会作为同一份运行契约启动。

*Wuji Legion Mode is a selectable, isolated, complete multi-agent operating mode for DeepSeek Harness. It is neither an ordinary chat persona nor a default global plugin: only when the user chooses it do A-Ji, the rules, staff office, commanders, independent officers, task projections, memory, and governance tools start as one runtime contract.*

```
用户选择“无极军团模式”
        ↓
阿极：收集需求、澄清边界、汇报结果
        ↓
参谋部：规划任务、校验依赖、调度执行
        ↓
主帅：按领域选择能力路线，不另建第二中枢
        ↓
专家 / 工兵：在限定任务内执行并返回回执
        ↓
官员：仅在需要时独立建议与验证，零修改权
```

**模式是完整启用，边界也是完整隔离。** 军团模式内遵守军团契约；切换到其他模式后，其他模式继续使用各自的插件、人格和工作方式。

*The mode enables a complete system, and enforces a complete boundary. Inside it, the legion contract applies; outside it, other modes retain their own plugins, personas, and workflows.*

---

## 🔥 三大卖点 / Three Highlights

### ① 主动选择，不抢占默认 / Explicit Opt-In, No Default Takeover

无极军团是一个新增模式，不替换极简模式，也不要求每个新会话都使用军团流程。用户想做快速问答、轻量工作或使用其他插件组合时，仍可选择其他模式；只有需要完整军团能力时才切换进来。

*Wuji Legion is an added mode: it does not replace minimal mode or force every new conversation through legion procedures. Users remain free to choose other modes for quick answers, lightweight work, or other plugin combinations.*

### ② 整套契约，一起运行 / One Complete Contract

阿极 persona、铁律、任务契约、参谋部调度、状态投影、记忆、审查和治理不是零散开关。选择本模式时，它们一起生效，避免“看似在用军团、实际混跑两套中枢”的边界混乱。

*A-Ji's persona, the rules, task contract, staff scheduling, state projections, memory, review, and governance are not loose switches. They activate together, preventing ambiguous hybrid runs with competing control planes.*

### ③ 模式隔离，插件有边界 / Isolated Mode, Bounded Plugins

“已安装”不等于“当前已加载”。无极军团模式只接入基础能力，或明确声明兼容且不与军团中枢冲突的共享插件；其他模式专属插件默认不继承，避免外部 supervisor、记忆、路由或权限系统与军团核心相互覆盖。

*Installed does not mean loaded. Wuji Legion Mode admits base capabilities and shared plugins that explicitly declare compatibility without conflicting with the legion core. Mode-owned plugins are not inherited by default, avoiding collisions among external supervisors, memory, routing, or permission systems.*

---

## 🛡️ 模式边界 / Mode Boundary

| 当前选择 | 会加载什么 | 不会加载什么 |
|---|---|---|
| **无极军团模式** | 阿极、铁律、`wuji_*` 工具、投影、参谋部、主帅、官员、模式兼容能力 | 其他模式专属的插件与冲突中枢 |
| **其他 DSH 模式** | 对应模式本身的 preset、插件与工作方式 | 无极军团 persona、铁律、`wuji_*` 工具、投影、军团记忆与专用治理 |

这不是把插件简单分成“都能用”或“都不能用”，而是把**安装**和**当前模式下的运行时加载**严格区分。

*This is not a simplistic all-or-nothing plugin policy. It strictly separates installation from runtime loading in the current mode.*

---

## 🚀 适合什么任务 / When To Choose This Mode

选择无极军团模式，尤其适合：

- 多步骤、长周期、需要持续推进的目标；
- 需要拆解、依赖管理、并行执行和回执的工作；
- 跨开发、调研、内容、视觉、数据等多类能力协同；
- 需要保留任务状态、进行验证或需要独立建议的交付；
- 希望用自然语言下命令，而不是手动选择 Skill、插件或 MCP 的用户。

简单问答、一次性轻任务，或希望使用完全不同插件体系时，请保留在合适的其他 DSH 模式。

---

## 📦 当前实现 / Current Implementation

```text
P0  阿极 preset + 能力目录 + 需求/任务/官员投影     ✅
P1  参谋部规划、DAG 校验与 subagent 派发            ✅
P2  域主帅路线选择                                  ✅
P3  独立官员建议与显式会审合同                      ✅
P4  三层记忆、行为探针与版本化进化                  ✅
P5  telemetry、反馈与当前 Session 状态摘要          ✅
```

> 当前为**公开开发版本**。模式隔离按 DSH 原生 agent preset 作用域实现：选择 `wuji` 的新会话才挂载军团运行时；DSH 原生规定已开始会话固定 preset，因此不提供也不宣称运行时热切换。安装与验证步骤见 [`docs/MODE-IMPLEMENTATION.md`](docs/MODE-IMPLEMENTATION.md)。

---

## 🌐 另一个项目：全局版 / The Global Project

无极军团还维护一个负责整体建设的全局项目：[`dsh-wuji-legion-global`](https://github.com/AI-wuji/dsh-wuji-legion-global)。它记录无极军团的总体理念、系统架构、研究依据、能力目录、基础集成与长期演进，但它本身不是一个要由用户选择的聊天模式。

- 想**直接启用与使用无极军团模式**：留在当前仓库。
- 想了解**整体设计、研究依据、能力演进或参与底层建设**：前往 [`dsh-wuji-legion-global`](https://github.com/AI-wuji/dsh-wuji-legion-global)。
- 想使用其他 DSH 模式：不需要加载本项目；它们不应受到无极军团规则影响。

> 全局版负责“无极军团整体如何存在”，模式版负责“用户选择无极军团后如何运行”。

---

## 📚 目录 / Repository Layout

- `preset/`：无极军团模式的 agent preset 设计；
- `packages/wuji-host/`：模式专用 Host 插件、投影与工具；
- `skills/`：模式能力注册表；
- `scripts/`：模式 profile 安装脚本；
- `docs/`：模型路由、状态和运行边界说明。

---

<p align="center">
  <sub>⭐ 选择模式，不是限制选择；是在需要时，让整支军团整装待发。</sub><br>
  <sub>⚔️ 运筹帷幄之中，决胜千里之外 · To plan within the command tent, to win a thousand miles away.</sub>
</p>
