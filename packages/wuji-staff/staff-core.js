// 无极军团 4.0 · 参谋部 · 确定性调度核心
//
// 设计依据：上游 `wuji-legion-codex-4.0/tools/run_legion_task.py`
// 与 `wuji-legion-codex-3.0/references/architecture/wuji-legion-3.0-blueprint.md`。
//
// 职责边界（严格区分「确定性」与「需要智能」）：
//   本文件只做确定性的部分 —— 打分选择、依赖图、写集冲突、并发分组、缺口传播。
//   「最小上下文投影」「产物是否达标」属于语义判断，不在本文件内，交由模型承担。
//   依据 3.0 蓝图 L110：「参谋本部主要做调度和判断，困难的架构、推理或审查任务
//   应派给 Sol 子代理，不要求参谋本部亲自完成所有高难度工作。」
//
// 为什么这些必须确定性：写集冲突、依赖顺序、并发分组若交给模型判断，
// 既不可复现也不可审计，且模型在这类问题上并不比算法更准。

/** 每个子任务必须提供的字段。 */
const REQUIRED_SUBTASK_FIELDS = ['subtask_id', 'goal', 'domain'];

/** 默认并发上限。上游语义：这是「准备上限」，不是宿主额度。 */
export const DEFAULT_PARALLEL_CAP = 2;
const MIN_PARALLEL_CAP = 1;
const MAX_PARALLEL_CAP = 3;

/**
 * 把路径规范化为可比较形式：统一分隔符、去尾斜杠、大小写折叠。
 * @param {string} value - 原始路径。
 * @returns {string} 规范化结果。
 */
export function canonicalRoot(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * 判断两组写范围是否冲突。
 *
 * 冲突定义（含目录包含关系，不只是相等）：上游 `_write_roots_conflict` 的语义是
 * `a === b || a 是 b 的祖先 || b 是 a 的祖先` —— 因为写 `out/analysis` 会覆盖
 * `out/analysis/sub` 下的产物。
 * @param {string[]} left - 一组写范围。
 * @param {string[]} right - 另一组写范围。
 * @returns {boolean} 是否冲突。
 */
export function writeRootsConflict(left, right) {
  for (const a of left ?? []) {
    const x = canonicalRoot(a);
    for (const b of right ?? []) {
      const y = canonicalRoot(b);
      if (x === y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`)) return true;
    }
  }
  return false;
}

/**
 * 校验一个子任务的定义是否完整。
 * @param {object} item - 子任务。
 * @param {string} index - 出错时用于定位。
 * @returns {string[]} 问题列表；空数组表示通过。
 */
function validateSubtask(item, index) {
  const problems = [];
  if (!item || typeof item !== 'object') return [`subtasks[${index}] 不是对象`];
  for (const field of REQUIRED_SUBTASK_FIELDS) {
    if (typeof item[field] !== 'string' || !item[field].trim()) {
      problems.push(`subtasks[${index}].${field} 缺失或为空`);
    }
  }
  if (item.depends_on !== undefined && !Array.isArray(item.depends_on)) {
    problems.push(`subtasks[${index}].depends_on 必须是数组`);
  }
  if (item.write_roots !== undefined && !Array.isArray(item.write_roots)) {
    problems.push(`subtasks[${index}].write_roots 必须是数组`);
  }
  return problems;
}

/**
 * 生成调度计划：按依赖与写集冲突把子任务排成串并分组。
 *
 * 语义要点：
 * - 依赖未满足的子任务不进入本组；
 * - 写集与组内成员冲突的子任务不进入本组（留待下一组）；
 * - `selection_gap` 的子任务被阻塞，且**阻塞沿依赖传播**给后继；
 * - 被阻塞的分支不影响无依赖的其他分支（这是上游 L16/L34 的关键行为）；
 * - 依赖成环时明确报错，而非静默产出错误计划。
 *
 * @param {object[]} subtasks - 子任务列表。
 * @param {object} [options] - 选项。
 * @param {Iterable<string>} [options.gapIds] - 无可用匹配的子任务 id。
 * @param {number} [options.parallelCap] - 并发上限（1..3）。
 * @returns {object} 调度计划。
 */
export function planSchedule(subtasks, options = {}) {
  const list = Array.isArray(subtasks) ? subtasks : [];

  const problems = list.flatMap((item, i) => validateSubtask(item, i));
  if (problems.length) {
    return { ok: false, error: 'INVALID_SUBTASK', problems };
  }

  const ids = list.map((s) => s.subtask_id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) {
    return { ok: false, error: 'DUPLICATE_SUBTASK_ID', problems: [`subtask_id 重复: ${duplicate}`] };
  }

  const unknown = list
    .flatMap((s) => s.depends_on ?? [])
    .filter((d) => !ids.includes(d));
  if (unknown.length) {
    return {
      ok: false,
      error: 'UNKNOWN_DEPENDENCY',
      problems: [...new Set(unknown)].map((d) => `依赖了不存在的子任务: ${d}`),
    };
  }

  const rawCap = options.parallelCap ?? DEFAULT_PARALLEL_CAP;
  const cap = Math.min(MAX_PARALLEL_CAP, Math.max(MIN_PARALLEL_CAP, Number(rawCap) || DEFAULT_PARALLEL_CAP));

  const gapIds = new Set(options.gapIds ?? []);
  const pending = new Map(list.map((s) => [s.subtask_id, s]));
  const visited = new Set();
  const blocked = {};
  const groups = [];
  const conflictNotes = [];

  while (pending.size) {
    const ready = [...pending.values()].filter((s) =>
      (s.depends_on ?? []).every((d) => visited.has(d)),
    );
    if (!ready.length) {
      return {
        ok: false,
        error: 'DEPENDENCY_CYCLE',
        problems: [`剩余子任务无法排出顺序（依赖成环）: ${[...pending.keys()].join(', ')}`],
      };
    }

    const group = [];
    // 稳定排序，保证同一输入产出同一计划（可复现）。
    for (const item of ready.sort((a, b) => a.subtask_id.localeCompare(b.subtask_id))) {
      const id = item.subtask_id;

      const blockers = new Set();
      for (const dep of item.depends_on ?? []) {
        for (const b of blocked[dep] ?? []) blockers.add(b);
      }
      if (gapIds.has(id)) blockers.add(id);

      if (blockers.size) {
        blocked[id] = [...blockers].sort();
        visited.add(id);
        pending.delete(id);
        continue;
      }

      if (group.length >= cap) break;

      const clash = group.find((other) => writeRootsConflict(item.write_roots, other.write_roots));
      if (clash) {
        conflictNotes.push({
          subtask_id: id,
          conflicts_with: clash.subtask_id,
          reason: 'write_roots 冲突（含目录包含关系），已留到下一组串行执行',
        });
        continue;
      }

      group.push(item);
    }

    const groupIds = group.map((g) => g.subtask_id);
    if (groupIds.length) groups.push(groupIds);
    for (const id of groupIds) {
      visited.add(id);
      pending.delete(id);
    }
  }

  return {
    ok: true,
    groups,
    parallel_groups: groups.filter((g) => g.length > 1),
    blocked_branches: blocked,
    write_conflicts: conflictNotes,
    parallel_cap: cap,
    // 上游同款诚实标注：这是构造出的计划，不是已发生的执行。
    construction_only: true,
    native_execution_observed: false,
  };
}

/**
 * 按领域与类型意图给候选配方打分。
 *
 * 权重照上游 `_recipe_matches`：领域命中 3 分，每个命中的类型意图 2 分。
 * 命中最高分的**可能不止一个** —— 并列时必须全部返回，由上层判定 `selection_gap`，
 * 不允许静默取其一。
 * @param {object[]} recipes - 候选配方，各含 domains / typed_intents。
 * @param {{domain: string, typed_intents?: string[]}} task - 子任务。
 * @returns {{best: object[], bestScore: number, scored: object[]}} 打分结果。
 */
export function scoreRecipes(recipes, task) {
  const domain = String(task?.domain ?? '');
  const intents = new Set(task?.typed_intents ?? []);
  const scored = [];

  for (const recipe of recipes ?? []) {
    const recipeDomains = new Set(recipe.domains ?? []);
    const recipeIntents = new Set(recipe.typed_intents ?? []);
    let hits = 0;
    for (const i of intents) if (recipeIntents.has(i)) hits += 1;
    const score = (recipeDomains.has(domain) ? 3 : 0) + 2 * hits;
    if (score > 0) scored.push({ score, recipe });
  }

  const bestScore = scored.reduce((max, s) => Math.max(max, s.score), 0);
  const best = scored.filter((s) => s.score === bestScore).map((s) => s.recipe);
  return { best, bestScore, scored };
}

/**
 * 判定一个子任务的选择结果是否构成 `selection_gap`。
 *
 * 无匹配或最高分并列都算缺口 —— 上游 L34：禁止查全专家或万能兜底。
 * @param {object[]} recipes - 候选配方。
 * @param {object} task - 子任务。
 * @returns {{gap: boolean, reason?: string, candidates: object[]}} 判定结果。
 */
export function selectRecipe(recipes, task) {
  const { best, bestScore } = scoreRecipes(recipes, task);
  if (bestScore === 0 || best.length === 0) {
    return {
      gap: true,
      reason: `无匹配：domain=${task?.domain} intents=${JSON.stringify(task?.typed_intents ?? [])}`,
      candidates: [],
    };
  }
  if (best.length > 1) {
    return {
      gap: true,
      reason: `最高分并列（${bestScore} 分，${best.length} 个候选）：${best
        .map((r) => r.id ?? r.name ?? '?')
        .join(', ')}`,
      candidates: best,
    };
  }
  return { gap: false, candidates: best };
}
