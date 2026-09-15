/**
 * [INPUT]: 依赖 fishing 领域内部的目录、类型和规则
 * [OUTPUT]: 对外导出垂钓领域公共 API
 * [POS]: 垂钓共享模块的唯一入口，避免调用方依赖内部文件结构
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export * from './catalog';
export * from './environment';
export * from './rules';
export * from './rewards';
export * from './types';
export * from './economy';
