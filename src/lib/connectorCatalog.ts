// Static description of each connector (name, blurb, scopes). Whether a
// given user has actually connected it, and any account-specific metadata,
// comes from the backend (connectionsApi.list()) and is merged over this.
export interface ConnectorMeta { id: string; name: string; description: string; scopes: string[]; }

export const CONNECTOR_CATALOG: ConnectorMeta[] = [
  { id: 'github', name: 'GitHub', description: 'Clone repos, open PRs, read issues.', scopes: ['repo', 'pull_requests', 'issues'] },
  { id: 'neon', name: 'Neon', description: 'Create database branches and run dry-runs.', scopes: ['branches', 'read schema', 'execute SQL'] },
  { id: 'supabase', name: 'Supabase', description: 'Inspect schemas and apply migrations.', scopes: ['read schema', 'execute SQL'] },
  { id: 'vercel', name: 'Vercel', description: 'Deploy frontend previews.', scopes: ['deployments'] },
  { id: 'fly', name: 'Fly.io', description: 'Deploy backend previews with Fly Machines.', scopes: ['machines'] },
  { id: 'stripe', name: 'Stripe', description: 'Test-mode keys for billing work.', scopes: ['test keys only'] },
];
