import { useState } from 'react';
import type { Annotation } from '../hooks/useAnnotations';
import { useToast } from './Toast';

interface NotesPanelProps {
  annotations: Annotation[];
  onRemove: (id: string) => void;
  onEdit: (id: string, note: string) => void;
  onSend: () => Promise<void>;
  onApprove: () => Promise<void>;
}

export function NotesPanel({ annotations, onRemove, onEdit, onSend, onApprove }: NotesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [approved, setApproved] = useState(false);
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const { showToast } = useToast();

  const count = annotations.length;

  function startEdit(annotation: Annotation) {
    setEditingId(annotation.id);
    setEditDraft(annotation.note);
  }

  function commitEdit(id: string) {
    if (editDraft.trim()) {
      onEdit(id, editDraft.trim());
    }
    setEditingId(null);
    setEditDraft('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft('');
  }

  async function handleSend() {
    if (count === 0 || sending || approved) return;
    setSending(true);
    try {
      await onSend();
      showToast('Notes sent to agent', 'success');
    } catch {
      showToast('Failed to send notes', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleApprove() {
    if (approving || approved) return;
    setApproving(true);
    try {
      await onApprove();
      setApproved(true);
      showToast('Plan approved', 'success');
    } catch {
      showToast('Failed to approve plan', 'error');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-20 bg-zinc-950/95 backdrop-blur border-t border-zinc-800">
      {/* Collapsed header / toggle bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-zinc-900/50 transition-colors select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">
            {count === 0 ? 'No notes' : `${count} ${count === 1 ? 'note' : 'notes'}`}
          </span>
          {count > 0 && (
            <span className="bg-blue-500/20 text-blue-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons always visible */}
          <button
            onClick={e => { e.stopPropagation(); void handleSend(); }}
            disabled={count === 0 || sending || approved}
            className={[
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              count > 0 && !approved
                ? 'bg-blue-500 hover:bg-blue-400 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
            ].join(' ')}
          >
            {sending ? 'Sending...' : 'Send notes to agent'}
          </button>

          <button
            onClick={e => { e.stopPropagation(); void handleApprove(); }}
            disabled={approving || approved}
            className={[
              'px-3 py-1 text-xs font-medium rounded transition-colors',
              !approved
                ? 'bg-green-700 hover:bg-green-600 text-white'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
            ].join(' ')}
          >
            {approved ? 'Approved' : approving ? 'Approving...' : 'Approve'}
          </button>

          {/* Expand chevron */}
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>

      {/* Expanded notes list */}
      {expanded && (
        <div className="max-h-72 overflow-y-auto border-t border-zinc-800 px-4 py-3 space-y-3">
          {count === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-4">
              No notes yet. Select text or click a section to add a note.
            </p>
          ) : (
            annotations.map(annotation => (
              <div
                key={annotation.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
              >
                {/* Section tag */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="inline-block bg-zinc-800 text-zinc-400 text-xs px-2 py-0.5 rounded font-medium truncate max-w-[60%]">
                    {annotation.section}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(annotation)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors rounded"
                      title="Edit note"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onRemove(annotation.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors rounded"
                      title="Delete note"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Fragment quote */}
                {annotation.fragment && (
                  <blockquote className="border-l-2 border-zinc-700 pl-2.5 mb-2 text-xs text-zinc-500 italic leading-snug line-clamp-2">
                    {annotation.fragment}
                  </blockquote>
                )}

                {/* Note text / edit */}
                {editingId === annotation.id ? (
                  <div>
                    <textarea
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitEdit(annotation.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                      rows={3}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        onClick={() => commitEdit(annotation.id)}
                        className="px-2.5 py-1 text-xs bg-blue-500 hover:bg-blue-400 text-white rounded transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 leading-relaxed">{annotation.note}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
