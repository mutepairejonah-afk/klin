import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth as useClerkAuth } from '@clerk/clerk-react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded } = useClerkAuth();
  // Clerk's script loads async; show the app frame right away instead of a blank page.
  if (!isLoaded) return <AppFrameSkeleton />;
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  );
}
import Shell from '@/components/Shell';
import { AppFrameSkeleton, PageSkeleton } from '@/components/Skeleton';
import { Toast } from '@/components/Toast';
import { useUiStore } from '@/lib/store';

const Home = lazy(() => import('@/pages/Home'));
const Sessions = lazy(() => import('@/pages/Sessions'));
const AiAgent = lazy(() => import('@/pages/AiAgent'));
const Connections = lazy(() => import('@/pages/Connections'));
const Scheduled = lazy(() => import('@/pages/Scheduled'));
const Usage = lazy(() => import('@/pages/Usage'));
const Audit = lazy(() => import('@/pages/Audit'));
const Settings = lazy(() => import('@/pages/Settings'));
const Memory = lazy(() => import('@/pages/Memory'));
const Library = lazy(() => import('@/pages/Library'));
const SignIn = lazy(() => import('@/pages/SignIn'));
const Share = lazy(() => import('@/pages/Share'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const SessionView = lazy(() => import('@/pages/SessionView').then((m) => ({ default: m.SessionView })));

export default function App() {
  const theme = useUiStore((s) => s.theme);

  // Applies the chosen theme to <html data-theme="...">. 'system' removes
  // the attribute entirely so the CSS's prefers-color-scheme media query
  // decides instead (see globals.css).
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/share/:token" element={<Share />} />

        <Route element={<RequireAuth><Shell /></RequireAuth>}>
          <Route path="/" element={<Home />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/s/:id" element={<SessionView mode="live" />} />
          <Route path="/s/:id/replay" element={<SessionView mode="replay" />} />
          <Route path="/agent" element={<AiAgent />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/scheduled" element={<Scheduled />} />
          <Route path="/usage" element={<Usage />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/library" element={<Library />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </Suspense>
      <Toast />
    </>
  );
}
