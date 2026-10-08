// 无极军团 4.0 · 参谋部 · 插件入口
//
// 参谋部是「执行图谱的唯一正式写入者」（3.0 蓝图核心权责），不与阿极合并：
//   阿极 = 需求图谱写入者（理解用户要什么）
//   参谋部 = 执行图谱写入者（决定怎么干、派给谁、何时并发）
//
// 为什么是插件而不是 workflow 脚本：
//   workflow 脚本每次都要由模型现场生成 —— 既烧 token、又有延迟，且每次产出
//   可能有细微差异（不可复现）。参谋部的调度逻辑是确定性的，应当**一次性写定**，
//   由 preset 自动挂载，无需用户选择、无需模型生成。
//
// 职责边界（严格遵守 3.0 蓝图 L110「参谋本部主要做调度和判断，困难的架构、
// 推理或审查任务应派给 Sol 子代理」）：
//   本插件只承担**确定性**部分 —— 打分选择、依赖图、写集冲突、并发分组、缺口传播。
//   「最小上下文投影」与「产物是否达标」属于语义判断，仍由阿极/子代理承担，
//   本插件不假装能做。
//
// ⚠ 工具契约（@deepseek-ai/dsh-tools 的 defineTool）：
//   `output` 是**必填**的 —— defineTool 会无条件读取 `options.output.render`，
//   缺了就是运行时报 `Cannot read properties of undefined (reading 'render')`，
//   并让整行 fiber 失败、整个 preset 拒绝挂载。这不是可选项。

import { defineTool } from '@deepseek-ai/dsh-tools';
import { planSchedule, selectRecipe, DEFAULT_PARALLEL_CAP } from '../staff-core.js';

export const name = 'wuji-staff';
export const inject = ['tools'];

/** 工具描述：写清调用时机，否则注册了也不会被用。 */
const PLAN_DESCRIPTION = [
  '无极军团参谋部：把阿极的需求表转成执行计划（任务分配表）。',
  '当任务需要拆成多个子任务、或可能并发执行时，在派发子代理之前调用本工具。',
  '它确定性地算出：哪些子任务可以同组并发、哪些因写集冲突必须串行、',
  '哪些因依赖未满足或选择缺口必须被阻塞。',
  '简单任务（单步、无需并发）不要调用。',
  '它只产出计划，不执行任务，也不判断产物是否合格 —— 那需要真实子代理回交。',
].join(' ');

const SELECT_DESCRIPTION = [
  '无极军团参谋部：为一个子任务选择承接的主帅/专家团。',
  '按上游权重打分（领域命中 3 分，每个命中的类型意图 2 分）。',
  '无匹配或最高分并列时返回 selection_gap —— 此时不得全能力兜底，也不得临时编造主帅；',
  '缺口只阻塞该子任务及依赖它的分支，无依赖的其他分支继续。',
].join(' ');

// 参数定义采用 dsh-tools 的 property-map 形式：每个属性自带 required 标记。
const SUBTASK_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subtask_id: { type: 'string', required: true, description: '子任务唯一标识。' },
    goal: { type: 'string', required: true, description: '这个子任务要达成什么（一句话）。' },
    domain: { type: 'string', required: true, description: '领域，用于匹配主帅。' },
    typed_intents: { type: 'array', items: { type: 'string' }, description: '类型意图，用于匹配配方。' },
    depends_on: { type: 'array', items: { type: 'string' }, description: '依赖的子任务 id。' },
    write_roots: {
      type: 'array',
      items: { type: 'string' },
      description: '本子任务会写入的路径。写集冲突（含目录包含）的两个子任务不会被排进同一并发组。',
    },
  },
};

const RECIPE_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true, description: '配方/主帅标识。' },
    domains: { type: 'array', required: true, items: { type: 'string' }, description: '该配方覆盖的领域。' },
    typed_intents: { type: 'array', items: { type: 'string' }, description: '该配方覆盖的类型意图。' },
  },
};

/**
 * 挂载参谋部工具。
 * @param {object} ctx - Cordis 上下文，需提供 `tools` 服务。
 * @param {object} [config] - 配置。
 * @param {number} [config.parallelCap] - 默认并发上限（1..3）。
 */
export function apply(ctx, config = {}) {
  const defaultCap = config.parallelCap ?? DEFAULT_PARALLEL_CAP;

  ctx.tools.register(defineTool({
    name: 'wuji_staff_plan',
    description: PLAN_DESCRIPTION,
    parameters: {
      subtasks: {
        type: 'array',
        required: true,
        items: SUBTASK_ITEM,
        description: '阿极拆出的子任务列表（任务分配表的输入）。',
      },
      gap_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '已知无可用承接方的子任务 id（来自 wuji_staff_select 的缺口）。',
      },
      parallel_cap: {
        type: 'integer',
        description: `并发上限，1..3，默认 ${defaultCap}。这是准备上限，不是宿主额度。`,
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          ok: { type: 'boolean', required: true, description: '是否产出了计划。' },
          groups: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: '并发分组，按执行顺序排列。' },
          error: { type: 'string', description: '失败时的具名错误码。' },
        },
      },
      render: (_args, value) => {
        if (!value?.ok) {
          return [{
            type: 'text',
            text: `参谋部未能产出计划：${value?.error ?? '未知错误'}${
              value?.problems?.length ? `\n${value.problems.join('\n')}` : ''
            }`,
          }];
        }
        const lines = ['参谋部执行计划：'];
        value.groups.forEach((group, i) => {
          lines.push(`  第 ${i + 1} 组（${group.length > 1 ? '并发' : '串行'}）：${group.join(' + ')}`);
        });
        const blocked = Object.keys(value.blocked_branches ?? {});
        if (blocked.length) lines.push(`  被阻塞：${blocked.join(', ')}`);
        if (value.write_conflicts?.length) {
          for (const c of value.write_conflicts) {
            lines.push(`  写集冲突：${c.subtask_id} 与 ${c.conflicts_with}（${c.reason}）`);
          }
        }
        lines.push('注：这是构造出的计划，不代表已执行。');
        return [{ type: 'text', text: lines.join('\n') }];
      },
    },
    execute(args) {
      return Promise.resolve(planSchedule(args.subtasks, {
        gapIds: args.gap_ids ?? [],
        parallelCap: args.parallel_cap ?? defaultCap,
      }));
    },
  }));

  ctx.tools.register(defineTool({
    name: 'wuji_staff_select',
    description: SELECT_DESCRIPTION,
    parameters: {
      domain: { type: 'string', required: true, description: '子任务领域。' },
      typed_intents: { type: 'array', items: { type: 'string' }, description: '子任务类型意图。' },
      recipes: {
        type: 'array',
        required: true,
        items: RECIPE_ITEM,
        description: '候选主帅配方。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          gap: { type: 'boolean', required: true, description: '是否构成选择缺口。' },
          reason: { type: 'string', description: '构成缺口时的原因。' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value?.gap
          ? `参谋部判定 selection_gap：${value.reason}\n该子任务及依赖它的分支应被阻塞，其他分支继续。`
          : `参谋部选定：${(value?.candidates ?? []).map((c) => c.id).join(', ')}`,
      }],
    },
    execute(args) {
      return Promise.resolve(selectRecipe(args.recipes, {
        domain: args.domain,
        typed_intents: args.typed_intents ?? [],
      }));
    },
  }));
}

export default { name, inject, apply };
