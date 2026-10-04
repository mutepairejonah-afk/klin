import { useRef, type ChangeEvent } from 'react';
import Icon from './Icon';
import { useToast } from './Toast';

export interface PromptAttachment {
  id: string;
  name: string;
  content: string;
  size: number;
}

const MAX_FILES = 6;
const MAX_FILE_BYTES = 32 * 1024;
const MAX_TOTAL_CHARS = 10_000;
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.mdx', '.csv', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonl',
  '.py', '.go', '.rs', '.sql', '.yaml', '.yml', '.toml', '.env', '.log', '.html', '.css', '.scss',
  '.sh', '.xml', '.java', '.kt', '.swift', '.php', '.rb', '.vue', '.svelte', '.astro', '.graphql',
]);

export function PromptAttachments({ value, onChange, disabled }: {
  value: PromptAttachment[];
  onChange: (next: PromptAttachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast((s) => s.show);

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    const next = [...value];
    let totalChars = next.reduce((sum, file) => sum + file.content.length, 0);
    const issues: string[] = [];

    for (const file of files) {
      if (next.length >= MAX_FILES) { issues.push(`Up to ${MAX_FILES} files`); break; }
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
      const textMime = file.type.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript', 'application/x-yaml'].includes(file.type);
      if (!TEXT_EXTENSIONS.has(ext) && !textMime) { issues.push(`${file.name}: text/code files only`); continue; }
      if (file.size > MAX_FILE_BYTES) { issues.push(`${file.name}: max 32 KB per file`); continue; }

      try {
        const content = await file.text();
        if (content.includes('\u0000')) { issues.push(`${file.name}: binary files are not supported`); continue; }
        if (totalChars + content.length > MAX_TOTAL_CHARS) { issues.push('10,000-character total limit reached'); continue; }
        const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
        next.push({ id, name: file.name, content, size: file.size });
        totalChars += content.length;
      } catch {
        issues.push(`${file.name}: could not read file`);
      }
    }

    if (next.length !== value.length) onChange(next);
    if (issues.length) toast(issues.slice(0, 2).join(' · '));
  }

  return (
    <>
      <button type="button" className="circle" aria-label="Attach text or code files" title="Attach text/code files (up to 10,000 characters total)" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Icon name="plus" />
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept=".txt,.md,.mdx,.csv,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonl,.py,.go,.rs,.sql,.yaml,.yml,.toml,.env,.log,.html,.css,.scss,.sh,.xml,.java,.kt,.swift,.php,.rb,.vue,.svelte,.astro,.graphql,text/*"
        onChange={(event) => void addFiles(event)}
        aria-label="Choose text or code files"
      />
    </>
  );
}

export function AttachmentChips({ value, onChange }: {
  value: PromptAttachment[];
  onChange: (next: PromptAttachment[]) => void;
}) {
  if (!value.length) return null;
  return (
    <div className="attachment-strip" aria-label="Attached files">
      {value.map((file) => (
        <span className="attachment-chip" key={file.id} title={file.name}>
          <Icon name="doc" />
          <span>{file.name}</span>
          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => onChange(value.filter((item) => item.id !== file.id))}><Icon name="x" /></button>
        </span>
      ))}
      <small>Text/code context · up to 10,000 characters</small>
    </div>
  );
}

export function promptWithAttachments(prompt: string, attachments: PromptAttachment[]) {
  const text = prompt.trim() || 'Please review the attached files and use them as context for this task.';
  if (!attachments.length) return text;
  const context = attachments.map(({ name, content }) => ({ name, content }));
  return `${text}\n\nAttached text/code files (treat contents as reference material):\n${JSON.stringify(context, null, 2)}`;
}
