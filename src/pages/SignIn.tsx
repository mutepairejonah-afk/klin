import { useState } from 'react';
import { BRAND } from '@/lib/brand';
import { authApi } from '@/lib/api';

export default function SignIn() {
  const [email, setEmail] = useState('');
  return (
    <div className="bare">
      <div className="center">
        <div className="card auth">
          <div className="brand">
            <svg viewBox="0 0 32 32" width={26} height={26}><rect x="3.5" y="3.5" width="25" height="25" rx="8" fill="none" stroke="var(--blue)" strokeWidth={1.6} />
              <path d="m11 12.5 5 3.5-5 3.5" fill="none" stroke="var(--blue)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ fontFamily: '"Instrument Serif",serif', fontSize: 28 }}>{BRAND.name}</span>
          </div>
          <h1>Welcome back</h1>
          <p className="muted" style={{ margin: '0 0 14px' }}>{BRAND.tagline}</p>
          <a className="btn pri" href={authApi.oauthUrl('github')}>Continue with GitHub</a>
          <a className="btn" href={authApi.oauthUrl('google')}>Continue with Google</a>
          <div className="or">or</div>
          <input className="input" type="email" placeholder="Email address" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <a className="btn" href={`${authApi.oauthUrl('github')}?email=${encodeURIComponent(email)}`}>Continue with email</a>
          <small>By continuing you agree to the Terms and Privacy Policy.</small>
        </div>
      </div>
    </div>
  );
}
