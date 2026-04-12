import { useState } from 'react';
import { usePlan } from './hooks/usePlan';
import { useAnnotations } from './hooks/useAnnotations';
import { useStatus } from './hooks/useStatus';
import { extractSections } from './utils/markdown';
import { TableOfContents } from './components/TableOfContents';
import { PlanViewer } from './components/PlanViewer';
import { AnnotationInput } from './components/AnnotationInput';
import { NotesPanel } from './components/NotesPanel';
import { SelectionTooltip } from './components/SelectionTooltip';
import { ToastProvider } from './components/Toast';
import { StatusDashboard } from './components/StatusDashboard';

interface ActiveInput {
  section: string;
  fragment: string;
}

type Tab = 'plan' | 'status';

function AppInner() {
  const { content, filename, metadata, isLoading, error } = usePlan();
  const {
    annotations,
    addAnnotation,
    removeAnnotation,
    editAnnotation,
    clearAnnotations,
    getAllAnnotations,
  } = useAnnotations();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<ActiveInput | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('plan');

  const { data: statusData } = useStatus();
  const sections = extractSections(content);
  const annotationList = Array.from(annotations.values());

  function handleAnnotate(sectionTitle: string, fragment: string) {
    setActiveInput({ section: sectionTitle, fragment });
  }

  function handleAnnotationSubmit(note: string) {
    if (!activeInput) return;
    addAnnotation(activeInput.section, activeInput.fragment, note);
    setActiveInput(null);
  }

  async function handleSendNotes() {
    const notes = getAllAnnotations().map(a => ({
      section: a.section,
      fragment: a.fragment,
      note: a.note,
    }));
    const res = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'review', notes }),
    });
    if (!res.ok) throw new Error(`Send failed: ${res.status}`);
    clearAnnotations();
  }

  async function handleApprove() {
    const res = await fetch('/api/approve', { method: 'POST' });
    if (!res.ok) throw new Error(`Approve failed: ${res.status}`);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center gap-4">
        {/* Mobile sidebar toggle */}
        <button
          className="lg:hidden p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-zinc-100 truncate">
            Plan Reviewer
          </h1>
          {filename && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">{filename}</p>
          )}
        </div>

        {/* Tab switcher */}
        <nav className="flex items-center gap-1 shrink-0" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'plan'}
            onClick={() => setActiveTab('plan')}
            className={[
              'px-3 py-1.5 rounded text-sm font-medium transition-colors',
              activeTab === 'plan'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900',
            ].join(' ')}
          >
            Plan
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'status'}
            onClick={() => setActiveTab('status')}
            className={[
              'px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === 'status'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900',
            ].join(' ')}
          >
            Status
            {statusData && statusData.overall.percentage > 0 && (
              <span
                className={[
                  'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  statusData.overall.percentage === 100
                    ? 'bg-green-900 text-green-200'
                    : 'bg-blue-900 text-blue-200',
                ].join(' ')}
              >
                {statusData.overall.percentage}%
              </span>
            )}
          </button>
        </nav>

        {metadata && activeTab === 'plan' && (
          <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-500 shrink-0">
            <span>
              <span className="text-zinc-300 font-medium">{metadata.completedSteps}</span>
              {' / '}
              <span className="text-zinc-300 font-medium">{metadata.totalSteps}</span>
              {' steps'}
            </span>
            <span>
              <span className="text-zinc-300 font-medium">{metadata.taskCount}</span>
              {' tasks'}
            </span>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 relative">
        {/* Mobile overlay */}
        {sidebarOpen && activeTab === 'plan' && (
          <div
            className="fixed inset-0 z-10 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — only on Plan tab */}
        {activeTab === 'plan' && (
          <aside
            className={[
              'fixed lg:sticky top-[57px] left-0 z-10 h-[calc(100vh-57px)] lg:h-[calc(100vh-57px)]',
              'w-64 bg-zinc-950 border-r border-zinc-800 overflow-y-auto',
              'transition-transform duration-200',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            ].join(' ')}
          >
            <div className="p-4">
              <TableOfContents sections={sections} />
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
          {activeTab === 'plan' && (
            <>
              <div className="flex-1">
                {isLoading && (
                  <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
                      <p className="text-zinc-500 text-sm">Loading plan...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="max-w-2xl mx-auto px-6 py-12">
                    <div className="bg-red-950/50 border border-red-800 rounded-lg p-6">
                      <h2 className="text-red-400 font-semibold mb-2">Failed to load plan</h2>
                      <p className="text-red-300/80 text-sm font-mono">{error}</p>
                    </div>
                  </div>
                )}

                {!isLoading && !error && content && (
                  <PlanViewer
                    content={content}
                    annotations={annotationList}
                    onAnnotate={handleAnnotate}
                  />
                )}
              </div>

              {/* Notes panel sticky at bottom of main column */}
              <NotesPanel
                annotations={annotationList}
                onRemove={removeAnnotation}
                onEdit={editAnnotation}
                onSend={handleSendNotes}
                onApprove={handleApprove}
              />
            </>
          )}

          {activeTab === 'status' && <StatusDashboard />}
        </main>
      </div>

      {/* Global selection tooltip */}
      <SelectionTooltip onAddNote={handleAnnotate} />

      {/* Annotation input modal */}
      {activeInput && (
        <AnnotationInput
          sectionTitle={activeInput.section}
          fragment={activeInput.fragment}
          onSubmit={handleAnnotationSubmit}
          onCancel={() => setActiveInput(null)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

export default App;
