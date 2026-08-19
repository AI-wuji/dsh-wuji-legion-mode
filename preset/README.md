# 无极军团 preset

`preset/` 是可直接由安装脚本部署的 DSH 原生 agent preset，不是设计草案。

```text
preset/
├── agent.cordis.yml  # Wuji 会话的完整 Cordis composition
└── preset.yml        # 选择器名称、顺序和描述
```

安装后的位置为：

```text
$DSH_HOME/.agent-presets/wuji/
```

DSH 在新会话开始前从 preset roster 选择 `wuji`。只有该 preset 的 standing composition 会加载 `wuji-runtime` group：阿极 persona、十一条铁律、Wuji 工具、能力目录与投影注册都由这个 group 挂载。其他 preset 不会挂载它。

`wuji-runtime` 使用 Cordis `isolate` 为 `wujiStaff` 建立 preset-private realm；`sessionProjections`、sandbox、审批、持久化和 subagent provider 则复用 DSH 宿主服务，不复制第二套全局中枢。

完整安装、隔离边界和验证步骤见 [`../docs/MODE-IMPLEMENTATION.md`](../docs/MODE-IMPLEMENTATION.md)。
