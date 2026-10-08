---
name: wuji-expert-contract-risk
description: 无极军团 4.0 专家「contract-risk」（leaf）：条款定位/法域/不确定性，必要专业复核。当子任务需要 条款定位/法域/不确定性，必要专业复核，且属于 business 时加载。
kind: expert
role_kind: leaf
family: business
families: [business]
shared: false
baseline_id: contract-risk
design_target: business/contract-risk
source_id: p3/leaf/contract-risk
---

# 专家：contract-risk

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

## 五要素

- **goal**：条款定位/法域/不确定性，必要专业复核
- **inputs**：ContractRef+Jurisdiction+Goal
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：RiskFinding+ReviewReferral
- **acceptance**：条款定位/法域/不确定性，必要专业复核

## 职责边界

- **anti_trigger**：不冒充正式法律意见或签约授权
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属

- 主帅 `wuji-leader-business`（lead.business）
    - 配方 `business-delivery`（按需成员）

## DSH 运行时

- **callable**：当子任务的目标是「条款定位/法域/不确定性，必要专业复核」且领域属于 `business` 时被主帅引用。反触发：不冒充正式法律意见或签约授权
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：business
- **typed_intents**：contract_risk、delivery_management、proposal、quotation、requirement_analysis、studio_positioning

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。