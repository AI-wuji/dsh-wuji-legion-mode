# 确定性前置检查（Preflight）

> **来源**：WorkBuddy `prompt-meta-team` 的 `eval/preflight.md`，经无极军团融合。
> **执行者**：主理人（`wb-prompt-meta-team-team-lead`）或编排方。
> **时机**：每份产物落盘后、**派评审之前**。

## 原则

**能机器判定的事，绝不交给 LLM 主观打分。**

preflight 未通过，不给主观评审留下「看起来还行」的模糊空间。
确定性失败不进主观打分 —— 否则机器已确认的硬伤会被主观高分稀释成 A 级。

结果路由：`PASS` → 进双评审门；`FAIL` → 按「处置」列路由；无法执行 → `BLOCKED`。

## 与 SHA 绑定的关系

**preflight 第 2 项就是 sha256 校验**，因此跑 preflight 前必须先算哈希。
哈希算不出来 = 第 2 项失败 = `BLOCKED`。

**两者不可分离**：没有 sha256，评审结论可以被悄悄换到另一份产物上 ——
你改了文件，评分卡还是旧的，看起来还是"过了"。

---

## 0. 产物标识

| # | 检查项 | 判定方式 | 失败处置 |
|---|---|---|---|
| 1 | 产物文件存在且非空 | 文件系统 | BLOCKED |
| 2 | sha256 已计算并写入报告头 | 重算比对 | BLOCKED |
| 3 | 头部版本标识 `[domain: X, version: Y]` 存在 | 正则 | REVISE |

## 1. 结构正确性（结构级失败 = REBUILD）

| # | 检查项 | 判定方式 | 失败处置 | 依据 |
|---|---|---|---|---|
| 4 | 字段名与官方拼写逐字一致 | 枚举比对 | REBUILD | `[官方]` |
| 5 | 必填字段齐全、无空值 | 结构解析 | REBUILD | `[官方]` |
| 6 | 结构标签位置正确 | 位置校验 | REBUILD | `[官方]` |
| 7 | 同产物内无跨模型语法混写 | 特征校验 | REBUILD | 铁律 |
| 8 | 参考标签编号连续无跳号 | 序列校验 | REBUILD | `[官方]` |

### 各域字段清单（判定用）

```text
H3 Base 模式（必须三字段齐全、顺序一致）
  integrated_multimodal_description
  overall_soundscape
  non_diegetic_music

H3 Ref2VA 模式（必须六段齐全、顺序一致）
  subject_definitions / summary / retention_analysis
  detailed_description / overall_soundscape / non_diegetic_music

retention_analysis 取值域（只允许这四个）
  可见: fully_preserved | partially_preserved | attribute_transfer | weak_reference
  音频: fully_copy | partially_copy | reference | weak_reference

Seedance 2.5 四段式
  Asset mapping → one-sentence brief → timeline/shot order → global constraints

GPT Image 2.5 编辑四块（顺序敏感：Change 必须在 Preserve 之前）
  Change: → Preserve: → Integrate: → Exclude:

MiniMax Music 3 歌词标签（14 个，大小写不敏感）
  [Intro] [Verse] [Pre Chorus] [Chorus] [Interlude] [Bridge] [Outro]
  [Post Chorus] [Transition] [Break] [Hook] [Build Up] [Inst] [Solo]

YuE2 三字段
  style | lyrics | cot + abc   （abc 必须配合 cot=full 或 cot=melody）
```

## 2. 容量与预算（可修 = REVISE）

| # | 检查项 | 判定方式 | 失败处置 | 证据等级 |
|---|---|---|---|---|
| 9 | 字符数 / 时长在上限内 | 计数 | REVISE | 按来源标注，不得升格 |
| 10 | H3 运镜三维度齐全（motion type / amplitude / speed） | 句法校验 | REVISE | `[官方]` |
| 11 | 运镜写在句内自然动作，非句尾堆砌 | 位置校验 | REVISE | `[官方]` |
| 12 | Zoom / Push 未混用 | 语义校验 | REVISE | `[官方]` |
| 13 | 三层运动显式拆分（主体 / 相机 / 环境） | 三项齐全 | REVISE | 铁律 |
| 14 | Seedance 素材派活成对 | 句式校验 | REVISE | `[官方]` |
| 15 | 负面约束为行为式，非形容词式 | 词法校验 | REVISE | `[官方]` |
| 16 | 编辑类任务顺序：先锁不变项，再说变化项 | 顺序校验 | REVISE | 铁律 |
| 16a | 叙事段落时长未均分（钩子短、高潮长） | 段落时长序列校验 | REVISE | 实战素材 |
| 16b | 双层时长分离：叙事段落时长 ≠ 生成单元时长 | 结构校验 | REVISE | 实战素材 |
| 16c | 旁白字数落在区间内：`秒÷60×180 ≤ 字数 ≤ 秒÷60×250` | 算术校验 | REVISE | 实战素材 |
| 16d | 非音画同步路径未混入旁白/音效字段 | 字段存在性 + 声明核对 | REVISE | 实战素材 |

### 2b. 时长能力档案（无档案 = BLOCKED）

> 生成类产物的时长上限**不得写死**。

| # | 检查项 | 判定方式 | 失败处置 |
|---|---|---|---|
| 16e | 存在时长能力档案（provider/model/mode/parameters/duration_control/verified_at/evidence） | JSON 字段校验 | BLOCKED |
| 16f | `duration_control` 取值合法（`fixed`/`discrete`/`range`/`unknown`） | 枚举校验 | BLOCKED |
| 16g | 档案绑定生成模式与关键参数；模式/分辨率/提供商变更后已重新建档 | 时间戳与字段比对 | REVISE |
| 16h | `duration_control = unknown` 时未提交付费批量生成 | 交叉核对 | 一票否决 D |
| 16i | 选档策略正确 | 算术校验 | REVISE |
| 16j | 未把 5/10/15 秒当作所有模型的通用默认值 | 词表 + 上下文校验 | REVISE |
| 16k | 每个生成单元记录「内容所需时长/选定档位/实际传入参数/实际产出时长」四项 | 字段校验 | REVISE |
| 16l | 外部平台文档的时长未被冒充为本项目契约（须标 `[合作方]`） | 证据等级校验 | REVISE（升级 D） |

## 3. 证据与诚信（不可升格 = REVISE；伪造 = 一票否决 D）

| # | 检查项 | 判定方式 | 失败处置 | 依据 |
|---|---|---|---|---|
| 17 | 每条具体规则带证据等级 | 正则 | REVISE | 铁律一 |
| 18 | 无 `[合作方]` 伪装为 `[官方]` | 交叉核对来源 | REVISE（升级 D） | 铁律一 |
| 19 | 无编造的字段名 / 公式 / 参数 | 与官方文档核对 | 一票否决 D | 铁律一 |
| 20 | 「模型无公开公式」已如实声明 | 关键词校验 | REVISE | 铁律一 |
| 21 | 无禁用空词（越详细越好 / 完美 / 极致 / 非常震撼） | 词表匹配 | REVISE | 铁律二 |
| 22 | 无滑块数值写入提示词 | 词法校验 | REVISE | 各域规则 |
| 23 | 音乐标签未出现在音效 / TTS 提示词中 | 跨域词表 | REBUILD | 铁律二 |

## 4. 报告格式（必须落盘，与产物同目录）

```text
[preflight: <产物名>, version: Y]
产物路径: <path>
sha256: <64 位>
检查项总数: 35
通过: 1,2,3,4,5,6,7,8,9,...
失败: 10 → 运镜缺 amplitude 与 speed（依据 [官方]）
      17 → 3 条硬性规则未标证据等级
结果: FAIL
处置: REVISE
退回: video-prompt-architect
```

## 5. 路由速查

```text
PASS                                → 进双评审门
FAIL（可修项 9–16d, 16g–16l, 21–22） → REVISE → 退回原 owner 定点补强
FAIL（结构级 4–8, 23）               → REBUILD → 该域流程重跑
FAIL（诚信级 19, 16h）               → 一票否决 D
BLOCKED（1,2 失败；16e,16f 失败）     → 停止本轮，回 Phase 1 确认输入
```

**分组计数（共 35 项）**：产物标识 3（#1–3）/ 结构正确性 5（#4–8）/
容量与预算 12（#9–16、16a–16d）/ 时长能力档案 8（#16e–16l）/ 证据与诚信 7（#17–23）。

**REVISE 重试上限 2 次**，第 3 次仍不通过强制转 REBUILD；
REBUILD 后仍不通过转 BLOCKED 并向用户报告模型能力边界不足。

---

## 已知的源材料不一致

源 agent 文件 `scoring-expert.md` 的输入契约里写的是「preflight 报告（**12 项**检查结果）」，
而本规范文件自己写着「**检查项总数: 35**」，并列出 35 项的分组计数。

**以本文件的 35 项为准** —— 它给出了逐项清单和分组计数，是可核对的；
「12」无任何清单支撑。

这是源材料自身的内部不一致，融合时**标注而非照抄**。

## 在无极军团中的落地状态

| 项 | 状态 |
|---|---|
| 清单正文 | ✅ 已融合（本文件） |
| 逐项检查的执行 | ⚠️ **未自动化** —— 目前只有规范，没有脚本真的去跑 35 项 |
| sha256 计算 | ⚠️ **未自动化** —— 需要编排方手工调用 |
| 强制拦截 | ❌ **没有** —— 不存在"不跑 preflight 就不放行"的机制 |

**这是设计意图的一部分，不是遗漏**：WorkBuddy 里 preflight 由主理人「跑或向主理人索要」，
本身也是**人工/编排层行为**，不是模型层自动门。

在 DSH 侧，对应的做法是：**编排方（阿极或主帅）在派评审前，先跑 `scripts/wb-preflight.mjs`
产出报告，再把报告作为输入契约交给评审角色。** 评审角色收到缺 preflight 的任务时，
应当如实标注（如 `wb-scoring-expert` 所做的那样降级为 `NO_PREFLIGHT`），而不是假装有。
