---
name: wuji-expert-workbench-builder
description: 无极军团 4.0 专家「workbench-builder」（workflow）：数据/离线/导出/实际操作。当子任务需要 数据/离线/导出/实际操作，且属于 workbench 时加载。
kind: expert
role_kind: workflow
family: web
families: [web]
shared: false
baseline_id: workbench-builder
design_target: WF-WEB
source_id: p3/workflow/workbench-builder
---

# 专家：workbench-builder

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

## 五要素

- **goal**：数据/离线/导出/实际操作
- **inputs**：UserFlows+DataModel+OfflineExportRequirements
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：Workbench+BrowserEvidence
- **acceptance**：数据/离线/导出/实际操作

## 职责边界

- **anti_trigger**：不因名为工作台重建第二宿主
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属

- 主帅 `wuji-leader-web`（lead.web）
    - 配方 `web-workbench-delivery`（必需成员）

## DSH 运行时

- **callable**：当子任务的目标是「数据/离线/导出/实际操作」且领域属于 `workbench` 时被主帅引用。反触发：不因名为工作台重建第二宿主
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：workbench
- **typed_intents**：dashboard_ui、offline_export、tool_interface、workbench

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。