// Drives a session view in one of two modes:
//  - live:   merges persisted history with authenticated SSE updates
//  - replay: fetches the event log once, then a cursor controls the fold
// Both modes render through the same foldEvents() — see lib/sessionReducer.ts.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { sessionsApi, shareApi } from '@/lib/api';
import { foldEvents, type FoldedState } from '@/lib/sessionReducer';
import type { SessionEvent } from '@/lib/types';

interface Options {
  mode: 'live' | 'replay' | 'share';
  shareToken?: string;
}

function mergeBySequence(current: SessionEvent[], incoming: SessionEvent[]) {
  const bySeq = new Map<number, SessionEvent>();
  for (const event of [...current, ...incoming]) bySeq.set(event.seq, event);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export function useSessionEvents(sessionId: string, opts: Options) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [cursor, setCursor] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const unsubRef = useRef<() => void>();
  const resyncRef = useRef<() => Promise<void>>();

  useEffect(() => {
    let active = true;
    setEvents([]); setCursor(0); setLoadError(null);
    if (opts.mode === 'live') {
      const syncHistory = () => sessionsApi.replay(sessionId)
        .then((history) => { if (active) setEvents((prev) => mergeBySequence(prev, history)); })
        .catch((err) => { if (active) setLoadError(String(err)); });
      resyncRef.current = syncHistory;
      unsubRef.current = sessionsApi.subscribe(
        sessionId,
        (event) => {
          if (!active) return;
          setConnected(true);
          setEvents((prev) => mergeBySequence(prev, [event]));
        },
        () => setConnected(false),
        // After every (re)connect, pull history so anything emitted while the
        // stream was down (including our own messages) shows up.
        () => { if (active) { setConnected(true); void syncHistory(); } },
      );
      return () => { active = false; setConnected(false); unsubRef.current?.(); };
    }

    const fetcher = opts.mode === 'share' && opts.shareToken
      ? shareApi.replay(opts.shareToken)
      : sessionsApi.replay(sessionId);
    fetcher
      .then((log) => {
        if (!active) return;
        setEvents(log);
        setCursor(log.length ? log.length - 1 : 0);
      })
      .catch((err) => { if (active) setLoadError(String(err)); });
    return () => { active = false; };
  }, [sessionId, opts.mode, opts.shareToken]);

  const visible = opts.mode === 'live' ? events : events.slice(0, cursor + 1);
  const state: FoldedState = useMemo(() => foldEvents(visible), [visible]);

  const approve = useCallback((approvalId: string, decision: 'approved' | 'rejected') => {
    if (opts.mode !== 'live') return;
    sessionsApi.resolveApproval(sessionId, approvalId, decision).catch((err) => setLoadError(String(err)));
  }, [sessionId, opts.mode]);

  const sendMessage = useCallback(async (message: string) => {
    if (opts.mode !== 'live') return false;
    setLoadError(null);
    try {
      await sessionsApi.sendMessage(sessionId, message);
      // The server persists the message before it replies, so a history pull
      // shows it immediately even when the live stream is down.
      void resyncRef.current?.();
      return true;
    } catch (err) {
      setLoadError(String(err));
      return false;
    }
  }, [sessionId, opts.mode]);

  return {
    events, visibleEvents: visible, state, connected, loadError,
    cursor, setCursor, maxCursor: Math.max(0, events.length - 1),
    approve, sendMessage,
  };
}
