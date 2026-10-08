// Wuji Legion 4.0 bundle —— patch-only，无 host 平面行为。
//
// 这个包存在的唯一理由是让 dsh 的 bundle 机制能发现 `cordis.patch.yml`：
// profile 的 `dsh.profile.bundles` 按包名加载，loader 读该包的 `dsh.bundle.patch`
// 数组并逐层 apply。
//
// 4.0 改造后，preset 内不再有任何自研 @wuji/* 运行时，全部能力由官方
// @deepseek-ai/* 插件行承载（persona、tool-workflow、tool-subagent、tool-ralph、
// tool-goal、tool-todo、tool-present、skill-filesystem、tool-skill 等）。
// 因此本包不需要、也不应该注册任何 host 能力。
//
// 若 DSH 的 loader 也会实例化 bundle 的 main 入口，导出一个无副作用的 Cordis 插件，
// 保证它在任何组合下都不会改变 host 行为。

export default {
  name: 'wuji-bundle',
  apply() {
    // 无 host 行为：军团能力全部由 wuji preset 内的官方插件行承载。
  },
};
