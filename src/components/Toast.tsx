import { create } from 'zustand';

interface ToastState { message: string | null; show: (m: string) => void; }
export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    set({ message });
    window.clearTimeout((window as any).__toastTimer);
    (window as any).__toastTimer = window.setTimeout(() => set({ message: null }), 1800);
  },
}));

export function Toast() {
  const message = useToast((s) => s.message);
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}
