---
name: wuji-expert-comfyui-go-integration
description: 无极军团 4.0 专家「comfyui-go-integration」（leaf）：外部服务边界、幂等/查询/取消。当子任务需要 外部服务边界、幂等/查询/取消，且属于 comfyui 时加载。
kind: expert
role_kind: leaf
family: comfyui
families: [comfyui]
shared: false
baseline_id: comfyui-go-integration
design_target: comfyui.implementation/go-bridge
source_id: p3/leaf/comfyui-go-integration
---

# 专家：comfyui-go-integration

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

## 五要素

- **goal**：外部服务边界、幂等/查询/取消
- **inputs**：ExternalProtocol+TaskCancel+TargetAPI
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：GoBridge+IntegrationEvidence
- **acceptance**：外部服务边界、幂等/查询/取消

## 职责边界

- **anti_trigger**：不增加第二军团任务DB
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属

- 主帅 `wuji-leader-comfyui`（lead.comfyui）
    - 配方 `comfyui-delivery`（按需成员）

## DSH 运行时

- **callable**：当子任务的目标是「外部服务边界、幂等/查询/取消」且领域属于 `comfyui` 时被主帅引用。反触发：不增加第二军团任务DB
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：comfyui
- **typed_intents**：comfyui_analysis、comfyui_fusion、comfyui_node、comfyui_packaging、comfyui_verification、comfyui_workflow

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。