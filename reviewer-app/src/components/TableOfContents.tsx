import { useEffect, useRef, useState } from 'react';

interface TocSection {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  sections: TocSection[];
}

export function TableOfContents({ sections }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (sections.length === 0) return;

    observerRef.current?.disconnect();

    const headingElements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) return;

    const visibleHeadings = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleHeadings.set(entry.target.id, entry.boundingClientRect.top);
          } else {
            visibleHeadings.delete(entry.target.id);
          }
        }

        if (visibleHeadings.size > 0) {
          // Pick the topmost visible heading
          let topId = '';
          let topY = Infinity;
          for (const [id, y] of visibleHeadings.entries()) {
            if (y < topY) {
              topY = y;
              topId = id;
            }
          }
          if (topId) setActiveId(topId);
        }
      },
      {
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      }
    );

    for (const el of headingElements) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [sections]);

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <nav className="w-full">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3 px-2">
        Contents
      </p>
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const isActive = activeId === section.id;
          const indent =
            section.level === 1
              ? 'pl-2'
              : section.level === 2
                ? 'pl-2'
                : 'pl-6';

          return (
            <li key={section.id}>
              <button
                onClick={() => handleClick(section.id)}
                className={[
                  'w-full text-left text-sm py-1.5 rounded px-2 transition-colors duration-150 leading-snug',
                  indent,
                  isActive
                    ? 'text-blue-400 bg-blue-400/10 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
                  section.level === 1 ? 'font-medium' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {section.title}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
