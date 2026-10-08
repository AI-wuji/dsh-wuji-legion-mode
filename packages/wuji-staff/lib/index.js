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

import { defineTool } from '@deepseek-ai/dsh-tools';
import { planSchedule, selectRecipe, DEFAULT_PARALLEL_CAP } from '../staff-core.js';

export const name = 'wuji-staff';
export const inject = ['tools'];

/** 工具描述：写清调用时机，否则注册了也不会被用。 */
const STAFF_DESCRIPTION = [
  '无极军团参谋部：把阿极的需求表转成执行计划（任务分配表）。',
  '复杂任务（需要拆成多个子任务、或可能并发）在派发前调用本工具，',
  '由它确定性地计算：子任务分组、并发顺序、写集冲突、依赖次序、以及哪些分支应当被阻塞。',
  '简单任务不要调用。',
  '',
  '它只产出计划，不执行任务；也不判断产物是否合格——那仍需真实子代理回交。',
].join(' ');

const DESCRIPTION_DESCRIPTION = [
  '无极军团参谋部：为一个子任务选择承接的主帅/专家团。',
  '无匹配或最高分并列时返回 selection_gap，此时不得全能力兜底或临时编造主帅；',
  '缺口只阻塞该子任务及依赖它的分支，其他分支继续。',
].join(' ');

const SUBTASK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subtask_id: { type: 'string', required: true, description: '子任务唯一标识。' },
    goal: { type: 'string', required: true, description: '这个子任务要达成什么（一句话）。' },
    domain: { type: 'string', required: true, description: '领域，用于匹配主帅。' },
    typed_intents: { type: 'array', description: '类型意图，用于匹配配方。', items: { type: 'string' } },
    depends_on: { type: 'array', description: '依赖的子任务 id。', items: { type: 'string' } },
    write_roots: {
      type: 'array',
      description: '本子任务会写入的路径。写集冲突（含目录包含）的两个子任务不会被排进同一并发组。',
      items: { type: 'string' },
    },
  },
};

/**
 * 创建一个不依赖宿主 session 的纯计算工具。
 * @param {object} options - 工具定义。
 * @returns {object} defineTool 结果。
 */
function plainTool(options) {
  return defineTool({
    ...options,
    async execute(args) {
      return options.run(args);
    },
  });
}

/**
 * 挂载参谋部工具。
 * @param {object} ctx - Cordis 上下文，需提供 `tools` 服务。
 * @param {object} [config] - 配置。
 * @param {number} [config.parallelCap] - 默认并发上限（1..3）。
 */
export function apply(ctx, config = {}) {
  const defaultCap = config.parallelCap ?? DEFAULT_PARALLEL_CAP;

  ctx.tools.register(plainTool({
    name: 'wuji_staff_plan',
    description: STAFF_DESCRIPTION,
    parameters: {
      subtasks: {
        type: 'array',
        required: true,
        description: '阿极拆出的子任务列表（任务分配表的输入）。',
        items: SUBTASK_SCHEMA,
      },
      gap_ids: {
        type: 'array',
        description: '已知无可用承接方的子任务 id（来自 wuji_staff_select 的缺口）。',
        items: { type: 'string' },
      },
      parallel_cap: {
        type: 'integer',
        description: `并发上限，1..3，默认 ${defaultCap}。这是准备上限，不是宿主额度。`,
      },
    },
    run(args) {
      const result = planSchedule(args.subtasks, {
        gapIds: args.gap_ids ?? [],
        parallelCap: args.parallel_cap ?? defaultCap,
      });
      return result;
    },
  }));

  ctx.tools.register(plainTool({
    name: 'wuji_staff_select',
    description: DESCRIPTION_DESCRIPTION,
    parameters: {
      domain: { type: 'string', required: true, description: '子任务领域。' },
      typed_intents: { type: 'array', description: '子任务类型意图。', items: { type: 'string' } },
      recipes: {
        type: 'array',
        required: true,
        description: '候选主帅配方，各含 id / domains / typed_intents。',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', required: true },
            domains: { type: 'array', required: true, items: { type: 'string' } },
            typed_intents: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    run(args) {
      return selectRecipe(args.recipes, {
        domain: args.domain,
        typed_intents: args.typed_intents ?? [],
      });
    },
  }));
}

export default { name, inject, apply };
