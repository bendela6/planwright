import { useEffect, useRef, useState } from 'react';
import { useStatus } from '../hooks/useStatus';
import { ProgressBar } from './ProgressBar';
import { TaskCard } from './TaskCard';

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-full bg-zinc-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-zinc-700 rounded w-3/4" />
          <div className="h-2 bg-zinc-800 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function StatusDashboard() {
  const { data, isLoading, error } = useStatus();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const scrolledRef = useRef(false);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Update last-updated timestamp whenever data changes
  useEffect(() => {
    if (data) {
      setLastUpdated(new Date());
    }
  }, [data]);

  // Auto-scroll to first in_progress task on initial load
  useEffect(() => {
    if (data && !scrolledRef.current) {
      const firstInProgress = data.tasks.find((t) => t.status === 'in_progress');
      if (firstInProgress) {
        const el = cardRefs.current.get(firstInProgress.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          scrolledRef.current = true;
        }
      } else {
        scrolledRef.current = true;
      }
    }
  }, [data]);

  const pendingCount = data?.tasks.filter((t) => t.status === 'pending').length ?? 0;
  const inProgressCount = data?.tasks.filter((t) => t.status === 'in_progress').length ?? 0;
  const completedCount = data?.tasks.filter((t) => t.status === 'completed').length ?? 0;

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="bg-zinc-950 text-zinc-100 p-6 rounded-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-zinc-100">Implementation Progress</h2>
        {lastUpdated && (
          <span className="text-xs text-zinc-500 shrink-0">
            Updated {formatTime(lastUpdated)}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && !data && (
        <div className="space-y-3">
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-full" />
          <div className="h-2 bg-zinc-800 rounded animate-pulse w-1/3" />
          <div className="space-y-2 mt-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-lg p-4">
          <p className="text-red-400 text-sm font-semibold mb-1">Failed to load status</p>
          <p className="text-red-300/80 text-xs font-mono">{error}</p>
        </div>
      )}

      {/* Data loaded */}
      {data && (
        <>
          {/* Overall progress */}
          <div className="space-y-3">
            <ProgressBar
              percentage={data.overall.percentage}
              height="lg"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-zinc-300">
                <span className="font-semibold">{data.overall.completed}</span>
                <span className="text-zinc-500">/{data.overall.total} steps completed</span>
              </span>
              <span className="text-zinc-400 font-semibold">{data.overall.percentage}%</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <span className="w-2 h-2 rounded-full border border-zinc-600 inline-block" />
                {pendingCount} pending
              </span>
              <span className="flex items-center gap-1.5 text-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                {inProgressCount} in progress
              </span>
              <span className="flex items-center gap-1.5 text-green-300">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {completedCount} completed
              </span>
            </div>
          </div>

          {/* Task list */}
          {data.tasks.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-sm">
              No implementation status available yet
            </div>
          ) : (
            <div className="space-y-2">
              {data.tasks.map((task) => (
                <div
                  key={task.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(task.id, el);
                    else cardRefs.current.delete(task.id);
                  }}
                >
                  <TaskCard task={task} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state — no error, no loading, but data is null (shouldn't normally happen) */}
      {!isLoading && !error && !data && (
        <div className="text-center py-10 text-zinc-500 text-sm">
          No implementation status available yet
        </div>
      )}
    </div>
  );
}
