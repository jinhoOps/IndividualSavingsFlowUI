import { Button } from '../../components/common/Button';
import {useEffect, useState, type ComponentProps} from 'react';
import {AppShell} from '../../components/common/AppShell';
import {AppContentFrame} from '../../components/common/AppContentFrame';
import {AppManagementMenu} from '../../journey/ui/AppManagementMenu';
import {loungeErrorMessage} from '../infrastructure/loungeRepository';
import type {LoungeProfile} from '../domain/profile';
import {LoungeApp} from './LoungeApp';
import {LoungeOnboarding} from './LoungeOnboarding';

export function LoungeEntry(props: Omit<ComponentProps<typeof LoungeApp>, 'nickname'>) {
  const [profile, setProfile] = useState<LoungeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    props.repository.getProfile().then(value => {if (active) setProfile(value);}, error => {if (active) setError(loungeErrorMessage(error));})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [props.repository, attempt]);
  if (!loading && !error && profile) return <LoungeApp {...props} nickname={profile.nickname} />;
  return <AppShell currentApp="lounge" managementMenu={<AppManagementMenu items={[]} />}>
    <AppContentFrame className="lounge-page">
      {loading ? <p role="status" className="lounge-muted">커뮤니티를 준비하고 있어요…</p> : error ? <section className="lounge-empty" role="alert">
        <h1>커뮤니티를 불러오지 못했어요</h1><p>{error}</p><Button variant="primary" onClick={() => setAttempt(v => v + 1)}>다시 불러오기</Button>
      </section> : <LoungeOnboarding repository={props.repository} onRegistered={setProfile} />}
    </AppContentFrame>
  </AppShell>;
}
