import { useState, useEffect } from 'react';

export interface TaskStatus {
  id: number;
  title: string;
  steps: { total: number; completed: number };
  status: 'pending' | 'in_progress' | 'completed';
}

export interface OverallStatus {
  total: number;
  completed: number;
  percentage: number;
}

export interface StatusData {
  tasks: TaskStatus[];
  overall: OverallStatus;
}

export function useStatus(pollInterval = 5000) {
  const [data, setData] = useState<StatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to fetch status');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pollInterval]);

  return { data, isLoading, error };
}
