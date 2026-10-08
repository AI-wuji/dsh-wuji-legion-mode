---
name: wuji-expert-delivery-acceptance
description: 无极军团 4.0 专家「delivery-acceptance」（leaf）：商务接收与工程验证角色独立。当子任务需要 商务接收与工程验证角色独立，且属于 bugfix、business、content_operations 时加载。
kind: expert
role_kind: leaf
family: bugfix
families: [bugfix, office, business, publish]
shared: true
baseline_id: delivery-acceptance
design_target: business/delivery-management
source_id: p3/leaf/delivery-acceptance
---

# 专家：delivery-acceptance

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

> **本角色是共享专家**，被 4 个主帅引用。任何引用它的主帅都可以按条件使用它，
> 它不专属于某一个团。

## 五要素

- **goal**：商务接收与工程验证角色独立
- **inputs**：DeliverableSpecs+CurrentArtifacts+Checks
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：AcceptanceProposal+CoverageGap
- **acceptance**：商务接收与工程验证角色独立

## 职责边界

- **anti_trigger**：不让商务满意分抵消硬失败
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属（共享，4 个主帅）

- 主帅 `wuji-leader-bugfix`（lead.bugfix） —— **主属**
    - 配方 `bugfix-delivery`（按需成员）
- 主帅 `wuji-leader-office`（lead.office）
    - 配方 `office-delivery`（按需成员）
- 主帅 `wuji-leader-business`（lead.business）
    - 配方 `business-delivery`（按需成员）
- 主帅 `wuji-leader-publish`（lead.publish）
    - 配方 `publishing-operations`（按需成员）

## DSH 运行时

- **callable**：当子任务的目标是「商务接收与工程验证角色独立」且领域属于 `bugfix`、`business`、`content_operations`、`documents`、`engineering`、`office`、`publish`、`release` 时被主帅引用。反触发：不让商务满意分抵消硬失败
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：bugfix、business、content_operations、documents、engineering、office、publish、release
- **typed_intents**：bug_fix、content_operations、content_review、contract_risk、delivery_management、distribution、document、incident_diagnosis、office_render、pdf、platform_adaptation、presentation、proposal、publication_delivery、publishing_connector、quotation、regression_fix、release_package、requirement_analysis、root_cause、skill_packaging、spreadsheet、studio_positioning、word

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。