import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Render model-authored replies as Markdown without allowing raw HTML.
 * react-markdown applies its URL safety transform; links open separately so
 * an answer cannot navigate away from the current Klin session.
 */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (!href) return <>{children}</>;
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          table({ children, ...props }) {
            return <div className="assistant-markdown-table"><table {...props}>{children}</table></div>;
          },
          img({ src, alt }) {
            if (!src) return null;
            return <img src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" />;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
