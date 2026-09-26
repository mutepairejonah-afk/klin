// Small client-only UI store: theme, sidebar, and the connectors/repo/branch
// picked for the *next* task before a session exists. Nothing here is
// persisted server-side.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: UiState['theme']) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (v: boolean) => void;

  draft: string;
  setDraft: (v: string) => void;
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  selectedConnectors: string[];
  toggleConnector: (id: string) => void;
  removeConnector: (id: string) => void;
  repo: string;
  setRepo: (r: string) => void;
  branch: string;
  setBranch: (b: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),

      draft: '',
      setDraft: (draft) => set({ draft }),
      selectedJobId: null,
      setSelectedJobId: (selectedJobId) => set({ selectedJobId }),
      selectedConnectors: [],
      toggleConnector: (id) => {
        const cur = get().selectedConnectors;
        set({ selectedConnectors: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },
      removeConnector: (id) => set({ selectedConnectors: get().selectedConnectors.filter((x) => x !== id) }),
      repo: '', setRepo: (repo) => set({ repo }),
      branch: '', setBranch: (branch) => set({ branch }),
    }),
    {
      name: 'kiln-ui',
      // Only the theme needs to survive a refresh — draft text, the picked
      // job/connectors/repo/branch, and sidebar state are fine resetting.
      partialize: (s) => ({ theme: s.theme }),
    },
  ),
);
