import { useMemo, useRef, useEffect, useCallback } from 'react';
import { parseMarkdownToHtml } from '../utils/markdown';
import { MermaidDiagram } from './MermaidDiagram';
import type { Annotation } from '../hooks/useAnnotations';

interface PlanViewerProps {
  content: string;
  annotations?: Annotation[];
  onAnnotate?: (sectionTitle: string, fragment: string) => void;
}

type Segment =
  | { type: 'html'; content: string }
  | { type: 'mermaid'; code: string };

function splitIntoSegments(html: string): Segment[] {
  const segments: Segment[] = [];
  const mermaidRegex = /<pre class="mermaid">([\s\S]*?)<\/pre>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mermaidRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'html', content: html.slice(lastIndex, match.index) });
    }
    // Unescape HTML entities in mermaid code since it went through escapeHtml
    const code = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    segments.push({ type: 'mermaid', code });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    segments.push({ type: 'html', content: html.slice(lastIndex) });
  }

  return segments;
}

export function PlanViewer({ content, annotations = [], onAnnotate }: PlanViewerProps) {
  const articleRef = useRef<HTMLElement>(null);

  const segments = useMemo(() => {
    const html = parseMarkdownToHtml(content);
    return splitIntoSegments(html);
  }, [content]);

  // Handle click on annotatable sections
  const handleArticleClick = useCallback((e: React.MouseEvent) => {
    if (!onAnnotate) return;

    // If text is currently selected, SelectionTooltip handles it
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;

    const target = e.target as HTMLElement;
    const section = target.closest('.annotatable');
    if (!section) return;

    const sectionTitle = section.getAttribute('data-section-title') ?? '';
    onAnnotate(sectionTitle, sectionTitle);
  }, [onAnnotate]);

  // Inject annotation badge dots into sections that have notes
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    // Remove existing badges
    const existingBadges = article.querySelectorAll('[data-annotation-badge]');
    existingBadges.forEach(b => b.remove());

    if (annotations.length === 0) return;

    // Group by section
    const countsBySection = new Map<string, number>();
    for (const ann of annotations) {
      countsBySection.set(ann.section, (countsBySection.get(ann.section) ?? 0) + 1);
    }

    for (const [sectionTitle, count] of countsBySection.entries()) {
      const sectionEl = article.querySelector(
        `.annotatable[data-section-title="${CSS.escape(sectionTitle)}"]`
      );
      if (!sectionEl) continue;

      // Ensure relative positioning for badge placement
      (sectionEl as HTMLElement).style.position = 'relative';

      const badge = document.createElement('div');
      badge.setAttribute('data-annotation-badge', '');
      badge.style.cssText = [
        'position: absolute',
        'top: 0.5rem',
        'right: 0',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'width: 1.25rem',
        'height: 1.25rem',
        'background-color: rgb(59 130 246)',
        'color: white',
        'font-size: 0.6rem',
        'font-weight: 700',
        'border-radius: 9999px',
        'pointer-events: none',
        'line-height: 1',
        'z-index: 10',
      ].join('; ');
      badge.textContent = String(count);
      sectionEl.appendChild(badge);
    }
  }, [annotations]);

  if (!content) {
    return null;
  }

  return (
    <article
      ref={articleRef}
      className="plan-viewer max-w-4xl mx-auto px-6 py-8"
      onClick={handleArticleClick}
    >
      {segments.map((segment, idx) => {
        if (segment.type === 'mermaid') {
          return <MermaidDiagram key={idx} code={segment.code} />;
        }
        return (
          <div
            key={idx}
            className="plan-content"
            dangerouslySetInnerHTML={{ __html: segment.content }}
          />
        );
      })}
    </article>
  );
}
