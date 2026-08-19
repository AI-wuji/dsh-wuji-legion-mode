// Wuji Legion · 宿主插件包主入口
// 参考 dsh-goal 已验证的投影注册模式：用 ctx.inject(['sessionProjections'], ...) 注册投影单元。
// 插件形态：Cordis 普通插件对象（{ name, apply }），apply 里通过 ctx.inject 访问可选服务。

import {
  requirementProjection,
  taskProjection,
  officerAdviceProjection,
} from './projection.js';
import skillRegistryPlugin from './skill-registry.js';
import staffPlanTool, { staffDispatchTool } from './staff.js';
import { createWujiStaffService } from './staff-service.js';
import commanderSelectTool from './commanders.js';
import officerAdviseTool, { councilPlanTool } from './officers.js';
import { memoryProjection, evolutionProjection, memoryWriteTool, evolutionProposeTool, evolutionPromoteTool } from './evolution.js';
import { telemetryProjection, feedbackTool, createStatusTool } from './observability.js';
import intelligenceSearchTool from './intelligence.js';
import { jspaceDistill } from './jspace-distill.js';
import { visionRouting, chooseVisionRoute, makeVisionContract } from './vision-routing.js';

export default {
  name: 'wuji-host',
  apply(ctx) {
    ctx.provide('wujiStaff', createWujiStaffService());
    // 注册三张表投影（仅当 sessionProjections 服务存在时；headless 无 registry 时不受影响）
    ctx.inject(['sessionProjections'], (projectionCtx) => {
      const p = projectionCtx.sessionProjections;
      p.register(requirementProjection);
      p.register(taskProjection);
      p.register(officerAdviceProjection);
      p.register(memoryProjection);
      p.register(evolutionProjection);
      p.register(telemetryProjection);
    });

    // 注册技能库（仅当 skills 服务存在时）
    ctx.inject(['skills'], (skillsCtx) => {
      skillRegistryPlugin.apply(skillsCtx);
    });
    // 参谋部工具注册到全局 tools registry
    ctx.inject(['tools'], (toolsCtx) => {
      toolsCtx.tools.register(staffPlanTool);
      toolsCtx.tools.register(staffDispatchTool);
      toolsCtx.tools.register(commanderSelectTool);
      toolsCtx.tools.register(officerAdviseTool);
      toolsCtx.tools.register(councilPlanTool);
      toolsCtx.tools.register(memoryWriteTool);
      toolsCtx.tools.register(evolutionProposeTool);
      toolsCtx.tools.register(evolutionPromoteTool);
      toolsCtx.tools.register(feedbackTool);
      toolsCtx.tools.register(intelligenceSearchTool);
    });
    ctx.inject(['tools','sessionProjections','tokenMeter'], (statusCtx) => {
      statusCtx.tools.register(createStatusTool(statusCtx.sessionProjections,statusCtx.tokenMeter));
    });
  },
};

export {
  skillRegistryPlugin,
  requirementProjection,
  taskProjection,
  officerAdviceProjection,
  staffPlanTool,
  staffDispatchTool,
  createWujiStaffService,
  commanderSelectTool,
  officerAdviseTool,
  councilPlanTool,
  memoryProjection,
  evolutionProjection,
  memoryWriteTool,
  evolutionProposeTool,
  evolutionPromoteTool,
  telemetryProjection,
  feedbackTool,
  createStatusTool,
  intelligenceSearchTool,
  jspaceDistill,
  visionRouting,
  chooseVisionRoute,
  makeVisionContract,
};
