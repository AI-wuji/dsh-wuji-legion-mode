// Wuji Legion · 参谋部最小调度工具（P1）
// 参谋部只做全局任务分配与契约写入，不亲自执行、不创建第二套 agent-loop。

// Workers keep the same minimum-action doctrine even when a host does not
// prove that child agents inherit the parent preset automatically.
export const PONYTAIL_WORKER_RULES = [
  '[Wuji PonyTail worker preflight]',
  '先读完整流程和调用方；复用已有能力优先。',
  '标准库/平台原生/已安装能力优先，不新增无请求抽象。',
  '不得删除安全、授权、错误处理、输入校验或必要验证。',
  '非平凡逻辑保留一个最小可运行检查，并返回完成证据。',
].join('\n');

function composeWorkerPrompt(prompt) {
  const text = String(prompt || '');
  return text.includes('[Wuji PonyTail worker preflight]') ? text : `${PONYTAIL_WORKER_RULES}\n\n${text}`;
}

export const staffPlanTool = {
  name: 'wuji_staff_plan',
  description: '参谋部：把已确认需求转换为有依赖、负责人、输入输出和失败策略的任务分配表，并写入 wuji.task 投影。',
  parameters: {
    type: 'object',
    properties: {
      objective: { type: 'string', description: '已确认的总目标。' },
      tasks: {
        type: 'array',
        description: '结构化任务节点；每个节点必须包含完整执行契约。',
        items: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            deps: { type: 'array', items: { type: 'string' } },
            assignedTo: { type: 'string' },
            requirement: { type: 'string' },
            input: { type: 'string' },
            output: { type: 'string' },
            returnFormat: { type: 'string' },
            failurePolicy: { type: 'string', enum: ['retry', 'reangle', 'report'] },
          },
          required: ['taskId', 'deps', 'assignedTo', 'requirement', 'input', 'output', 'returnFormat', 'failurePolicy'],
        },
      },
    },
    required: ['objective', 'tasks'],
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        objective: { type: 'string' },
        taskCount: { type: 'number' },
        taskIds: { type: 'array', items: { type: 'string' } },
        activeTaskId: { oneOf: [{ type: 'string' }, { type: 'null' }] },
        dependenciesValid: { type: 'boolean' },
      },
      required: ['objective', 'taskCount', 'taskIds', 'activeTaskId', 'dependenciesValid'],
    },
    render(_args, value) {
      return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
    },
  },
  isConcurrencySafe() { return false; },
  async execute(args, exec) {
    const tasks = Array.isArray(args.tasks) ? args.tasks : [];
    const staff = exec.agent?.ctx?.get('wujiStaff');
    if (!staff) throw new Error('参谋部服务未挂载');
    const validated = staff.validatePlan({ objective: args.objective, tasks });
    const ids = new Set(validated.taskIds);
    const dependenciesValid = true;
    const session = exec.agent?.session;
    if (!session) throw new Error('参谋部工具必须在一个有归属 Session 的 Agent 中运行');
    for (const task of tasks) {
      session.append('wuji/task/change', {
        taskId: task.taskId,
        patch: {
          deps: task.deps,
          assignedTo: task.assignedTo,
          requirement: task.requirement,
          input: task.input,
          output: task.output,
          returnFormat: task.returnFormat,
          failurePolicy: task.failurePolicy,
          status: 'pending',
          evidence: null,
        },
      });
    }
    const activeTaskId = tasks.find(task => task.deps.length === 0)?.taskId || tasks[0].taskId;
    session.append('wuji/task/activate', { taskId: activeTaskId });
    return { objective: args.objective, taskCount: tasks.length, taskIds: [...ids], activeTaskId, dependenciesValid };
  },
};

export const staffDispatchTool = {
  name: 'wuji_staff_dispatch',
  description: '参谋部：将一个已规划且依赖已满足的任务节点派发给指定 subagent provider；参谋部不亲自执行。',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'object', description: '完整任务节点（来自 wuji.task 表）。' },
      provider: { type: 'string', description: '已注册的 subagents provider 名称。' },
      prompt: { type: 'string', description: '给执行 agent 的最小任务契约。' },
    },
    required: ['task', 'provider', 'prompt'],
  },
  output: {
    schema: { type: 'object', properties: { taskId: { type: 'string' }, status: { type: 'string' }, childId: { oneOf: [{ type: 'string' }, { type: 'null' }] } }, required: ['taskId', 'status', 'childId'] },
    render(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }]; },
  },
  isConcurrencySafe() { return false; },
  async execute(args, exec) {
    const task = args.task || {};
    const parent = exec.agent;
    if (!parent?.session) throw new Error('参谋部派发必须归属于当前 Agent Session');
    if (!task.taskId || !args.provider || !args.prompt) throw new Error('派发需要 taskId、provider、prompt');
    const subagents = exec.agent.ctx.get('subagents');
    if (!subagents) throw new Error('subagents 服务未挂载');
    parent.session.append('wuji/task/status', { taskId: task.taskId, status: 'running', evidence: null });
    try {
      const run = await subagents.start(args.provider, {
        label: `wuji-${task.taskId}`,
        prompt: composeWorkerPrompt(args.prompt),
        parent,
        signal: exec.signal,
      });
      // start() proves child creation only. Completion requires a later terminal
      // receipt with artifact/evidence; never claim success here.
      return { taskId: task.taskId, status: 'dispatched', childId: run.childId || run.id || null };
    } catch (error) {
      parent.session.append('wuji/task/status', { taskId: task.taskId, status: 'failed', evidence: error?.message || String(error) });
      throw error;
    }
  },
};

export const staffCompletionTool = {
  name: 'wuji_task_complete',
  description: '参谋部完成回执桥：只有终止状态、产物标识和验证证据齐全时，才能结束已派发任务。',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      status: { type: 'string', enum: ['success', 'failed'] },
      artifact: { type: 'string', description: '产物路径、句柄或内容地址。' },
      evidence: { type: 'string', description: '独立验证证据或失败依据。' },
    },
    required: ['taskId', 'status', 'artifact', 'evidence'],
  },
  output: {
    schema: { type: 'object', properties: { taskId: { type: 'string' }, status: { type: 'string' }, recorded: { type: 'boolean' } }, required: ['taskId', 'status', 'recorded'] },
    render(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }]; },
  },
  isConcurrencySafe() { return false; },
  async execute(args, exec) {
    const session = exec.agent?.session;
    if (!session) throw new Error('完成回执必须归属于当前 Agent Session');
    if (!args.taskId || !args.artifact || !args.evidence) throw new Error('完成回执需要 taskId、artifact、evidence');
    if (!['success', 'failed'].includes(args.status)) throw new Error('完成回执状态必须为 success 或 failed');
    session.append('wuji/task/status', { taskId: args.taskId, status: args.status, evidence: `artifact:${args.artifact}; ${args.evidence}` });
    return { taskId: args.taskId, status: args.status, recorded: true };
  },
};

export default staffPlanTool;
