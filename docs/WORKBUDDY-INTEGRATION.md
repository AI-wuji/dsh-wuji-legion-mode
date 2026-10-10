# WorkBuddy 专家团融合说明

## 结论

**WorkBuddy `prompt-meta-team` 的 12 个 agent 已真融合进无极军团**，作为 DSH 技能随
preset 挂载、按需加载。不是文档里的映射表 —— 是 `wb-*` 开头的 12 个真实技能，
已装进本地 profile（技能总数 88 → **100**），并实测派出成功。

## 融合了什么

| 项 | 状态 |
|---|---|
| 源材料 | `C:\Users\Administrator\.workbuddy\plugins\marketplaces\my-experts\plugins\prompt-meta-team\agents\` |
| 源规模 | 12 份 agent 正文，8–25 KB 各一份 |
| 转换器 | `scripts/build-workbuddy-roles.mjs` |
| 产物 | `skills/wb-*/SKILL.md` + `packages/wuji-bundle/skills/wb-*/SKILL.md`（24 个文件） |
| 正文处理 | **忠实转录，未改写语义** |

## 12 个专家与归属

| 技能名 | 中文名 | 英文名 | 归主帅族 | 判据 |
|---|---|---|---|---|
| `wb-prompt-meta-team-team-lead` | 范策 | Fan Ce | governance | 主理人 = 编排与治理 |
| `wb-narrative-architect` | 唐砚 | Tang Yan | writing | 小说推文/片花/漫剧叙事结构 |
| `wb-image-prompt-architect` | 苏墨 | Su Mo | image | T2I/I2I 元指令 |
| `wb-video-prompt-architect` | 卢影 | Lu Ying | video | 视频生成提示词 |
| `wb-visual-asset-designer` | 顾形 | Gu Xing | image | 角色/道具/场景/音色四资产库 |
| `wb-storyboard-director` | 陆镜 | Lu Jing | video | 分镜/蒙太奇/运镜 |
| `wb-soundstage-architect` | 声场 | Sheng Chang | audio | 声音工程/声场 |
| `wb-video-editing-architect` | 纪叙 | Ji Xu | video | 剪辑 |
| `wb-precedent-researcher` | 探源 | Tan Yuan | research | 全网参考检索与成品比对 |
| `wb-objective-critic` | 镜观 | Jing Guan | governance | 第三方客观批判 |
| `wb-scoring-expert` | 衡分 | Heng Fen | governance | 量化打分与档位 |
| `wb-skill-evolution-architect` | 容知 | Rong Zhi | governance | Skill 资产自进化 |

**归属是人工判定的**，不是从源材料推导的 —— WorkBuddy 是单团队（prompt-meta-team），
本身没有「主帅族」概念，必须逐个指定它在无极里归谁管。判据是该角色的**实际产出物
属于哪条交付链**。

## 命名决策：为什么加 `wb-` 前缀

不改名会与现有 57 个 `wuji-expert-*` 撞名。例如 WorkBuddy 的 `video-prompt-architect`
与无极的 `video-production` **职责相邻但不等同**：

- `video-production`：MusicCue/Shot/Timeline/Sound 版本一致且实际输出
- `wb-video-prompt-architect`：MiniMax H3 / Seedance 2.5 的提示词元指令设计

加前缀让**两者并存、可按需选择**，而不是互相覆盖。如果直接叫 `video-prompt-architect`，
反而会制造两套说法。

## 实测记录

### 1. 产物完整性

- 24 个文件（12 agent × 2 目录）生成并同步，`--check` 校验一致；
- 中文零乱码（Node 读文件校验，非 pwsh 显示）；
- 宿主规则对拍：**100/100 通过，0 失败**（含新增 12 个）。

### 2. 真派发测试（2026-10-10）

派出 `wb-scoring-expert`（衡分），任务是对一份元指令草案做模式 C 打分。

**结果：跑通，产物真实落盘。**

- 产物：`.tmp/e2e/wb-test/scorecard.md`，**10,037 B / 123 行**
- 结论：35/100 · D · 建议 REVISE · 最该改 ③ 差异质量
- 判定分布：✅2 / ⚠️3 / ❌5（五个 ❌ 中 ③⑤⑥⑨⑩ 属高严重度）

**这次测试证明了什么**：它不只是格式对，而是**真的按自己的规则在判**——
几个只有内行才会做的动作：

1. **主动指出输入契约缺项**：任务没给文件路径、没给 sha256、没有
   preflight 报告。它没糊过去，而是明确标注「严格按契约当判 `BLOCKED`」，
   然后**降级为 `NO_PREFLIGHT` 条件评分**，并限定结论只对内联正文版本有效、
   **不得迁移到磁盘文件版本**。
2. **拒绝重复扣分**：红线 2「严重同质化」接近触发，但它按字面判**未触发**，
   理由是该项性质已计入维度 ③，重复扣分等于罚两次。
3. **做了稳健性检验**：补入 preflight 后，无论结构级失败（→D）还是可修项失败
   （→上限 C），结论都不变 —— 主动证明档位结论不依赖缺失的那份报告。
4. **指出虚假强制力**：「必须严格…否则失败」的措辞强度与规则真实强度不匹配 ——
   三条格式本身没有强制技术理由，却给了最高强制等级。

## 诚实边界

- **融合的是角色定义，不是运行环境。** 源材料大量引用 WorkBuddy 专有机制
  （`SendMessage` 回传主理人、`rejected_edits.md` 回灌、双字段分框、preflight 12 项）。
  DSH 侧没有这些宿主机制，**引用它们的地方不会自动生效**。
  当前做法是**保留原文**（因为它描述了完整的协作契约），但**不声称这些机制已接通**。
- **`max_turns` 是源材料的值**（80–200），DSH 侧不读这个字段。
- **一次派发成功不等于 12 个都验证过。** 已实测的是 `wb-scoring-expert` 一个；
  其余 11 个只验证了「生成正确、格式合规、可被加载」，**未逐个跑真实任务**。
- 源材料本身标注过其专业效果「未独立验收」；本次融合不改变这一点。

## 更新方式

源材料改动后重跑即可，不需要手写任何技能文件：

```powershell
node scripts\build-workbuddy-roles.mjs          # 生成
node scripts\build-workbuddy-roles.mjs --check  # 校验与源一致
node scripts\build-workbuddy-roles.mjs --stats  # 只看归属统计
```

源里删掉的 agent，重跑时会自动清理对应的输出目录（孤儿清理）。
新增 agent 时**必须先登记到 `FAMILY_OF`**，否则脚本会拒绝生成并提示
「未在 FAMILY_OF 中登记归属」—— 这是有意的：不让人在归属不明的情况下
把角色塞进军团。
