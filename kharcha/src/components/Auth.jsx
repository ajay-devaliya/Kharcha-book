import { useEffect, useState } from 'react';
import { supabase } from '../data/supabaseStore.js';

/** Shows the sign-in screen when Supabase is configured. With no keys, runs in local mode with no login. */
export default function AuthGate({ children }) {
  const [st, setSt] = useState({ loading: !!supabase, session: null, recovery: false });

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSt((s) => ({ ...s, loading: false, session: data.session })));
    const { data } = supabase.auth.onAuthStateChange((event, session) =>
      setSt((s) => ({ ...s, loading: false, session, recovery: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : s.recovery })),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return children(null);
  if (st.loading) return <div className="splash">Loading…</div>;
  if (st.recovery && st.session) return <AuthScreen initial="reset" onDone={() => setSt((s) => ({ ...s, recovery: false }))} />;
  if (!st.session) return <AuthScreen />;
  return children(st.session);
}

const TITLES = {
  signin: ['Welcome back', 'Sign in'],
  signup: ['Create your account', 'Create account'],
  forgot: ['Reset your password', 'Send reset link'],
  reset: ['Choose a new password', 'Save password'],
};

function AuthScreen({ initial = 'signin', onDone }) {
  const [mode, setMode] = useState(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setInfo('');
    if (mode !== 'reset' && !/^\S+@\S+\.\S+$/.test(email.trim())) return setErr('Enter a valid email address.');
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) return setErr('Use a password with at least 8 characters.');
    if (mode === 'signin' && !password) return setErr('Enter your password.');
    setBusy(true);
    try {
      const em = email.trim();
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: em, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) {
          setInfo('Check your email and open the confirmation link, then sign in here.');
          setMode('signin');
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: window.location.origin });
        if (error) throw error;
        setInfo('If that email has an account, a reset link is on its way.');
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onDone && onDone();
      }
    } catch (ex) {
      setErr(ex && ex.message ? ex.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const [title, cta] = TITLES[mode];
  return (
    <div className="auth">
      <div className="auth-side">
        <div className="brand big">
          <span className="logo" aria-hidden="true">K</span> Kharcha Book
        </div>
        <h1>Know where every rupee goes.</h1>
        <ul>
          <li>Log expenses and income in seconds</li>
          <li>Budgets for the month and for each category</li>
          <li>Rent, salary and subscriptions add themselves</li>
          <li>Your data is yours. No one else who signs up can see it.</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={submit} noValidate>
        <h2>{title}</h2>
        {mode !== 'reset' && (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus />
          </div>
        )}
        {mode !== 'forgot' && (
          <div className="field">
            <label htmlFor="pw">{mode === 'reset' ? 'New password' : 'Password'}</label>
            <input id="pw" className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <div className="errtxt" role="alert">{err}</div>
        {info && <p className="note-ok">{info}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : cta}</button>
        <div className="auth-links">
          {mode === 'signin' && (
            <>
              <button type="button" className="link" onClick={() => { setMode('signup'); setErr(''); setInfo(''); }}>Create an account</button>
              <button type="button" className="link" onClick={() => { setMode('forgot'); setErr(''); setInfo(''); }}>Forgot password</button>
            </>
          )}
          {(mode === 'signup' || mode === 'forgot') && (
            <button type="button" className="link" onClick={() => { setMode('signin'); setErr(''); setInfo(''); }}>Back to sign in</button>
          )}
        </div>
      </form>
    </div>
  );
}
