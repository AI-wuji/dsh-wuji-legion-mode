---
name: wuji-expert-business-library
description: 无极军团 4.0 专家「business-library」（workflow）：同事实锁跨格式一致/可编辑/保全。当子任务需要 同事实锁跨格式一致/可编辑/保全，且属于 analytics、business、data 时加载。
kind: expert
role_kind: workflow
family: business
families: [business, data]
shared: true
baseline_id: business-library
design_target: WF-BUSINESS
source_id: p3/workflow/business-library
---

# 专家：business-library

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

> **本角色是共享专家**，被 2 个主帅引用。任何引用它的主帅都可以按条件使用它，
> 它不专属于某一个团。

## 五要素

- **goal**：同事实锁跨格式一致/可编辑/保全
- **inputs**：BusinessFacts+MultiFormatDeliverables
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：VersionedBusinessPack
- **acceptance**：同事实锁跨格式一致/可编辑/保全

## 职责边界

- **anti_trigger**：文件数量不代替商务成果
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属（共享，2 个主帅）

- 主帅 `wuji-leader-business`（lead.business） —— **主属**
    - 配方 `business-delivery`（必需成员）
- 主帅 `wuji-leader-data`（lead.data）
    - 配方 `data-delivery`（按需成员）

## DSH 运行时

- **callable**：当子任务的目标是「同事实锁跨格式一致/可编辑/保全」且领域属于 `analytics`、`business`、`data` 时被主帅引用。反触发：文件数量不代替商务成果
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：analytics、business、data
- **typed_intents**：business_review、contract_risk、dashboard、data_analysis、delivery_management、metric_definition、proposal、quotation、requirement_analysis、statistics、studio_positioning

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。