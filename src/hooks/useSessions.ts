import { useEffect, useState, useCallback } from 'react';
import { sessionsApi } from '@/lib/api';
import type { Session, SessionStatus } from '@/lib/types';

export function useSessions(filter?: { status?: SessionStatus; repo?: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setLoading(true);
    sessionsApi.list(filter)
      .then(setSessions)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [filter?.status, filter?.repo]);

  useEffect(refetch, [refetch]);

  return { sessions, loading, error, refetch };
}
