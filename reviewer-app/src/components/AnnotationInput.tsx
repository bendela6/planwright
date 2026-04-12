import { useEffect, useRef, useState } from 'react';

interface AnnotationInputProps {
  sectionTitle: string;
  fragment: string;
  onSubmit: (note: string) => void;
  onCancel: () => void;
}

export function AnnotationInput({ sectionTitle, fragment, onSubmit, onCancel }: AnnotationInputProps) {
  const [note, setNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (note.trim()) onSubmit(note.trim());
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (note.trim()) onSubmit(note.trim());
  }

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-5">
        {/* Header */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-zinc-300">
            Add note to:{' '}
            <span className="text-blue-400">{sectionTitle}</span>
          </h3>
        </div>

        {/* Fragment quote */}
        {fragment && (
          <blockquote className="border-l-2 border-zinc-600 pl-3 mb-4 text-sm text-zinc-400 italic leading-snug line-clamp-3">
            {fragment}
          </blockquote>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your note... (Ctrl+Enter to submit)"
            rows={4}
            className={[
              'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5',
              'text-sm text-zinc-100 placeholder-zinc-500',
              'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500',
              'resize-none',
            ].join(' ')}
          />

          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!note.trim()}
              className={[
                'px-4 py-1.5 text-sm font-medium rounded transition-colors',
                note.trim()
                  ? 'bg-blue-500 hover:bg-blue-400 text-white'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
              ].join(' ')}
            >
              Add note
            </button>
          </div>
        </form>

        <p className="text-xs text-zinc-600 mt-2">Ctrl+Enter to submit · Esc to cancel</p>
      </div>
    </div>
  );
}
