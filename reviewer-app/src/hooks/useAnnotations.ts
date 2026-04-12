import { useState, useCallback } from 'react';

export interface Annotation {
  id: string;
  section: string;
  fragment: string;
  note: string;
  timestamp: string;
}

export function useAnnotations() {
  const [annotations, setAnnotations] = useState<Map<string, Annotation>>(new Map());

  const addAnnotation = useCallback((section: string, fragment: string, note: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setAnnotations(prev => {
      const next = new Map(prev);
      next.set(id, { id, section, fragment, note, timestamp: new Date().toISOString() });
      return next;
    });
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const editAnnotation = useCallback((id: string, note: string) => {
    setAnnotations(prev => {
      const existing = prev.get(id);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(id, { ...existing, note });
      return next;
    });
  }, []);

  const clearAnnotations = useCallback(() => {
    setAnnotations(new Map());
  }, []);

  const getAnnotationsForSection = useCallback((section: string) => {
    return Array.from(annotations.values()).filter(a => a.section === section);
  }, [annotations]);

  return {
    annotations,
    annotationCount: annotations.size,
    addAnnotation,
    removeAnnotation,
    editAnnotation,
    clearAnnotations,
    getAnnotationsForSection,
    getAllAnnotations: () => Array.from(annotations.values()),
  };
}
