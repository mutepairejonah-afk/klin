// Specialist agent personas from msitarzewski/agency-agents (MIT, see
// public/agents/LICENSE-agency-agents.txt). Index is small and fetched once;
// each persona's full prompt is fetched only when it's actually used.
export interface Specialist {
  slug: string; name: string; description: string; emoji: string; vibe: string; division: string;
}
interface Catalog { divisions: Record<string, string>; agents: Specialist[] }

let catalog: Promise<Catalog> | null = null;
export function loadSpecialists(): Promise<Catalog> {
  if (!catalog) {
    catalog = fetch('/agents/index.json').then((r) => {
      if (!r.ok) throw new Error('catalog');
      return r.json() as Promise<Catalog>;
    }).catch((e) => { catalog = null; throw e; });
  }
  return catalog;
}

export async function loadPrompt(slug: string): Promise<string> {
  const r = await fetch(`/agents/${encodeURIComponent(slug)}.md`);
  if (!r.ok) throw new Error('prompt');
  return r.text();
}
