import { useState, useEffect } from 'react';

interface PlanMetadata {
  title: string;
  sections: string[];
  taskCount: number;
  completedSteps: number;
  totalSteps: number;
}

interface UsePlanResult {
  content: string;
  filename: string;
  metadata: PlanMetadata | null;
  isLoading: boolean;
  error: string | null;
}

export function usePlan(): UsePlanResult {
  const [content, setContent] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [metadata, setMetadata] = useState<PlanMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlan() {
      try {
        setIsLoading(true);
        setError(null);

        const [planRes, metaRes] = await Promise.all([
          fetch('/api/plan'),
          fetch('/api/plan/metadata'),
        ]);

        if (!planRes.ok) {
          throw new Error(`Failed to fetch plan: ${planRes.status} ${planRes.statusText}`);
        }
        if (!metaRes.ok) {
          throw new Error(`Failed to fetch metadata: ${metaRes.status} ${metaRes.statusText}`);
        }

        const planData = (await planRes.json()) as { content: string; filename: string };
        const metaData = (await metaRes.json()) as PlanMetadata;

        if (!cancelled) {
          setContent(planData.content);
          setFilename(planData.filename);
          setMetadata(metaData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchPlan();

    return () => {
      cancelled = true;
    };
  }, []);

  return { content, filename, metadata, isLoading, error };
}
