# t3 — 独立评审报告：t2-validate-frontmatter.mjs

> 评审角色：无极军团 4.0 主帅 `bugfix`（配方 `bugfix-delivery`），**独立评审者**
> 评审纪律：不采信作者自述。以下每个数字均为本评审自己运行所得。
> 评审环境：Windows / Node v24.18.0
> 评审范围：只读 t1、t2 与 host 实现；所有新建文件写入 `.tmp/e2e/review/`。
> **未修改任何现有文件。**

---

## 产物

路径：`E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\t3-review.md`
大小：见文件系统（本报告由评审过程生成）
辅助产物（评审自建，均在 review/ 下）：
- `E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\oracle.mjs` — 真值裁判，从 harness 安装位置加载 host 真正使用的 `yaml` 包，精确复刻 host 的 `parseFrontmatter`（J:780-805）
- `E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\{neg,fp,fp2,fp3,fid,fid2,delim}\` — 自建夹具，共 35 个用例

---

## 我自己实测的结果

### 0. 关键前提：host 用的是完整 yaml 包，不是窄解析器

这是本次评审最重要的**上游事实**，t1 已给出但结论未被 t2 显式承接：

```
dsh-skill-filesystem/lib/index.js:7    import { parse } from "yaml";
```

我在真值裁判中确认该包可解析：

```
> node -e "..." # require.resolve 从 dsh-skill-filesystem 出发
C:\Users\Administrator\DeepSeek-Harness\node_modules\yaml\dist\index.js
```

**含义**：host 使用 eemeli/yaml（完整 YAML 1.2 实现）。t2 自研的「窄子集解析器」所拒绝的任何**合法 YAML**，都是**真实假阳性**，而不是保守从严的合理取舍。作者所承认的「可能假阳性」风险，是可被证实的现实缺陷，不是理论担忧。

### 1. 复核作者的 88/88 PASS

命令（自己执行，未转述作者）：

```
node .tmp/e2e/code/t2-validate-frontmatter.mjs "C:\Users\Administrator\.dsh\profiles\node_modules\@wuji\dsh-wuji-bundle\skills"
```

真实输出（尾部）：

```
TOTAL: 88/88 passed, 0 failed
RESULT: ALL PASS
EXITCODE=0
```

独立计数（对输出按行前缀统计，不依赖脚本自报）：

```
[PASS] 行数 = 88
[FAIL] 行数 = 0
[SKIP] 行数 = 0
ERROR:  行数 = 0
输出总行数 = 635
```

**结论：作者声称的 88/88、退出码 0，经我独立复跑与独立计数，属实。**

### 2. 复核作者的「11 个负例夹具 7 个 FAIL」

工作区内**未发现作者的 11 个夹具**（`.tmp/e2e/code/` 下只有 t2 脚本本身，无夹具目录）。因此**无法复核这 11 个的具体构成**。我改为自建 8 个负例夹具独立验证：

命令：

```
node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/neg
```

真实输出（摘录）：

```
[FAIL] neg01-no-desc/SKILL.md
    - ERROR: missing required field "description" -> whole skill dropped [t1 §1 / J:679-684]
[FAIL] neg02-upper-name/SKILL.md
    - ERROR: invalid skill name "Neg02-Upper": must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/ ...
[FAIL] neg03-camel/SKILL.md
    - ERROR: frontmatter field "disableModelInvocation" is unsupported; use "disable-model-invocation" ...
[FAIL] neg04-bad-bool/SKILL.md
    - ERROR: "user-invocable" must be a boolean (got "maybe" / string) ...
[FAIL] neg05-no-fm/SKILL.md
    - ERROR: missing YAML frontmatter (first line is not exactly ---) ...
[FAIL] neg06-double-hyphen/SKILL.md
    - ERROR: invalid skill name "neg06--double": must match ...
[PASS] neg07-yaml-err/SKILL.md          <-- 我构造的「YAML 语法错」用例被 PASS（见缺陷 D3）
[FAIL] neg08-no-close/SKILL.md
    - ERROR: missing YAML frontmatter (no closing --- line found) ...

TOTAL: 1/8 passed, 7 failed
EXITCODE=1
```

**结论：脚本确实会 FAIL，不是永远 PASS。** 我自建 8 例得 7 FAIL，与作者声称的「11 例 7 FAIL」数量上巧合一致，但**因作者的夹具缺失，属于两套不同夹具，不能互证**。我按任务要求构造的 5 类负例（缺 description、name 带大写、驼峰、布尔非法、无 frontmatter）**全部被正确判 FAIL**。

### 3. 退出码验证

```
node <t2> <FAIL 目录>            -> exit=1
node <t2> <真实 88 目录>          -> exit=0
node <t2>                        -> exit=2   (usage error，写 stderr)
```

**退出码语义正确，可用于 CI。**

---

## 发现的缺陷

### D1 —【严重 / 假阳性】内联数组/映射按裸逗号切分，引号内含逗号即误判 FAIL

**这是本次最有价值的发现，证实作者承认的假阳性风险真实存在。**

`t2:103` `for (const part of inner.split(","))` 与 `t2:115` 同样逻辑：对 `[...]` / `{...}` 内部做**不感知引号的逗号切分**。合法 YAML 中引号内的逗号不会被切分，但 t2 会切断引号，随后 `parseScalar` 报 `unterminated double-quoted string`，整条 skill 被判 FAIL。

最小复现（5 行，纯合法 YAML）：

```
E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\fp2\fp-m1-comma-in-array\SKILL.md

---
name: fp-m1-comma-in-array
description: minimal repro
metadata:
  tags: ["a,b"]
---
```

复现命令与两侧真实输出：

```
> node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/fp2
[FAIL] fp-m1-comma-in-array/SKILL.md
    - ERROR: invalid YAML frontmatter: unterminated double-quoted string (line 4) -> whole skill dropped
[FAIL] fp-m2-comma-in-map/SKILL.md
    - ERROR: invalid YAML frontmatter: unterminated inline sequence (line 3) -> whole skill dropped
[FAIL] fp-m3-whentouse/SKILL.md
    - ERROR: invalid YAML frontmatter: unterminated double-quoted string (line 5) -> whole skill dropped
TOTAL: 0/3 passed, 3 failed

> node .tmp/e2e/review/oracle.mjs .tmp/e2e/review/fp2/fp-m1-comma-in-array/SKILL.md
HOST OK
{ "name": "fp-m1-comma-in-array", "description": "minimal repro",
  "metadata": { "tags": [ "a,b" ] } }

> node .tmp/e2e/review/oracle.mjs .tmp/e2e/review/fp2/fp-m3-whentouse/SKILL.md
HOST OK
{ ..., "whenToUse": "Use when X, Y, or Z",
  "metadata": { "keywords": [ "alpha, beta", "gamma" ] } }
```

**host 接受，t2 判 FAIL。确凿假阳性。** 影响面：`metadata` 是 t1 明确列出的合法可选字段，`metadata.keywords: ["a, b"]` 是自然写法。CI 中会**误拦截完全合法的 skill**。

---

### D2 —【严重 / 假阳性】块状序列（block sequence）被当作非法语法

`t2:150-152` 只要行内容以 `"- "` 开头就返回 error，但该分支在**任何缩进层级都会触发**，包括合法的 `metadata:` 下的块状序列。

复现：

```
E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\fp3\fp3-04-block-seq\SKILL.md

---
name: fp3-04-block-seq
description: seq value
metadata:
  tags:
    - alpha
    - beta
---
```

```
> node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/fp3
[FAIL] fp3-04-block-seq/SKILL.md
    - ERROR: invalid YAML frontmatter: top-level sequences are not valid frontmatter here (line 5) -> whole skill dropped

> node .tmp/e2e/review/oracle.mjs .tmp/e2e/review/fp3/fp3-04-block-seq/SKILL.md
HOST OK
{ "name": "fp3-04-block-seq", "description": "seq value",
  "metadata": { "tags": [ "alpha", "beta" ] } }
```

报错文案自称「top-level sequences」，但实际在第 5 行（`metadata:` 的嵌套层级）触发 —— **文案与判定逻辑不符**。同样地，`t2` 自述支持「块状映射」却拒绝块状序列，而 host 两者都接受。

---

### D3 —【中 / 假阴性】Tab 缩进未被识别为缩进，非法 YAML 被放行

`t2:141` `indentOf = rawLine.length - rawLine.trimStart().length` —— `trimStart()` 会剥掉 `\t`，但 `\t` 只有 1 个字符宽度。于是以 Tab 缩进的子键被算成**同级**，与父键同层，既不报错也不错位，**静默解析成一个混乱但「成功」的映射**。

复现：

```
E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\neg\neg07-yaml-err\SKILL.md

---
name: neg07-yaml-err
description: ok
metadata:
	bad: tab
---
```

```
> node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/neg
[PASS] neg07-yaml-err/SKILL.md      <-- 应 FAIL
```

**方向已用 host 的 `yaml` 包闭合证明（决定性证据）：**

```
> node -e "YAML.parse('name: neg07-yaml-err\ndescription: ok\nmetadata:\n\tbad: tab\n')"
HOST YAML PARSE THROWS -> Tabs are not allowed as indentation at line 4, column 1
```

**host 抛错 → t2 判 PASS。这是确凿的假阴性：一个真正会被丢弃的 skill，t2 报告它「全过」。**

两者根因相同：`t2:141` 用 `trimStart()` 计算缩进宽度，而 `trimStart()` 把 `\t` 当作可剥字符、宽度记为 1，于是 Tab 缩进的子键被算作与父键**同级**，既不报错也不报越界，静默产出一个「成功」的映射。真实的 YAML 缩进规则**禁止 Tab**，二者不等价。

**同一根因同时产生 D1/D2/D4 的假阳性与 D3 的假阴性 —— 这使 D3 从「提示」升级为「门禁可信度问题」：校验器不仅会误杀合法文件，还会漏放非法文件。**

严重度：**中高**（假阴性方向上，CI 门禁会放行一个实际会被 host 丢弃的 skill）。

---

### D4 —【中 / 假阳性】锚点与别名一律拒绝

`t2:125-127` 显式把 `&` / `*` 开头一律判为 error。锚点/别名是合法 YAML。

复现：

```
E:\wuji-projects\dsh-wuji-legion-mode\.tmp\e2e\review\fp3\fp3-03-anchor\SKILL.md

---
name: fp3-03-anchor
description: &d shared text
whenToUse: *d
---
```

```
> node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/fp3
[FAIL] fp3-03-anchor/SKILL.md
    - ERROR: invalid YAML frontmatter: YAML anchors/aliases are not supported by this validator's parser (line 2) -> whole skill dropped

> node .tmp/e2e/review/oracle.mjs .tmp/e2e/review/fp3/fp3-03-anchor/SKILL.md
HOST OK
{ "name": "fp3-03-anchor", "description": "shared text", "whenToUse": "shared text" }
```

**host 接受。** 严重度低于 D1/D2：skill frontmatter 里用锚点属罕见写法；但报错文案诚实标注了「by this validator's parser」，且该 error 被计入 FAIL 会污染 CI 门禁。**注意此为与 D1/D2 同类（假阳性）的第三个独立实例 —— 自研解析器的假阳性不是孤例。**

---

### D5 —【低 / 忠实度】`metadata: null` 场景 t2 判定与 t1 表述的取舍

`t1` §2.3 表格把 `metadata` 的非法类型（字符串/数组/null）统一记为「静默丢弃该字段，skill 仍生效」。t2 对 `metadata` 的类型检查（`t2:364-371`）确实只产生 WARNING。此点**与 t1 一致，无缺陷**。

但 t2 **未覆盖** t1 §2.3 表格中 `metadata` 为 `null` 的显式情形验证 —— 我在 `fid2-meta-string` 中验证了字符串情形（t2 正确 WARN、host 正确保留 skill，`TOTAL: 4/5`，仅 `fid5` FAIL），`null` 情形**未单独实测**，列为未覆盖。

---

### D6 —【低 / 忠实度】错误检查顺序与 host 不一致（仅影响诊断可读性）

host 的顺序是 `name/description` → `isSkillName` → `parseInvocationPolicy`（J:679-695）。
t2 的顺序是**先**报 legacy 驼峰别名（`t2:322-328`），**再**报必填字段与 name 格式。

后果：一个既 `name: BadName` 又带 `userInvocable` 的文件，t2 会先报 legacy 错，而 host 会先因 name 非法丢弃、**根本走不到 invocation 检查**。二者最终结论都是 FAIL（不影响门禁正确性），但**报告的「首要原因」与 host 真实日志不同**，会误导排障方向。此缺陷在我自己的 `fid2` 测试中直接观察到：

```
[FAIL] f2-userInvocable/SKILL.md
    - ERROR: frontmatter field "userInvocable" is unsupported; ...      <-- t2 先说这个
    - ERROR: invalid skill name "f2-userInvocable": must match ...      <-- host 会先说这个
```

（注：本用例的 name 非法是我构造夹具时的副产物，非脚本缺陷；但**错误排序差异本身**可由此稳定复现。）

---

### D7 —【提示 / 非缺陷】`--json` 模式计数与文本模式一致

`t2:469` JSON 输出 `{ root, total, passed, failed, results }`，退出码逻辑与文本模式共用同一 `failed`。检查代码路径未见分歧，**未发现缺陷**。列为已检查项，不列为缺陷。

---

## 缺陷严重度汇总

| 编号 | 严重度 | 类别 | 一句话 |
|---|---|---|---|
| D1 | **严重** | 假阳性 | 内联 `["a,b"]` 引号内逗号被裸切分 → 合法 YAML 判 FAIL |
| D2 | **严重** | 假阳性 | `metadata:` 下块状序列被判非法，且文案自称 top-level |
| D3 | **中高** | **假阴性** | Tab 缩进被 `trimStart()` 吃掉 → 非法 YAML 被 PASS（host 实测抛错，方向已闭合） |
| D4 | 中 | 假阳性 | 锚点/别名一律拒绝，host 接受 |
| D5 | 低 | 忠实度 | `metadata: null` 情形未单独实测覆盖 |
| D6 | 低 | 忠实度 | 错误检查顺序与 host 不同，首要原因会误导排障 |

D1/D2/D4 是**同一个根因的三个实例**：自研窄解析器与完整 YAML 不等价，方向单一地偏向假阳性。作者自述的「保守从严、可能假阳性」**经实测确认成立**，且不是边缘情形 —— D1 的触发条件是一个引号内的逗号。

---

## 独立结论

### REVISE

**理由（先结论后原因）：**

1. **不能判 PASS。** t2 存在 **3 个已实测确认的假阳性实例**（D1/D2/D4：合法 YAML 被 host 接受、却被 t2 判 FAIL）**与 1 个已实测确认的假阴性实例**（D3：非法 YAML 被 host 拒绝、却被 t2 判 PASS）。CI 门禁的第一职责是判定与 host 等价 —— t2 在**两个方向上都不等价**：既误杀合法文件，也漏放会被丢弃的文件。作者自述的「保守从严、可能假阳性」经我独立构造用例证实为**现实缺陷**，且我额外发现了作者未提及的**假阴性方向**。

2. **不必判 BLOCKED。** 因为：
   - 作者声称的核心数字我已独立复现属实（88/88、退出码 0；自建 8 夹具得 7 FAIL，脚本确实会 FAIL 而非永远 PASS）；
   - 退出码语义（0/1/2）正确；
   - 我要求的 5 类负例**全部被正确捕获**；
   - 已确认的假阳性全部集中在**可选字段 `metadata` 的自由写法**上，**必填字段 `name`/`description` 与布尔字段的判定正确**（我用 host 源码 `frontmatterBoolean`/`stringField` 逐条对过，`fid5` 的 FAIL 是**正确的**，不是假阳性）。
   - 即：**t2 对「会让 skill 整条被丢弃」的主干判定是可靠的**，缺陷集中在高级 YAML 写法。

3. **修订方向（最小正确路径）：**
   - 首选：**直接依赖 `yaml` 包**（host 自己是这么做的，`dsh-skill-filesystem` 的依赖树里就有）。用一个已被 host 验证过的解析器替换自研窄解析器，D1/D2/D3/D4 **一次性全部消失** —— 这比修补 4 个解析分支更小、更正确，也消除「校验器与 host 判定不一致」这一根本风险。
   - 次选（若坚持零依赖）：把 `inner.split(",")` 换成**引号感知的切分**（最小修 D1），并把 `- ` 分支限定为「仅在顶层缩进时才是 top-level sequence」（最小修 D2）。
   - 无论哪种：**CI 门禁应先只对 ERROR 生效，并确保 ERROR 集合与 host 的实际丢弃条件等价**。

4. **门禁使用的现实建议（若必须在修订前先用）：** 可将其作为**告警级**检查（只看 WARNING/ERROR 文本，不因 FAIL 阻断合并），不满足「门禁」定义，不能替代修订。

---

## 未覆盖范围

明确列出本次**未验证**的内容，以下均为「未知」，不得当作结论：

1. **作者的 11 个负例夹具本身**：`.tmp/e2e/` 下不存在这些夹具，无法复核其构成与 7 FAIL 的具体分布。我自建 8 例得 7 FAIL 属**独立结果**，与作者数字**不构成互证**。
2. **真实 skill 目录的端到端 host 行为**：我只复刻了 host 的 `parseFrontmatter`（J:780-805）作为真值裁判，**未把夹具真正喂给运行中的 harness discovery 流程**，未观察 `ctx.logger.warn` 的真实输出。故「host 接受」= 「host 的 frontmatter 解析函数接受」，**不等于**已观测到「该 skill 在真实 session 中被成功加载」。
3. **`dsh-skill` 注册表侧第二道关卡（S:454/466/481）**：未实测。若夹具真的进入 provider，可能还有这一层 throw。
4. **`metadata: null` 的显式情形**：未单独设用例（仅测了字符串与合法映射）。
5. **~~D3 的完全方向闭合~~** — **已闭合**（用 host 的 `yaml` 包实测：`Tabs are not allowed as indentation at line 4`，host 抛错 / t2 PASS，确认为假阴性）。
6. **块标量 / 折叠标量的完整主格**：仅测了 `>-` 一例（`fp01`，t2 PASS 且与 host 一致），`|`、`|+`、`|-`、显式缩进指示符（如 `|2`）**未逐一实测**。
7. **YAML 1.1 特有写法**（如 `0123` 八进制、`.inf`、`~` 以外的 null 写法）、多文档（`---` 分隔的多个 doc）、以及 `%YAML` 指令行 —— **未测**。
8. **跨版本适用性**：仓库未记录 `dsh-skill-filesystem` / `dsh-skill` 的版本号（t1 亦未记录，见 t1 §4 第 8 项）。本报告结论仅对**本机当前已安装副本**成立。
9. **性能与 88 个之外的大规模目录**：未做压力测试。
10. **`--json` 输出的结构化断言**：只做了代码路径审读（D7），未做程序化解析测试。

---

## 附：本评审所有实测证据的可复现清单

```
# 主干复核（88/88）
node .tmp/e2e/code/t2-validate-frontmatter.mjs "C:\Users\Administrator\.dsh\profiles\node_modules\@wuji\dsh-wuji-bundle\skills"

# 自建负例（应 FAIL）
node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/neg

# D1 假阳性（最小复现）
node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/fp2
node .tmp/e2e/review/oracle.mjs .tmp/e2e/review/fp2/fp-m1-comma-in-array/SKILL.md

# D2 / D4 假阳性
node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/fp3
node .tmp/e2e/review/oracle.mjs .tmp/e2e/review/fp3/fp3-04-block-seq/SKILL.md
node .tmp/e2e/review/oracle.mjs .tmp/e2e/review/fp3/fp3-03-anchor/SKILL.md

# 忠实度检查（WARN vs ERROR 分级）
node .tmp/e2e/code/t2-validate-frontmatter.mjs .tmp/e2e/review/fid
```

**上游源码依据**（本次实际读取，行号与 t1 一致）：
- `dsh-skill-filesystem/lib/index.js:7` — `import { parse } from "yaml"`（host 用完整 yaml 包）
- `dsh-skill-filesystem/lib/index.js:667-701` — 主判定顺序与各 warn 出口
- `dsh-skill-filesystem/lib/index.js:780-805` — `parseFrontmatter` / `findClosingFrontmatter`
- `dsh-skill-filesystem/lib/index.js:841-883` — `stringField` / `optionalString` / `parseInvocationPolicy` / `rejectLegacyInvocationKey` / `frontmatterBoolean` / `optionalMetadata`
