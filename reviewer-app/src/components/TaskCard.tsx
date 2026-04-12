import { useState } from 'react';
import type { TaskStatus } from '../hooks/useStatus';
import { ProgressBar } from './ProgressBar';

interface TaskCardProps {
  task: TaskStatus;
}

function StatusIcon({ status }: { status: TaskStatus['status'] }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-900 shrink-0">
        <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
        <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
      </span>
    );
  }
  // pending
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 shrink-0">
      <span className="w-3 h-3 rounded-full border-2 border-zinc-600" />
    </span>
  );
}

function StatusBadge({ status }: { status: TaskStatus['status'] }) {
  const classes: Record<TaskStatus['status'], string> = {
    pending: 'bg-zinc-800 text-zinc-400',
    in_progress: 'bg-blue-900 text-blue-200',
    completed: 'bg-green-900 text-green-200',
  };
  const labels: Record<TaskStatus['status'], string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classes[status]} ${status === 'in_progress' ? 'animate-pulse' : ''}`}
    >
      {labels[status]}
    </span>
  );
}

export function TaskCard({ task }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const stepPercentage = task.steps.total > 0
    ? Math.round((task.steps.completed / task.steps.total) * 100)
    : 0;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <StatusIcon status={task.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-zinc-100 truncate">{task.title}</span>
            <StatusBadge status={task.status} />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs text-zinc-400 shrink-0">
              {task.steps.completed}/{task.steps.total} steps
            </span>
            <div className="flex-1">
              <ProgressBar percentage={stepPercentage} height="sm" />
            </div>
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-zinc-500 shrink-0 mt-0.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 py-2">
            Task {task.id} — {task.steps.completed} of {task.steps.total} steps completed
          </div>
        </div>
      )}
    </div>
  );
}
