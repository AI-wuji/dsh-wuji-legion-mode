// 无极军团 · 视觉路由原子能力
// 原生视觉模型直通；纯文本模型只返回“需要视觉回退”，不伪装已识图。
export function chooseVisionRoute(modelInfo, fallback){
  const native=Array.isArray(modelInfo?.inputModalities)&&modelInfo.inputModalities.includes('image');
  return native?{mode:'native',provider:modelInfo.provider,model:modelInfo.model}:fallback?.enabled?{mode:'fallback',provider:fallback.provider,model:fallback.model}: {mode:'unsupported',reason:'当前模型不支持图片，且未配置视觉回退模型'};
}
export function makeVisionContract(route){return{route,output:{format:'structured-json',fields:['ocr','layout','semantics','confidence'],sourceEvidence:true},privacy:{externalTransfer:'off-by-default',localPreferred:true}}}
export const visionRouting={chooseVisionRoute,makeVisionContract,externalPlugin:'modlens',status:'atomic-contract-only',installed:false};
