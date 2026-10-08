---
name: wuji-expert-python-engineer
description: 无极军团 4.0 专家「python-engineer」（leaf）：目标解释器/依赖/类型/异常/测试。当子任务需要 目标解释器/依赖/类型/异常/测试，且属于 engineering、software 时加载。
kind: expert
role_kind: leaf
family: software
families: [software]
shared: false
baseline_id: python-engineer
design_target: software.languages/python
source_id: p3/leaf/python-engineer
---

# 专家：python-engineer

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

## 五要素

- **goal**：目标解释器/依赖/类型/异常/测试
- **inputs**：EnvironmentLock+BehaviorSpec+ScopedCode
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：PythonPatch+Tests
- **acceptance**：目标解释器/依赖/类型/异常/测试

## 职责边界

- **anti_trigger**：不把Python整个项目改Rust
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属

- 主帅 `wuji-leader-software`（lead.software）
    - 配方 `software-delivery`（按需成员）

## DSH 运行时

- **callable**：当子任务的目标是「目标解释器/依赖/类型/异常/测试」且领域属于 `engineering`、`software` 时被主帅引用。反触发：不把Python整个项目改Rust
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：engineering、software
- **typed_intents**：code_change、implementation、software_review

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。