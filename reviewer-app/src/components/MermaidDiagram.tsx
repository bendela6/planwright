import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;

function initMermaid() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      darkMode: true,
    });
    mermaidInitialized = true;
  }
}

let diagramCounter = 0;

interface MermaidDiagramProps {
  code: string;
}

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>('');
  const [renderError, setRenderError] = useState<boolean>(false);
  const idRef = useRef<string>(`mermaid-diagram-${++diagramCounter}`);

  useEffect(() => {
    initMermaid();

    let cancelled = false;

    async function render() {
      try {
        const { svg: renderedSvg } = await mermaid.render(idRef.current, code);
        if (!cancelled) {
          setSvg(renderedSvg);
          setRenderError(false);
        }
      } catch {
        if (!cancelled) {
          setRenderError(true);
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (renderError) {
    return (
      <pre className="bg-zinc-900 text-zinc-300 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="bg-zinc-900 rounded-lg p-4 flex items-center justify-center min-h-[100px]">
        <div className="text-zinc-500 text-sm">Rendering diagram...</div>
      </div>
    );
  }

  return (
    <div
      className="bg-zinc-900 rounded-lg p-4 overflow-x-auto my-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
