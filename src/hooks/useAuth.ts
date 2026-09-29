import { useUser } from '@clerk/clerk-react';

// Reads the signed-in user straight from Clerk (already loaded client-side
// via ClerkProvider) instead of round-tripping to the backend.
export function useAuth() {
  const { user, isLoaded } = useUser();
  return {
    user: user
      ? { id: user.id, name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || '', email: user.primaryEmailAddress?.emailAddress || '' }
      : null,
    loading: !isLoaded,
  };
}
