---
name: wuji-expert-art-director
description: 无极军团 4.0 专家「art-director」（leaf）：审美方向与资产验收具体，权限事实不变。当子任务需要 审美方向与资产验收具体，权限事实不变，且属于 image、studio_video、video 时加载。
kind: expert
role_kind: leaf
family: image
families: [image, video]
shared: true
baseline_id: art-director
design_target: visual/style-direction
source_id: p3/leaf/art-director
---

# 专家：art-director

> 本文件是**一份职责书**，不是「怎么写代码」的教程。
> 它说明：什么情况下该用我、需要什么输入、产出什么、怎么算达标、什么情况下**不该**用我。
> 模型本身就会的通用知识不在此重复。

> **本角色是共享专家**，被 2 个主帅引用。任何引用它的主帅都可以按条件使用它，
> 它不专属于某一个团。

## 五要素

- **goal**：审美方向与资产验收具体，权限事实不变
- **inputs**：Brief+StyleChoices+Rights+IdentityLocks
- **process**：按workflow-contracts当前领域流程；程序先检权限/版本/真实输入，缺口返负责人
- **output**：StyleSpec+AssetBriefs
- **acceptance**：审美方向与资产验收具体，权限事实不变

## 职责边界

- **anti_trigger**：风格包不复制成整套专家
- **scope_rule**：read and write grant required for every exact ref; no inferred user decision
- **cancellation**：return localized checkpoint to leader; external unknown queried, native slot retained until trusted close

## 归属（共享，2 个主帅）

- 主帅 `wuji-leader-image`（lead.image） —— **主属**
    - 配方 `image-delivery`（按需成员）
- 主帅 `wuji-leader-video`（lead.video）
    - 配方 `video-production-delivery`（按需成员）

## DSH 运行时

- **callable**：当子任务的目标是「审美方向与资产验收具体，权限事实不变」且领域属于 `image`、`studio_video`、`video`、`visual` 时被主帅引用。反触发：风格包不复制成整套专家
- **tools**：`subagent` 起真实子代理执行；读 `wuji_staff_plan` 确认自己的写范围是否与他人冲突
- **domains**：image、studio_video、video、visual
- **typed_intents**：creative_direction、film、image_edit、image_generation、narrative_video、series_video、short_video、studio_production、style_direction、video_preproduction、video_production、visual_asset

## 诚实标注

本条职责定义源自上游无极军团 4.0 的 `catalog/p3/experts.json`。
上游对该目录的整体标注是「契约已写、专业效果未验证」，因此：

- 五要素与边界字段**忠实转录**自源数据；
- 「怎么做到」不属于本文件的保证范围 —— **实际效果必须以真实产物回交为准**；
- 本文件证明的是「职责已定义且可被选择」，**不证明该职责已被独立验收**。