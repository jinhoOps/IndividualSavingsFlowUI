import {useRef, useState, type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';

export function AccountSignIn({client, onStart, onGoogleLogin, email: initialEmail = '', reauthenticate = false}: {
  client: SupabaseClient;
  onStart: () => void;
  onGoogleLogin: () => Promise<void>;
  email?: string;
  reauthenticate?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !email.trim() || !password) return;
    submitting.current = true;
    setBusy(true); setError(''); onStart();
    try {
      const {data, error: failure} = await client.auth.signInWithPassword({email: email.trim(), password});
      if (failure || !data.session) {
        setError(failure?.code === 'email_not_confirmed'
          ? '아직 이메일 확인이 끝나지 않은 계정입니다. 계정 설정을 확인해주세요.'
          : '로그인하지 못했습니다. 이메일과 비밀번호를 확인하고 다시 시도해주세요.');
      }
    } catch {
      setError('로그인하지 못했습니다. 연결을 확인하고 다시 시도해주세요.');
    } finally {
      setPassword(''); setBusy(false); submitting.current = false;
    }
  }

  async function signInWithGoogle() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(''); setPassword('');
    try {await onGoogleLogin();}
    finally {setBusy(false); submitting.current = false;}
  }

  return <>
    <form className="account-sign-in" aria-label="임시 이메일 로그인" aria-busy={busy} onSubmit={event => void signIn(event)}>
      <p>Google 로그인 준비 중에는 이메일과 비밀번호로 로그인할 수 있어요.</p>
      <label>이메일<input type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
        required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>
      <label>비밀번호<input type="password" name="password" autoComplete="current-password"
        required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
      <button type="submit" disabled={busy}>{busy ? '로그인 중…' : '이메일로 로그인'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    <button type="button" disabled={busy} onClick={() => void signInWithGoogle()}>
      {reauthenticate ? 'Google로 다시 로그인' : 'Google로 계속하기'}
    </button>
  </>;
}
