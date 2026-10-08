---
name: ponytail-code
description: PonyTail 代码领域适配：写代码、修 bug、重构、代码审查、依赖选择和代码设计。
license: MIT
---

# PonyTail Code

在理解完整调用链之后，执行上游 PonyTail 阶梯：是否需要存在、仓库是否已有、标准库、平台原生能力、已安装依赖、一行实现、最小正确代码。

Bug 修复先 grep 所有调用方并修根因，不只补工单指出的症状。禁止无请求抽象、未来脚手架、重复 helper、单实现 factory/interface 和无必要依赖。删除优先，最短正确 diff 优先。

不得删除输入校验、错误处理、安全措施、可访问性、用户明确要求或必要验证。非平凡逻辑留下一个最小可运行检查；有已知上限的有意简化用 ponytail: 注释写明上限和升级触发条件。