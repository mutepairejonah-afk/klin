import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { BRAND } from '@/lib/brand';

// Which providers actually appear here (Google, GitHub, Vercel) is controlled
// in the Clerk Dashboard under User & Authentication -> SSO connections, not
// in this file — Clerk renders whatever's turned on there. Email sign-in is
// on by default. See kiln-backend/README.md "Auth (Clerk)" for setup notes.
export default function SignIn() {
  return (
    <div className="bare">
      <div className="center">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <svg viewBox="0 0 32 32" width={26} height={26}><rect x="3.5" y="3.5" width="25" height="25" rx="8" fill="none" stroke="var(--blue)" strokeWidth={1.6} />
            <path d="m11 12.5 5 3.5-5 3.5" fill="none" stroke="var(--blue)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontFamily: '"Instrument Serif",serif', fontSize: 28 }}>{BRAND.name}</span>
        </div>
        <ClerkSignIn
          routing="virtual"
          appearance={{
            variables: {
              colorPrimary: 'var(--blue)',
              colorBackground: 'var(--card)',
              colorText: 'var(--fg)',
              colorTextSecondary: 'var(--muted)',
              colorInputBackground: 'var(--bg)',
              colorInputText: 'var(--fg)',
              borderRadius: '10px',
              fontFamily: 'inherit',
            },
            elements: { card: 'auth', footer: 'auth-footer' },
          }}
        />
      </div>
    </div>
  );
}
