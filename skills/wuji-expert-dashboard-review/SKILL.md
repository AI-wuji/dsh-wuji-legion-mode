---
name: wuji-expert-dashboard-review
description: 无极军团 4.0 专家「dashboard-review」（workflow）：口径/可视化/业务解读分工。当子任务需要 口径/可视化/业务解读分工，且属于 analytics、data、workbench 时加载。
kind: expert
role_kind: workflow
family: web
families: [web, data]
shared: true
baseline_id: dashboard-review
design_target: WF-DATA
source_id: p3/workflow/dashboard-review
---

# 专家：dashboard-review

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

> **本角色是共享专家**，被 2 个主帅引用。任何引用它的主帅都可以按条件使用它，
> 它不专属于某一个团。

## 五要素

- **goal**：口径/可视化/业务解读分工
- **inputs**：Metrics+DatasetRef+BusinessQuestion
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：Dashboard+AnalysisReview
- **acceptance**：口径/可视化/业务解读分工

## 职责边界

- **anti_trigger**：漂亮看板不证明指标准确
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属（共享，2 个主帅）

- 主帅 `wuji-leader-web`（lead.web） —— **主属**
    - 配方 `web-workbench-delivery`（按需成员）
- 主帅 `wuji-leader-data`（lead.data）
    - 配方 `data-delivery`（必需成员）

## DSH 运行时

- **callable**：当子任务的目标是「口径/可视化/业务解读分工」且领域属于 `analytics`、`data`、`workbench` 时被主帅引用。反触发：漂亮看板不证明指标准确
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：analytics、data、workbench
- **typed_intents**：business_review、dashboard、dashboard_ui、data_analysis、metric_definition、offline_export、statistics、tool_interface、workbench

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。