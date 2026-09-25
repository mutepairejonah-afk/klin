// Drives a session view in one of two modes:
//  - live:   opens an SSE subscription and appends events as they arrive
//  - replay: fetches the full event log once, then a `cursor` (driven by a
//            scrubber) decides how many events are folded into state
// Both modes render through the same foldEvents() — see lib/sessionReducer.ts.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { sessionsApi, shareApi } from '@/lib/api';
import { foldEvents, type FoldedState } from '@/lib/sessionReducer';
import type { SessionEvent } from '@/lib/types';

interface Options {
  mode: 'live' | 'replay' | 'share';
  shareToken?: string; // required when mode === 'share'
}

export function useSessionEvents(sessionId: string, opts: Options) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [cursor, setCursor] = useState(0); // replay/share only
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const unsubRef = useRef<() => void>();

  useEffect(() => {
    setEvents([]); setCursor(0); setLoadError(null);
    if (opts.mode === 'live') {
      unsubRef.current = sessionsApi.subscribe(
        sessionId,
        (e) => setEvents((prev) => [...prev, e]),
        () => setConnected(false),
      );
      setConnected(true);
      return () => unsubRef.current?.();
    }
    const fetcher = opts.mode === 'share' && opts.shareToken
      ? shareApi.replay(opts.shareToken)
      : sessionsApi.replay(sessionId);
    fetcher
      .then((log) => { setEvents(log); setCursor(log.length ? log.length - 1 : 0); })
      .catch((err) => setLoadError(String(err)));
  }, [sessionId, opts.mode, opts.shareToken]);

  const visible = opts.mode === 'live' ? events : events.slice(0, cursor + 1);
  const state: FoldedState = useMemo(() => foldEvents(visible), [visible]);

  const approve = useCallback((approvalId: string, decision: 'approved' | 'rejected') => {
    if (opts.mode !== 'live') return;
    // Optimistic local echo so the UI responds instantly; the real
    // approval.resolved event from the server reconciles moments later.
    setEvents((prev) => [...prev, {
      seq: prev.length, ts: new Date().toISOString(),
      type: 'approval.resolved', payload: { id: approvalId, decision },
    }]);
    sessionsApi.resolveApproval(sessionId, approvalId, decision).catch((err) => setLoadError(String(err)));
  }, [sessionId, opts.mode]);

  const sendMessage = useCallback((message: string) => {
    if (opts.mode !== 'live') return;
    sessionsApi.sendMessage(sessionId, message).catch((err) => setLoadError(String(err)));
  }, [sessionId, opts.mode]);

  return {
    events, visibleEvents: visible, state, connected, loadError,
    cursor, setCursor, maxCursor: Math.max(0, events.length - 1),
    approve, sendMessage,
  };
}
