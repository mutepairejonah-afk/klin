import type { ToolName } from './types';

export const TOOL_ICON: Record<ToolName, string> = {
  terminal: 'terminal', editor: 'code', browser: 'globe', preview: 'monitor',
  db: 'db', deploy: 'rocket', git: 'branch', github: 'gh', tests: 'flask',
};
export const TOOL_LABEL: Record<ToolName, string> = {
  terminal: 'Terminal', editor: 'Editor', browser: 'Browser', preview: 'Preview',
  db: 'Database', deploy: 'Deploy', git: 'Git', github: 'GitHub', tests: 'Tests',
};
