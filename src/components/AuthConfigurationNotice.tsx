export default function AuthConfigurationNotice() {
  return (
    <main className="setup-notice">
      <section className="setup-notice__card" aria-labelledby="setup-notice-title">
        <p className="setup-notice__eyebrow">Kiln setup</p>
        <h1 id="setup-notice-title">Authentication is not configured</h1>
        <p>
          Kiln needs its Clerk publishable key before it can load the
          authenticated app.
        </p>
        <p>
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in your environment,
          then restart the app. For local development, put it in
          <code> .env.local</code>.
        </p>
      </section>
    </main>
  );
}