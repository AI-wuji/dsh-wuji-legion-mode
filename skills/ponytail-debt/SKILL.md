---
name: ponytail-debt
description: "一次性收集仓库中的 ponytail: 延后项，形成债务清单；只读，不修改文件。"
license: MIT
---

# PonyTail Debt

扫描代码注释中的 `ponytail:` 标记，报告每个被明确延后的简化项、上限和升级触发条件。

## 规则

- 跳过 `node_modules`、`.git` 和构建输出。
- 每个标记输出文件、行号、简化内容、上限和升级路径。
- 没有升级触发条件的标记标为 `no-trigger`。
- 只读报告；除非用户明确要求，不写入债务文件。

这是 PonyTail 官方辅助 Skill 的本地保留版本；不应把债务清单当作每个任务的强制流程。
