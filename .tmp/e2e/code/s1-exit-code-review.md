# s1 — t2 校验器退出码与 host 契约一致性复核

- 复核人：无极军团 4.0 专家 `code-repair`（加载技能 `wuji-expert-code-repair`）
- 日期：本轮会话
- 被测对象：`.tmp/e2e/code/t2-validate-frontmatter.mjs`（只读，**未修改**）
- 结论摘要：**4 个退出码的触发条件与代码路径逐条属实，0/1/2/3 全部实测复现。退出码契约与 host 语义不存在冲突，但「一致」必须限定为「判定集合一致」——退出码是本脚本自有的 CI 层协议，host 根本没有退出码概念。**

---

## 0. 先说清楚「一致」是什么意思

任务要求明确回答「退出码契约是否存在与 host 语义冲突的地方」。这里必须先钉死可比对象，否则结论会含糊：

| | host（`dsh-skill-filesystem/lib/index.js`） | t2 校验器 |
|---|---|---|
| 进程模型 | **进程内**，被 DSH 主进程调用 | **独立 CLI 进程** |
| 失败表达 | `ctx.logger.warn(...)` + `return;`（J:672/676/682/686/693） | `process.exit(N)` |
| 是否丢弃该 skill | 是（静默：只 warn，不抛，不影响其他 skill） | 不执行任何丢弃动作，**只报告** |
| 是否有退出码 | **没有**。函数 `return void 0` 或 `return {...}`，进程照常继续 | 有，0/1/2/3 |

**因此「退出码是否与 host 冲突」这个问法本身需要一个映射前提**：t2 的退出码只能与「host 对某个 skill 是否落入 `return;` 丢弃分支」这一**布尔判定**对齐，而不能与 host 的「进程结果」对齐 —— host 那条路径压根不产生进程结果。

**结论：不存在冲突。** 唯一的语义交汇点是「单个 skill 是否被 host 丢弃」，t2 用 `FAIL`(=被丢弃) 表达，退出码只是把 `FAIL` 聚合到进程层。两者在这一点上方向一致：t2 判 FAIL ⟺ host 走 `return;` 丢弃。退出码 0/1/2/3 中的 2 和 3 属于**脚本自身的用法/环境错误**，host 侧无对应物，因此也谈不上冲突 —— 它们是新增维度，不是对 host 语义的改写。

⚠️ 需要显式标注的一处**语义弱化**（非冲突，但影响 CI 判读）：host 对每个坏 skill 是**逐条丢弃、互不影响**（一个坏 skill 不影响其余 87 个正常加载）；而 t2 在「任一 skill FAIL」时统一 `exit 1`。这是聚合粒度差异，不是对错问题。若 CI 只想 fail 不想知道细节，粒度无影响；若要区分「哪几条会消失」，必须读 stdout 明细或 `--json`，**不能只看退出码**。

---

## 1. 逐条核对：4 个退出码的触发条件与代码路径

### 1.1 `0` = 全过

- **文档位置**：J:23 `退出码: 全过 = 0, ...`
- **代码路径**：
  - `main()` J:532-535：`if (jsonMode) { ...; return failed === 0 ? 0 : 1; }`
  - `main()` J:563：`return failed === 0 ? 0 : 1;`（文本模式）
  - `failed` 定义 J:530：`const failed = total - passed;`
  - `passed` 定义 J:529：`results.filter((r) => r.status === "PASS").length`
  - 而 `status` 定义 J:521：`r.errors.length === 0 ? "PASS" : "FAIL"`
- **关键推论**：`0` 的精确语义是 **「所有被扫描到的结果里 `errors` 全为空」**，而 `total` = 扫描到的目录数（J:528），**包含 `NO_FILE` 目录**。
- **重要边界（易误读）**：`NO_FILE`（目录下没有 SKILL.md）被记为 `status: "NO_FILE"`（J:509/J:514），它 **不是 PASS**，会被算进 `failed`。所以「退出码 0」保证的是「无 ERROR **且**无缺文件目录」，不是「没有 ERROR」。若一个 skills 根下有个空目录，退出码仍是 1 —— 这一点文档 J:23 未说明，属于**文档欠精确**，但并非契约错误。
- **实测**：见 §2 EXP-A，`88/88 passed, 0 failed`，`EXITCODE=0`。

### 1.2 `1` = 有失败

- **文档位置**：J:23
- **代码路径**：同 §1.1 的三元表达式 `failed === 0 ? 0 : 1`，两条出口（J:534 JSON 模式 / J:563 文本模式）逻辑一致。
- **触发条件**：任一 skill 的 `errors.length > 0`，或任一目录缺 SKILL.md。
- **实测**：见 §2 EXP-B（8/8 失败 → 1）与 §2 EXP-E（`--json` 模式下同样 → 1）。**两个出口路径都实测到了**，不是只测文本模式。

### 1.3 `2` = 用法错误

- **文档位置**：J:23
- **代码路径：这条其实有 2 个出口，文档只写了 1 个语义**
  - **出口 a｜缺参数**（J:480-483）：`if (!root) { stderr.write("usage: ..."); return 2; }` → 真正的「用法错误」。
  - **出口 b｜skills 根不可读**（J:487-492）：`try { readdirSync(rootAbs, ...) } catch (e) { stderr.write(\`cannot read skills root ...\`); return 2; }` → 这是**运行期 I/O 错误，却被归入退出码 2**。
- **判断**：把「路径不存在/不可读」也返回 2，与「用法错误」共用码值。宽泛看不影响 CI（两者都该中断），但语义上它更接近「环境错误」而非「用法错误」。**这是文档与实现的第二处欠精确**：J:23 只写「用法错误 = 2」，实测出口 b 的 stderr 文案是 `cannot read skills root`，不是 usage 文案。二者码值相同，**不构成与 host 的冲突**（host 无对应概念）。
- **实测**：出口 a 见 EXP-C；出口 b 见 EXP-F。

### 1.4 `3` = yaml 包不可用

- **文档位置**：J:23
- **代码路径**：顶层 await 块 J:568-584：
  - 取 `--yaml` 参数 J:568-572
  - `loadHostYaml()` J:47-63 → 遍历 `yamlCandidates()` J:36-44
  - 候选顺序：显式 `--yaml` → `DSH_YAML_DIR` 环境变量 → `DSH_HOME/profiles/node_modules` → 该包内嵌 `node_modules`
  - 全部失败 → `loaded.error` 为真 → J:575-582 写 stderr 说明并 `process.exit(3)`
- **关键设计点（值得肯定）**：J:580 明确写 `Refusing to fall back to a hand-rolled parser: it would not be equivalent to the host.` —— 即 **不静默降级**。这与 v1 的 4 个缺陷（D1-D4，根因正是自研窄解析器 ≠ host 的 yaml 包）方向一致：宁可退出 3，也不给出不等价结论。**这条是退出码契约里最有价值的一条**，因为它用退出码把「结论是否可信」显式暴露给了 CI。
- **实测**：见 §2 EXP-D，`EXITCODE=3`，且 stderr 列出了 3 条尝试路径。**可实测，非理论**（任务说「3 若无法实测就说明原因」—— 实际测到了）。

---

## 2. 实测命令与原始输出

所有命令工作目录：`E:\wuji-projects\dsh-wuji-legion-mode`；Node `v24.18.0`。

### EXP-A｜退出码 0（88 个真实 skill 主格）

```
node .tmp\e2e\code\t2-validate-frontmatter.mjs "C:\Users\Administrator\.dsh\profiles\node_modules\@wuji\dsh-wuji-bundle\skills"
```
```
[PASS] wuji-legion-4-0/SKILL.md

TOTAL: 88/88 passed, 0 failed
RESULT: ALL PASS
EXITCODE=0
```
stderr：
```
[parser] yaml@2.9.1 from C:\Users\Administrator\DeepSeek-Harness\node_modules\yaml\dist\index.js
```

### EXP-B｜退出码 1（负例夹具）

```
node .tmp\e2e\code\t2-validate-frontmatter.mjs .tmp\e2e\review\neg
```
```
TOTAL: 0/8 passed, 8 failed
RESULT: FAIL — the host would silently drop the failing skills and the model would see them as nonexistent.
EXITCODE=1
```
> 注：`t3-review.md` 记录 v1 时期此目录是 `1/8 passed`（`neg07-yaml-err` 被误 PASS，即缺陷 D3）。本轮 v2 实测为 **0/8**，说明 D3 已被 v2 修复。这是对 v2 修订有效性的**独立旁证**。

### EXP-C｜退出码 2，出口 a：缺参数

```
node .tmp\e2e\code\t2-validate-frontmatter.mjs
```
```
EXITCODE=2
```
stderr：
```
[parser] yaml@2.9.1 from C:\Users\Administrator\DeepSeek-Harness\node_modules\yaml\dist\index.js
usage: node t2-validate-frontmatter.mjs <skillsRoot> [--json] [--yaml <node_modules目录>]
```

### EXP-D｜退出码 3：yaml 包不可用

```
$env:DSH_HOME='C:\nonexistent-dsh-home-xyz'
node .tmp\e2e\code\t2-validate-frontmatter.mjs --yaml "C:\nonexistent-dsh-home-xyz" .tmp\e2e\review\neg
```
```
EXITCODE=3
```
stderr：
```
ERROR: cannot load the `yaml` package that the host itself uses.
Tried:
  - C:\nonexistent-dsh-home-xyz (目录不存在)
  - C:\nonexistent-dsh-home-xyz\profiles\node_modules (目录不存在)
  - C:\nonexistent-dsh-home-xyz\profiles\node_modules\@deepseek-ai\dsh-skill-filesystem\node_modules (目录不存在)
Pass --yaml <node_modules dir> or set DSH_YAML_DIR.
Refusing to fall back to a hand-rolled parser: it would not be equivalent to the host.
```
> 说明：本次只用 `--yaml` 指向不存在目录就触发了 3，无需真的破坏环境。`DSH_HOME` 也一并指向不存在路径以扩大覆盖面。**退出 3 已实测，不再是「未实测项」。**

### EXP-E｜退出码 1 在 `--json` 模式下（验证第二个出口 J:534）

```
node .tmp\e2e\code\t2-validate-frontmatter.mjs .tmp\e2e\review\fid2 --json
```
```
  "failed": 3,
EXITCODE=1
```
> 这证明 J:534 与 J:563 **两个** `return failed === 0 ? 0 : 1` 出口行为一致，避免「只测了一条路径」的漏检。

### EXP-F｜退出码 2，出口 b：skills 根不可读（J:487-492）

```
node .tmp\e2e\code\t2-validate-frontmatter.mjs "E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\NO_SUCH_DIR_XYZ"
```
```
EXITCODE=2
```
stderr：
```
cannot read skills root "E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\NO_SUCH_DIR_XYZ": ENOENT: no such file or directory, scandir 'E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\NO_SUCH_DIR_XYZ'
```

---

## 3. 对 host 契约的忠实度：判定集合一致性（不是退出码，但决定退出码是否可信）

退出码只有在「FAIL ⟺ host 丢弃」成立时才有意义。本项**不属于 s1 原始要求**，但它是退出码契约成立的前提，故一并给出代码级核对（host 源码本轮**逐行实读**，非转述）：

| t2 判定 | t2 代码行 | host 对应 | host 行号 | 是否一致 |
|---|---|---|---|---|
| 缺 frontmatter / 首行非 `---` | J:287-289 → error | `raw.slice(0,firstLineEnd) !== "---"` → `return void 0` | 783 | ✅ |
| 无闭合 `---` | J:291-299 → error | `findClosingFrontmatter` 返回 `void 0` | 786, 794-806 | ✅ |
| YAML 解析失败 | J:305-311 → error | `parse()` 抛出 → 外层 catch → warn | 671-674, 787 | ✅ |
| 解析结果非 mapping | J:312-314 → error | `typeof parsed !== "object" \|\| null \|\| Array` | 788 | ✅ |
| 缺 name/description 或空串 | J:394-402 → error | `stringField` 返回 `void 0` → `return` | 679-684, 841-844 | ✅ |
| name 非 kebab-case | J:405-409 → error | `!isSkillName(name)` → `return`；`isSkillName` 定义于 `@deepseek-ai/dsh-skill/lib/index.js:29-31`，正则 `SKILL_NAME` 在 `:17` | 685-688（+dsh-skill:17,29-31） | ✅ **正则逐字一致**（见下） |
| legacy 驼峰键 | J:382-388 → error | `rejectLegacyInvocationKey` throw → `return` | 691, 849-852, 860-862 | ✅（**顺序除外，见 s2**） |
| 布尔字段非法值 | J:434-440 → error | `frontmatterBoolean` throw TypeError | 863-877 | ✅ |
| `whenToUse` 类型错 | J:417-421 → **warning** | `optionalString` 静默忽略 | 845-848, 699 | ✅ 分级正确 |
| `metadata` 类型错 | J:424-431 → **warning** | `optionalMetadata` 返回 `{}` | 879-883 | ✅ 分级正确 |
| 未知键 | J:456-462 → **info** | 无白名单校验，静默忽略 | — | ✅ 分级正确 |

**ERROR / WARN / info 三级分级与 host 的「整条丢弃 / 只丢字段 / 无影响」完全对应**，这是退出码 `0/1` 具有「会否被静默丢弃」含义的基础。附带确认：host J:667-701 是**逐条 `return;`**，单个 skill 异常不影响其他 skill 加载；t2 亦逐目录独立 `results.push`（J:517-525），无交叉污染。

**关于 name 正则的逐字比对（本轮新增实测，闭合了原先的未确认项）**：

`dsh-skill-filesystem` 并不自己实现 name 校验，而是从 `@deepseek-ai/dsh-skill` 导入（`index.js:9`）：
```js
import { BUNDLED_SKILL_RANK, isSkillName } from "@deepseek-ai/dsh-skill";
```
该函数与其正则的**原文**（`@deepseek-ai/dsh-skill/lib/index.js`）：
```js
:17  const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
:29  function isSkillName(name) {
:30  	return SKILL_NAME.test(name);
:31  }
```
t2 侧的原文（`t2-validate-frontmatter.mjs:92`）：
```js
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
```
两者字面量**逐字符相同**。因此「name 格式」这一项的 PASS/FAIL 判定与 host 严格等价（正则等价 ⟹ 同一输入同一结果，无条件成立，不依赖样本）。

---

## 4. 结论

1. **退出码 0 / 1 / 2 / 3 的触发条件与代码路径逐条属实**；4 个码值**全部实测复现**（EXP-A/B/C/D），无「未实测」项。
2. **与 host 语义不存在冲突。** host 是进程内 `logger.warn` + `return`，不产生退出码；可比对象只有「单个 skill 是否被丢弃」这一布尔判定，t2 用 `FAIL` 表达且与 host 分支一一对应（§3 表）。退出码 2/3 描述的是**脚本自身的用法/环境错误**，host 无对应概念，属新增维度而非冲突。
3. **两处文档欠精确（非冲突，建议补文档而非改码）**：
   - 退出码 `0` 实际含义包含「无缺 SKILL.md 的目录」（`NO_FILE` 计入 failed，J:509/514/528-530），J:23 未说明。
   - 退出码 `2` 有**两个**出口（J:480-483 用法错误、J:487-492 根目录不可读），J:23 只描述了前者。
4. **一处值得保留的设计**：退出码 `3` + J:580「拒绝降级回自研解析器」，把「结论可信度」显式暴露给 CI，是防止 v1 类缺陷（D1-D4 假阳性/假阴性）复发的正确手段。
5. **未改动 `t2-validate-frontmatter.mjs`**（符合纪律）；本文件为唯一产物，写在指定范围 `.tmp/e2e/code/` 内。

### 剩余风险 / 未实测项

- **`DSH_YAML_DIR` 环境变量路径未单独实测**：EXP-D 只验证了「全部候选都不可用 → 3」这一终态。J:39 读取 `DSH_YAML_DIR` 的**成功**路径（用该变量指向一个有效 node_modules 后正常加载）**未实测**。理由：本机有效 yaml 已在候选中（`DeepSeek-Harness/node_modules/yaml`），构造有效值需复制整个包，收益低于成本；代码路径 J:39-40 与 J:49-57 已逐行审读，逻辑上与 `--yaml` 显式路径共用同一循环体（EXP-A 已证明该循环体能成功加载）。
- **`isSkillName` 的正则已逐字确认一致**（本轮补测，见 §3 末）：host `@deepseek-ai/dsh-skill/lib/index.js:17` 的 `SKILL_NAME` 与 t2:92 的 `SKILL_NAME_RE` 字面量完全相同。**此项已从「未确认」转为「已确认」**。
- **host 版本未记录**：结论仅对本机当前已安装副本成立（与 `t3-review.md` §未覆盖项 8 同一限制）。
- **性能/大规模目录**未测（与 t3 同）。
