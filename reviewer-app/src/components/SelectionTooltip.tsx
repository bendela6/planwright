import { useEffect, useState, useCallback } from 'react';

interface SelectionState {
  section: string;
  fragment: string;
  x: number;
  y: number;
}

interface SelectionTooltipProps {
  onAddNote: (section: string, fragment: string) => void;
}

export function SelectionTooltip({ onAddNote }: SelectionTooltipProps) {
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const handleMouseUp = useCallback((_e: MouseEvent) => {
    // Small delay to allow selection to stabilize
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();

      if (!text || !sel || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }

      // Walk up from anchor node to find nearest .annotatable section
      const anchorNode = sel.anchorNode;
      const focusNode = sel.focusNode;
      if (!anchorNode || !focusNode) {
        setSelection(null);
        return;
      }

      const anchorEl = anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode as Element;

      const section = anchorEl?.closest('.annotatable');
      if (!section) {
        setSelection(null);
        return;
      }

      const sectionTitle = section.getAttribute('data-section-title') ?? '';

      // Position the tooltip near the selection end
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelection({
        section: sectionTitle,
        fragment: text,
        x: rect.left + rect.width / 2,
        y: rect.top - 8, // just above selection
      });
    });
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // If clicking on the tooltip itself, don't clear
    const target = e.target as HTMLElement;
    if (target.closest('[data-selection-tooltip]')) return;
    setSelection(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseUp, handleMouseDown]);

  if (!selection) return null;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!selection) return;
    const { section, fragment } = selection;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    onAddNote(section, fragment);
  }

  return (
    <div
      data-selection-tooltip
      style={{
        position: 'fixed',
        left: selection.x,
        top: selection.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 50,
      }}
    >
      <button
        onMouseDown={e => e.preventDefault()} // prevent selection loss
        onClick={handleClick}
        className={[
          'bg-blue-500 hover:bg-blue-400 text-white',
          'text-xs font-medium px-2.5 py-1 rounded shadow-lg',
          'flex items-center gap-1.5 whitespace-nowrap',
          'transition-colors',
        ].join(' ')}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        Add note
      </button>
      {/* Caret */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -4,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: '4px solid rgb(59 130 246)',
        }}
      />
    </div>
  );
}
