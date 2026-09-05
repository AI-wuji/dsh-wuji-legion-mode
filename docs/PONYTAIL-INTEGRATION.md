# PonyTail 集成说明

## 结论

无极军团把 PonyTail 作为跨领域的最小正确行动前置，而不是把它做成“用户自己要记得调用的代码 Skill”。阿极先判断目标、复用和最小路径；只有确实复杂且已获准的任务才交给参谋部拆解，师团级主帅选择领域能力，worker 执行并返回证据。

## 背书与边界

- 上游仓库：[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)
- 上游核心 Skill：[skills/ponytail/SKILL.md](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md)
- 许可证：[MIT](https://github.com/DietrichGebert/ponytail/blob/main/LICENSE)
- 本次核验的上游 `main` commit：`974d940a1c5344210874150b98ff0d2c861fab6a`（2026-09-04）
- 工程原则参考：[Martin Fowler, YAGNI](https://martinfowler.com/bliki/Yagni.html)
- 安全与验证边界参考：[NIST SP 800-218 SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)

代码领域的阶梯、复用优先、YAGNI、根因修复和按需辅助 Skill 来自上游 PonyTail。调研、写作、文档、数据、演示、浏览器和飞书的适配器是 Wuji 扩展，明确不冒充上游原生能力。

## 运行接入

1. `preset/agent.cordis.yml` 的阿极 persona 常驻跨领域 PonyTail 规则。
2. 两份 capability registry 的 `ponytailAdapters` 将领域映射到适配器；`code-dev` 声明 `ponytail preflight` 为必经前置。
3. `skill-registry` 将 preflight、适配器和策略元数据暴露给宿主路由。
4. `staffDispatchTool` 给子任务注入最小 worker 规则；若父 prompt 已带标记则不重复注入。
5. `ponytail-review/audit/debt/gain/help` 是按需辅助 Skill，不是每个简单任务的强制流程。

## 不变项

本次集成没有改动阿极既有白帽能力，也没有改动上下文硬阈值：`220000`（near-limit）、`240000`（compact-required）、`260000`（blocked）。PonyTail 的“少做”原则不能绕过授权、安全、输入校验、错误处理、数据保护、可访问性、必要验证或完成证据。

## 更新上游

更新时重新核验上游源码入口、辅助 Skill、测试/探针和许可证；记录 commit、变更范围和本地行为测试结果。只有真实行为验证通过，才可把能力标记为 `behavior-verified` 或 `primary`。
