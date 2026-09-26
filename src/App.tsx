import { Routes, Route } from 'react-router-dom';
import Shell from '@/components/Shell';
import { Toast } from '@/components/Toast';
import { SessionView } from '@/pages/SessionView';
import Home from '@/pages/Home';
import Sessions from '@/pages/Sessions';
import Jobs from '@/pages/Jobs';
import Connections from '@/pages/Connections';
import Scheduled from '@/pages/Scheduled';
import Usage from '@/pages/Usage';
import Audit from '@/pages/Audit';
import Settings from '@/pages/Settings';
import Memory from '@/pages/Memory';
import SignIn from '@/pages/SignIn';
import Share from '@/pages/Share';
import NotFound from '@/pages/NotFound';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/share/:token" element={<Share />} />

        <Route element={<Shell />}>
          <Route path="/" element={<Home />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/s/:id" element={<SessionView mode="live" />} />
          <Route path="/s/:id/replay" element={<SessionView mode="replay" />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/scheduled" element={<Scheduled />} />
          <Route path="/usage" element={<Usage />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toast />
    </>
  );
}
