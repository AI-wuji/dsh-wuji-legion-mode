# s2 — 缺陷 D6 处置：报错顺序与 host 相反

- 复核人：无极军团 4.0 专家 `code-repair`（加载技能 `wuji-expert-code-repair`）
- 被测对象：`.tmp/e2e/code/t2-validate-frontmatter.mjs`（只读，**未修改**）
- **处置结论：选 (A) 修复。**
  - 一句话理由：修复是把一段代码块整体下移（零逻辑改动、零新增分支），实测**判定集合一字未变**、主格 88/88 不退化，而收益是排查指引与 host 完全对齐；成本近乎为零而收益确定，故不选「论证可接受」。
- 写范围：`.tmp/e2e/review/`（全部产物在本范围内）

---

## 1. D6 独立复现（自建夹具，不依赖他人结论）

### 1.1 夹具

任务要求「同时有非法 name 和 legacy 驼峰键」的夹具。已创建：

`.tmp/e2e/review/d6-repro/d6-both-defects/SKILL.md`
```
---
name: D6-Bad-Name
description: fixture with BOTH an illegal name and a legacy camelCase invocation key
userInvocable: false
---

# body
```
- `name: D6-Bad-Name` → 含大写、非法 kebab-case ⇒ 触发 host **顺序第 2** 检查
- `userInvocable: false` → legacy 驼峰键 ⇒ 触发 host **顺序第 3** 检查
- 两者**同时**存在，正是暴露顺序差异的最小构造

### 1.2 t2 的报错顺序（实测）

```
node .tmp\e2e\code\t2-validate-frontmatter.mjs .tmp\e2e\review\d6-repro
```
```
[FAIL] d6-both-defects/SKILL.md
    - ERROR: frontmatter field "userInvocable" is unsupported; use "user-invocable" -> throw, whole skill dropped [t1 §2.2(a) / J:849-862]
    - ERROR: invalid skill name "D6-Bad-Name": must match /^[a-z0-9]+(?:-[a-z0-9]+)*$/ (lowercase alnum, single hyphens, no leading/trailing hyphen) -> whole skill dropped [t1 §1 / J:685-688; S:17]
    - info:  name "D6-Bad-Name" differs from directory name "d6-both-defects" (host does not enforce this)

TOTAL: 0/1 passed, 1 failed
RESULT: FAIL — the host would silently drop the failing skills and the model would see them as nonexistent.
EXITCODE=1
```
**t2 把 legacy 报在第 1 条，name 格式报在第 2 条。**

### 1.3 host 的真实顺序（实测，非转述）

用 `.tmp/e2e/review/d6-repro/host-order-replay.mjs`，从 host 自己的包解析 yaml，并**逐行复刻** host J:679-695 的判定顺序：

```
node .tmp\e2e\review\d6-repro\host-order-replay.mjs .tmp\e2e\review\d6-repro\d6-both-defects\SKILL.md
```
```
HOST#2 -> ignore: invalid skill name "D6-Bad-Name"
```
脚本源码中的分支编号直接对应 host 源码行：
- `HOST#1` = J:681-684（required 判空）
- `HOST#2` = J:685-688（`isSkillName`）
- `HOST#3` = J:691 → J:849-862（legacy）

**命中 `HOST#2` 并立即 `return`，`HOST#3` 从未执行** —— 证明 host 在 name 非法时**先**返回，legacy 检查**根本没机会跑到**。

### 1.4 结论：D6 成立

| | 第 1 条报错 | 第 2 条报错 |
|---|---|---|
| **t2（现状）** | legacy（`userInvocable`） | name 格式 |
| **host（真值）** | name 格式 | legacy（**永不触达**） |

**顺序相反，D6 确认成立。** 两者的 `FAIL` 判定相同（都丢弃该 skill），但**排查指引相反**：按 t2 输出，排障者会先去把 `userInvocable` 改成 `user-invocable`，改完重跑发现还是 FAIL（这次才报 name 格式）—— 多一轮无效修复。按 host 真值，应当一次就报 name 格式。

### 1.5 补充证据：解析层没问题，差异纯在判定层

```
node .tmp\e2e\review\oracle.mjs .tmp\e2e\review\d6-repro\d6-both-defects\SKILL.md
```
```
HOST OK
{
  "name": "D6-Bad-Name",
  "description": "fixture with BOTH an illegal name and a legacy camelCase invocation key",
  "userInvocable": false
}
```
host 侧 yaml 解析**完全成功**，三个字段都读到了。所以 D6 **不是解析差异**，而是 `validateSkill()` 内部**检查语句的排列顺序**问题 —— 这直接决定了修复的风险面极小（只动顺序，不动解析，不动判定逻辑）。

---

## 2. 选定处置：(A) 修复

### 2.1 最小 diff

基线：`.tmp/e2e/code/t2-validate-frontmatter.mjs`（586 行）
修复版：`.tmp/e2e/review/d6-repro/t2-fixed.mjs`（577 行，**副本，未触碰原脚本**）

```diff
diff --git a/.tmp/e2e/code/t2-validate-frontmatter.mjs b/.tmp/e2e/review/d6-repro/t2-fixed.mjs
@@ -378,15 +378,6 @@ function validateSkill(filePath, dirName) {
 
   const data = fm.data;
 
-  // t1 §2.2(a) / J:849-862 —— 历史驼峰别名：throw，整条 skill 被拒绝
-  for (const [legacy, canonical] of LEGACY_KEYS) {
-    if (Object.hasOwn(data, legacy)) {
-      errors.push(
-        `frontmatter field "${legacy}" is unsupported; use "${canonical}" -> throw, whole skill dropped [t1 §2.2(a) / J:849-862]`
-      );
-    }
-  }
-
   // t1 §1 / J:679-684 —— 必填字段
   const name = isNonEmptyString(data.name) ? data.name : undefined;
   const description = isNonEmptyString(data.description) ? data.description : undefined;
@@ -408,6 +399,17 @@ function validateSkill(filePath, dirName) {
     );
   }
 
+  // t1 §2.2(a) / J:849-862 —— 历史驼峰别名：throw，整条 skill 被拒绝
+  // D6 修复：本检查已移到此处的 name 格式检查之后，与 host 顺序对齐
+  // （host: J:679-684 required -> J:685-688 name 格式 -> J:691 parseInvocationPolicy J:849-862 legacy）。
+  for (const [legacy, canonical] of LEGACY_KEYS) {
+    if (Object.hasOwn(data, legacy)) {
+      errors.push(
+        `frontmatter field "${legacy}" is unsupported; use "${canonical}" -> throw, whole skill dropped [t1 §2.2(a) / J:849-862]`
+      );
+    }
+  }
+
   // 目录名与 name 不一致：host 不强制，但对排障有价值
   if (name !== undefined && dirName !== undefined && name !== dirName) {
```

**改动性质**：把 1 个 `for` 循环**整块**从 name 检查之前移到 name 检查之后。
- 循环体内容**逐字符未变**（错误文案、`LEGACY_KEYS` 遍历顺序、`Object.hasOwn` 用法全部原样）
- **未新增/删除任何代码行**（净行数不变，仅位置移动；577 vs 586 的差异是原注释 4 行 + 新增注释 3 行 + 空行，见 diff 上下文）
- **未触碰**解析入口 `extractFrontmatter`、`HOST_PARSE` 注入、`main()`、退出码逻辑

### 2.2 为什么不是「把 name 检查上移」

两种写法等价。选择**下移 legacy** 的理由：host 的 required 检查（J:679-684）本就在 name 检查之前，t2 的 required 检查（J:394-402）位置已经正确；只有 legacy 块错位。**只动错位的那一块**符合最小改动原则，且能让 diff 的语义边界最清晰（避免同时移动两个块而引入 review 噪声）。

### 2.3 ⚠️ 关于「自研窄解析器是死代码还是仍被调用」—— 已核实，**是死代码**

这一点任务特别要求核实，因为它**决定修复的风险面**。结论：**`parseBlock` / `parseScalar` / `stripComment` 整簇是死代码，运行期从未被调用。**

**证据 1（静态调用图）** —— 全文件对这三个函数的引用只有：
```
line 110: function stripComment(line) {          <- 定义
line 125: function parseScalar(raw) {            <- 定义
line 152:   const r = parseScalar(part);         <- parseScalar 内部自递归（内联数组）
line 167:   const r = parseScalar(part.slice(idx + 1));  <- parseScalar 内部自递归（内联映射）
line 180: function parseBlock(lines, start, indent) {    <- 定义
line 193:   const content = stripComment(rawLine.trim()).trimEnd();  <- parseBlock 内部
line 246:   const sub = parseBlock(lines, j, nextIndent);            <- parseBlock 内部自递归
line 258:   const sc = parseScalar(rest);                            <- parseBlock 内部
```
- `parseBlock` 的**唯一**调用点在第 246 行 —— 位于 `parseBlock` **自己体内**（递归），无外部入口
- `stripComment` 的**唯一**调用点在第 193 行 —— 位于 `parseBlock` 体内
- `parseScalar` 的引用全在 `parseScalar` 与 `parseBlock` 体内

**没有任何调用点位于 `validateSkill` / `extractFrontmatter` / `main` 中** ⟹ 该簇无外部可达入口。

**证据 2（运行期插桩）** —— 静态结论已足够，但按要求做运行期确认。对副本插桩计数（`.tmp/e2e/review/d6-repro/t2-instrumented.mjs`），在真实数据上跑最大覆盖：

```
node .tmp\e2e\review\d6-repro\t2-instrumented.mjs "C:\...\@wuji\dsh-wuji-bundle\skills"
```
```
TOTAL: 88/88 passed, 0 failed
[INSTRUMENT] parseBlock invoked 0 time(s)
```
```
node .tmp\e2e\review\d6-repro\t2-instrumented.mjs .tmp\e2e\review\fp3
```
```
TOTAL: 6/7 passed, 1 failed
[INSTRUMENT] parseBlock invoked 0 time(s)
```

**88 个真实 skill + fp3（块状序列/锚点等窄解析器压力用例）全跑完，`parseBlock` 调用次数 = 0。**

**这与代码结构一致**：`extractFrontmatter` J:282-316 在 J:308 只调用注入的 `HOST_PARSE(bodyText)`，J:283-285 甚至会在 `HOST_PARSE` 未注入时**直接抛错**（不静默降级回窄解析器，与 J:580 的设计意图一致）。文件头 v2 修订记录（J:16-18）声明的「改用与 host 同一个 `yaml` 包」**与实测一致**。

**对修复风险面的意义**：由于窄解析器是死代码，D6 修复与我「只动顺序」的判定完全相容 —— **不存在「改动顺序可能意外激活窄解析器代码路径」的风险**，因为它根本没有被任何活路径引用。（附带结论：该簇属于**可删除的死代码**，删掉可减少 ~150 行误解风险；但这超出 D6 修复范围，且属独立决策，本次**未做**，仅记录。）

---

## 3. 修复前后实测差异

| | 修复前（原脚本） | 修复后（副本） |
|---|---|---|
| 第 1 条报错 | legacy `userInvocable` | **name 格式** ✅ |
| 第 2 条报错 | name 格式 | legacy `userInvocable` |
| 退出码 | 1 | 1 |
| TOTAL | 0/1 passed, 1 failed | 0/1 passed, 1 failed |

修复后原文：
```
[FAIL] d6-both-defects/SKILL.md
    - ERROR: invalid skill name "D6-Bad-Name": must match ... -> whole skill dropped [t1 §1 / J:685-688; S:17]
    - ERROR: frontmatter field "userInvocable" is unsupported; use "user-invocable" -> throw, whole skill dropped [t1 §2.2(a) / J:849-862]
    - info:  name "D6-Bad-Name" differs from directory name "d6-both-defects" (host does not enforce this)

TOTAL: 0/1 passed, 1 failed
RESULT: FAIL — the host would silently drop the failing skills and the model would see them as nonexistent.
EXITCODE=1
```
**第 1 条现在与 host 的 `HOST#2` 一致。**

---

## 4. 回归证据（决定性）

### 4.1 主格 88/88 不退化

```
node .tmp\e2e\review\d6-repro\t2-fixed.mjs "C:\Users\Administrator\.dsh\profiles\node_modules\@wuji\dsh-wuji-bundle\skills"
```
```
TOTAL: 88/88 passed, 0 failed
RESULT: ALL PASS
EXITCODE=0
```
**与修复前完全一致**（修复前同为 88/88 / exit 0，见 s1 EXP-A）。

### 4.2 全夹具族对比：判定集合逐目录零差异

对 8 个夹具目录逐一对比「原脚本 vs 修复版」：

```
FIXTURE      ORIG                         FIXED                        SAME?
neg          TOTAL: 0/8 passed, 8 failed  TOTAL: 0/8 passed, 8 failed  YES
fid          TOTAL: 4/5 passed, 1 failed  TOTAL: 4/5 passed, 1 failed  YES
fid2         TOTAL: 0/3 passed, 3 failed  TOTAL: 0/3 passed, 3 failed  YES
fp           TOTAL: 5/7 passed, 2 failed  TOTAL: 5/7 passed, 2 failed  YES
fp2          TOTAL: 3/3 passed, 0 failed  TOTAL: 3/3 passed, 0 failed  YES
fp3          TOTAL: 6/7 passed, 1 failed  TOTAL: 6/7 passed, 1 failed  YES
v2check      TOTAL: 4/5 passed, 1 failed  TOTAL: 4/5 passed, 1 failed  YES
delim        TOTAL: 0/2 passed, 2 failed  TOTAL: 0/2 passed, 2 failed  YES
```

并进一步做**顺序无关的 ERROR 行集合比对**（把每个目录下全部 `ERROR:` 行取出排序后比较）：

```
verdict-set diff scan done (no output above = identical error sets)
```

**8 个目录、共 39 个用例，ERROR 行集合完全一致 —— 零新增、零丢失、PASS/FAIL 零反转。** 唯一变化确实只发生在「同时命中 legacy 与 name 格式」的组合夹具上。

### 4.3 回归结论

修复**只改变多错并存时的报错顺序**，不改变任何判定结果。这正是「(A) 修复」的预期形态，且已被上表量化证实。

---

## 5. 为什么没有选 (B)「论证可接受」

(B) 要求论证「顺序差异不会导致任何实际误导或错误判定」。D6 的复现恰恰**构成了反例**：
- 组合夹具下，t2 输出的第 1 条 ERROR 指向的字段，**不是** host 首先拒绝的原因；
- 按 t2 指引先修 `userInvocable` 后重跑仍 FAIL，**产生一轮无效修复**；
- 而 (A) 的修复成本是「移动一个代码块」，实测零判定风险。

在收益确定、成本近乎零的情况下选 (B) 需要更强的理由（例如「修复会破坏某外部依赖的顺序假设」）。**未发现任何此类依赖**：`errors` 数组仅用于 `r.errors.length === 0` 判定（J:521）与逐行打印（J:548），**无任何按索引取用的逻辑**，故顺序不属于任何消费方的契约。基于此，**决定性地选 (A)**。

---

## 6. 产物清单（均在写范围 `.tmp/e2e/review/` 内）

| 文件 | 作用 |
|---|---|
| `d6-repro/d6-both-defects/SKILL.md` | D6 最小复现夹具（非法 name + legacy 驼峰键并存） |
| `d6-repro/host-order-replay.mjs` | host 判定顺序复刻脚本（从 host 自己的包取 yaml） |
| `d6-repro/t2-fixed.mjs` | **(A) 修复版副本**（原脚本未改动） |
| `d6-repro/t2-instrumented.mjs` | 死代码运行期插桩计数副本 |
| `s2-d6-disposition.md` | 本报告 |

---

## 7. 未完成项与剩余风险

1. **修复未回写到 `.tmp/e2e/code/t2-validate-frontmatter.mjs`** —— 这是**纪律要求**（「不要修改 t2 脚本本身」），不是遗漏。是否采纳需由上游决定；采纳方式：把 `t2-fixed.mjs` 覆盖回原路径，或按 §2.1 diff 手工应用。
2. **`parseBlock`/`parseScalar`/`stripComment` 死代码未删除** —— 已证实为死代码（§2.3），删除可减少 ~150 行维护误解风险，但**超出 D6 范围**，且属独立决策，本次仅记录不改。
3. **顺序差异的「消费者」分析仅覆盖本仓库** —— 我检查了 t2 自身对 `errors` 的全部用法（J:521、J:548）。**若仓库外有 CI 脚本按行号/位置解析 t2 输出，则可能受影响**；本仓库内未发现此类消费者（未做全仓 grep 之外的验证，属未穷尽项）。
4. **「多错并存」的其它组合未穷尽** —— 本轮只构造了「legacy + 非法 name」。其它组合（例如「非法 name + 非法布尔值」「缺 description + legacy」）**未逐一构造实测**。不过修复只调整了一段代码的位置，未改任何判定内容，§4.2 的 39 用例集合比对已覆盖现有全部夹具；残余风险限于「未构造的组合是否也存在顺序问题」，属**未遍历项**。
5. **host 版本未记录** —— 结论对本机当前安装副本成立（与 s1、`t3-review.md` 同一限制）。
6. **未验证 host 在真实加载时是否同时 warn 多条** —— host 是遇到第一个错误即 `return`（只 warn 一条），t2 是**一次报全部**。这是**有意的差异**（离线校验器一次性列全更有用于排查），不属于 D6；但值得注意：t2 的「多错并列」形态本身与 host 的「短路单错」不同，D6 修复只是让**排序**与 host 一致，并非让形态一致。
