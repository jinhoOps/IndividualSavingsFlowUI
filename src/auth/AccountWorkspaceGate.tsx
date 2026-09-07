import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import type {Session, SupabaseClient} from '@supabase/supabase-js';
import {AccountWorkspaceSession} from '../workspace/infrastructure/accountWorkspaceSession';
import {createWorkspaceRemote} from '../workspace/infrastructure/workspaceRemote';
import {BrowserWorkspaceRepository} from '../workspace/infrastructure/workspaceRepository';
import {createEmptyWorkspace} from '../workspace/domain/model';
import {authCallbackUrl, getBrowserClient, readSupabaseConfig, RETURN_PATH_KEY, safeReturnPath, type SupabaseConfig} from './auth';
import {downloadText, downloadWorkspace, workspaceSummary} from './accountFiles';
import './account.css';
import {AccountDraftContext} from './AccountDraftContext';
import {importWorkspaceBackup} from '../workspace/infrastructure/workspaceBackup';
import {accountCacheKeys, accountCachePrefix, accountRecoveryRecords, getAccountTabId, hasAccountRecovery} from './accountTab';

interface AccountRuntime {user: Session['user']; workspace: AccountWorkspaceSession; generation: number}
export function AccountWorkspaceGate({children, client: suppliedClient, config: suppliedConfig}: {
  children: (workspace: AccountWorkspaceSession) => ReactNode;
  client?: SupabaseClient; config?: SupabaseConfig;
}) {
  const configured = useMemo(() => {
    try {
      const config = suppliedConfig ?? readSupabaseConfig(import.meta.env);
      return {config, client: suppliedClient ?? getBrowserClient(config)};
    } catch {return null;}
  }, [suppliedClient, suppliedConfig]);
  const [authState, setAuthState] = useState<'loading' | 'signed-out' | 'error' | 'ready'>('loading');
  const [runtime, setRuntime] = useState<AccountRuntime | null>(null);
  const [, render] = useState(0);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [appGeneration, setAppGeneration] = useState(0);
  const [startup, setStartup] = useState(0);
  const active = useRef<AccountRuntime | null>(null);
  const explicitLogout = useRef(false);
  const [tabId, setTabId] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    void getAccountTabId().then(id => {if (!disposed) setTabId(id);})
      .catch(() => {if (!disposed) setAuthState('error');});
    return () => {disposed = true;};
  }, []);
  const [local] = useState(() => new BrowserWorkspaceRepository().load());
  const localCandidate = local.status === 'found' ? local.workspace : null;

  useEffect(() => {
    if (!configured || !tabId) return;
    let disposed = false;
    let generation = 0;
    let unsubscribeWorkspace: (() => void) | undefined;
    async function accept(session: Session | null) {
      if (disposed) return;
      if (session && session.user.id === active.current?.user.id && active.current.workspace.status !== 'expired') return;
      if (!session && !explicitLogout.current && active.current
        && (active.current.workspace.pending || active.current.workspace.localEdits || Object.keys(active.current.workspace.recoveryDrafts).length)) {
        active.current.workspace.lock();
        setRuntime(active.current); setAuthState('ready');
        return;
      }
      generation++;
      const token = generation;
      unsubscribeWorkspace?.();
      active.current?.workspace.dispose();
      active.current = null; setRuntime(null);
      if (!session) {setAuthState('signed-out'); return;}
      setAuthState('loading');
      const workspace = new AccountWorkspaceSession(createWorkspaceRemote(configured!.client, session.user.id),
        `${configured!.config.projectRef}:${session.user.id}:${tabId}`, {userId: session.user.id, storage: accountStorage()});
      const next = {user: session.user, workspace, generation: token};
      active.current = next;
      let lastExternal = workspace.externalRevision;
      unsubscribeWorkspace = workspace.subscribe(() => {
        if (disposed || active.current !== next) return;
        if (workspace.externalRevision !== lastExternal) {
          lastExternal = workspace.externalRevision;
          if (!workspace.localEdits && !workspace.pending) setAppGeneration(value => value + 1);
          else setNotice('다른 기기에서 계획이 변경되었습니다. 작성 중 입력을 확인한 뒤 적용해주세요.');
        }
        render(value => value + 1);
      });
      await workspace.refresh();
      if (disposed || token !== generation) {workspace.dispose(); return;}
      if (Object.keys(workspace.recoveryDrafts).length) setNotice('이 계정에서 보내지 못한 입력을 복구했습니다. 내용을 확인한 뒤 적용해주세요.');
      else if (hasAccountRecovery(accountStorage(), accountCachePrefix(configured!.config, session.user.id))) setNotice('다른 탭 또는 이전 방문의 미전송 기록이 있습니다. 내 계정에서 복구 파일로 보관할 수 있습니다.');
      setRuntime(next); setAuthState('ready');
    }
    const {data: {subscription}} = configured.client.auth.onAuthStateChange((_event, session) => {
      // Leave the SDK auth lock before making any data request.
      window.setTimeout(() => {void accept(session);}, 0);
    });
    void configured.client.auth.getSession().then(({data, error}) => {
      if (disposed) return;
      if (error) setAuthState('error'); else void accept(data.session);
    }).catch(() => {if (!disposed) setAuthState('error');});
    return () => {
      disposed = true; generation++; subscription.unsubscribe(); unsubscribeWorkspace?.();
      active.current?.workspace.dispose(); active.current = null;
    };
  }, [configured, startup, tabId]);

  useEffect(() => {
    if (!runtime) return;
    const workspace = runtime.workspace;
    const refresh = () => {if (document.visibilityState === 'visible') void workspace.refresh();};
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('isf-account-workspace') : null;
    const clearSignedOut = () => {
      explicitLogout.current = true;
      workspace.dispose(true); active.current = null; setRuntime(null); setAuthState('signed-out'); setMenu(false);
    };
    if (channel) channel.onmessage = event => {
      if (event.data?.userId !== runtime.user.id) return;
      if (event.data.logout) clearSignedOut(); else refresh();
    };
    const cacheKey = `${accountCachePrefix(configured!.config, runtime.user.id)}:${tabId}`;
    const storageChanged = (event: StorageEvent) => {
      if (event.key === cacheKey && event.oldValue !== null && event.newValue === null) clearSignedOut();
    };
    window.addEventListener('storage', storageChanged);
    let revision = workspace.snapshot?.revision;
    const unsubscribe = workspace.subscribe(() => {
      if (workspace.status === 'ready' && revision !== workspace.snapshot?.revision) {
        revision = workspace.snapshot?.revision;
        channel?.postMessage({userId: runtime.user.id, revision});
      }
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (workspace.pending || workspace.localEdits) {event.preventDefault(); event.returnValue = '';}
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh); window.removeEventListener('beforeunload', beforeUnload);
      unsubscribe(); channel?.close();
      window.removeEventListener('storage', storageChanged);
    };
  }, [runtime, configured, tabId]);

  async function login() {
    if (!configured) return;
    explicitLogout.current = false;
    try {
      window.sessionStorage.setItem(RETURN_PATH_KEY, safeReturnPath(window.location.pathname, import.meta.env.BASE_URL));
      const {error} = await configured.client.auth.signInWithOAuth({provider: 'google', options: {
        redirectTo: authCallbackUrl(window.location.origin, import.meta.env.BASE_URL),
      }});
      if (error) setNotice('로그인을 시작하지 못했습니다. 다시 시도해주세요.');
    } catch {setNotice('로그인을 시작하지 못했습니다. 브라우저 저장소와 연결을 확인해주세요.');}
  }
  async function initialize(useLocal: boolean) {
    if (!runtime) return;
    const candidate = useLocal ? localCandidate : createEmptyWorkspace();
    if (!candidate) return;
    const result = await runtime.workspace.initialize(candidate);
    if (runtime.workspace.initializationExists) setNotice('다른 기기에서 먼저 계획을 만들었습니다. 계정의 저장 계획을 불러왔으며 브라우저 원본은 그대로 보관합니다.');
    if (result.status === 'saved') {
      if (useLocal) {
        try {
          const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(candidate)));
          const sourceHash = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
          window.localStorage.setItem(`isf-account-imported:${configured!.config.projectRef}:${runtime.user.id}:${sourceHash}`, '1');
        } catch {setNotice('계정에 저장했습니다. 이 브라우저의 이전 완료 표시는 저장하지 못했습니다.');}
      }
      setAppGeneration(value => value + 1);
    }
  }
  async function logout() {
    if (!runtime || !configured) return;
    const prefix = accountCachePrefix(configured.config, runtime.user.id);
    const storage = accountStorage();
    if ((runtime.workspace.pending || runtime.workspace.localEdits || hasAccountRecovery(storage, prefix))
      && !window.confirm('다른 탭을 포함해 저장되지 않은 입력이 있습니다. 복구 파일이 필요하면 취소 후 각 탭에서 다운로드해주세요. 입력을 버리고 이 브라우저에서 로그아웃할까요?')) return;
    explicitLogout.current = true;
    const {error} = await configured.client.auth.signOut({scope: 'local'});
    if (error) {explicitLogout.current = false; setNotice('로그아웃하지 못했습니다. 다시 시도해주세요.'); return;}
    try {if (storage) for (const key of accountCacheKeys(storage, prefix)) storage.removeItem(key);} catch { /* Auth has still been revoked. */ }
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel('isf-account-workspace');
      channel.postMessage({userId: runtime.user.id, logout: true}); channel.close();
    }
    runtime.workspace.dispose(true); active.current = null; setRuntime(null); setAuthState('signed-out'); setMenu(false);
  }
  function downloadRecovery() {
    if (!runtime || !configured) return;
    downloadText('isf-unsent-recovery.json', JSON.stringify({format: 'isf-unsent-recovery',
      pending: runtime.workspace.pending, drafts: runtime.workspace.recoveryDrafts,
      tabRecords: accountRecoveryRecords(accountStorage(), accountCachePrefix(configured.config, runtime.user.id)),
    }));
  }
  async function restoreLocal() {
    if (!runtime?.workspace.snapshot || !localCandidate) return;
    const workspace = runtime.workspace;
    const revision = workspace.snapshot!.revision;
    if (!window.confirm(`${runtime.user.email ?? '현재 계정'}의 모든 계획을 이 브라우저 계획으로 교체합니다.\n현재: ${workspaceSummary(workspace.snapshot!)}\n가져오기: ${workspaceSummary(localCandidate)}\n계속할까요?`)) return;
    const result = await workspace.scope('restore').replace(revision, localCandidate);
    if (result.status === 'saved') {setMenu(false); setAppGeneration(value => value + 1);}
  }
  async function retry(reapply = false) {
    if (!runtime) return;
    if (reapply && runtime.workspace.pending?.operation === 'restore_workspace') {
      const workspace = runtime.workspace;
      const candidate = {...workspace.snapshot!, ...workspace.pending!.payload};
      if (!window.confirm(`전체 복원 전에 최신 계획을 다시 확인해주세요.\n현재: ${workspaceSummary(workspace.snapshot!)}\n복원: ${workspaceSummary(candidate)}\n현재 계정의 모든 계획을 교체할까요?`)) return;
      const revision = workspace.snapshot!.revision;
      workspace.discardPending();
      const result = await workspace.restore(candidate, revision);
      if (result.status === 'saved') {setAppGeneration(value => value + 1); setNotice('계정 계획을 복원했습니다.');}
      return;
    }
    if (reapply && !window.confirm('최신 계획에서 작성 중이던 앱의 내용을 다시 적용할까요? 해당 앱에서 다른 기기로 저장한 변경은 교체됩니다.')) return;
    const result = reapply ? await runtime.workspace.reapply() : await runtime.workspace.retry();
    if (result.status === 'saved') {
      setNotice('계정에 저장했습니다.'); setAppGeneration(value => value + 1);
    }
  }
  if (!configured) return <GatePage title="계정 저장 연결 설정이 필요합니다."><p>배포 관리자에게 연결 설정을 요청해주세요.</p></GatePage>;
  if (authState === 'loading') return <GatePage title="계정의 계획을 불러오고 있어요." busy />;
  if (authState === 'error') return <GatePage title="로그인 상태를 확인하지 못했습니다."><button onClick={() => setStartup(value => value + 1)}>다시 시도</button></GatePage>;
  if (authState === 'signed-out' || !runtime) return <GatePage title="어디서든 같은 나의 계획">
    <p>Google 계정으로 로그인하고 자금 흐름, 투자 배분과 계좌 연결을 이어서 관리하세요.</p>
    <button onClick={() => void login()}>Google로 계속하기</button>
    <p>기존 브라우저 계획은 로그인 후 직접 선택해서 가져올 수 있어요.</p>
    {notice && <p role="alert">{notice}</p>}
  </GatePage>;
  const workspace = runtime.workspace;
  const status = workspace.status;
  if (status === 'expired') return <GatePage title="계획을 계속 보려면 다시 로그인해주세요."><button onClick={() => void login()}>Google로 다시 로그인</button><p>{workspace.cacheFailed ? '이 브라우저에 복구 기록을 보관하지 못했습니다. 로그인 전에 복구 파일을 다운로드해주세요.' : '아직 보내지 못한 입력은 이 계정의 복구 기록으로 보관합니다.'}</p><button onClick={downloadRecovery}>미전송 입력 복구 파일</button></GatePage>;
  if (!workspace.snapshot && (status === 'empty' || status === 'saving' || status === 'uncertain')) return <GatePage title="계정에서 사용할 계획을 선택해주세요." busy={status === 'saving'}>
    <p>{runtime.user.email}</p>
    {hasAccountRecovery(accountStorage(), accountCachePrefix(configured.config, runtime.user.id)) && <button onClick={downloadRecovery}>미전송 입력 복구 파일</button>}
    {localCandidate && <><p>{workspaceSummary(localCandidate)}</p><button onClick={() => downloadWorkspace(localCandidate)}>브라우저 계획 백업 다운로드</button><button disabled={status !== 'empty'} onClick={() => void initialize(true)}>이 브라우저 계획 가져오기</button></>}
    {local.status === 'invalid' && <><p role="alert">브라우저 데이터가 손상되어 가져올 수 없습니다. 원본을 보관한 뒤 복구해주세요.</p><button onClick={() => downloadText('isf-browser-original.json', local.raw)}>브라우저 원본 다운로드</button></>}
    <button disabled={status !== 'empty'} onClick={() => void initialize(false)}>새로 시작</button>
    {status === 'uncertain' && <><p role="alert">서버 저장 결과를 확인하지 못했습니다.</p><button onClick={() => void retry()}>저장 결과 다시 확인</button></>}
    <button onClick={() => void logout()}>로그아웃</button>
  </GatePage>;
  if (!workspace.snapshot || status === 'unsupported' || status === 'invalid') return <GatePage title={status === 'unsupported' ? '새 버전의 앱이 필요합니다.' : '계획을 불러오지 못했습니다.'}>
    <p>현재 데이터를 초기화하지 않았습니다. 연결을 확인하고 다시 시도해주세요.</p>
    {workspace.rawRemote !== null && <button onClick={() => downloadText('isf-server-original.json', JSON.stringify(workspace.rawRemote))}>서버 원본 다운로드</button>}
    {status === 'invalid' && <label>검증된 백업으로 전체 복원<input type="file" accept=".json,application/json" onChange={event => {
      const file = event.target.files?.[0];
      if (!file) return;
      void file.text().then(async text => {
        try {
          const candidate = importWorkspaceBackup(text);
          const raw = workspace.rawRemote as {revision?: unknown} | null;
          const revision = Number(raw?.revision);
          if (!Number.isSafeInteger(revision)) throw new Error('revision');
          if (!window.confirm(`${runtime.user.email ?? '현재 계정'}의 전체 계획을 ${workspaceSummary(candidate)} 백업으로 복원할까요?`)) return;
          const result = await workspace.restore(candidate, revision);
          if (result.status === 'saved') setAppGeneration(value => value + 1);
        } catch {setNotice('유효한 whole-workspace 백업과 서버 revision이 필요합니다.');}
      });
    }}/></label>}
    {notice && <p role="alert">{notice}</p>}
    <button onClick={() => void workspace.refresh()}>다시 불러오기</button><button onClick={() => void logout()}>로그아웃</button>
  </GatePage>;
  return <>
    <div className="account-toolbar">
      <button aria-expanded={menu} aria-controls="account-menu" onClick={() => setMenu(value => !value)}>내 계정</button>
      {status === 'offline' && <span role="status">오프라인 · 마지막 저장 계획</span>}
    </div>
    {menu && <section id="account-menu" className="account-panel" aria-label="계정 관리">
      <h2>{runtime.user.email ?? '내 계정'}</h2>
      <p>마지막 저장: {new Date(workspace.snapshot.updatedAt).toLocaleString('ko-KR')}</p>
      <button onClick={() => downloadWorkspace(workspace.snapshot!)}>현재 계정 계획 백업</button>
      {(workspace.pending || workspace.localEdits) && <p>현재 계정 백업에는 미전송 입력이 포함되지 않습니다. 필요한 입력은 별도 복구 파일로 보관해주세요.</p>}
      {localCandidate && <button disabled={status !== 'ready'} onClick={() => void restoreLocal()}>브라우저 계획으로 전체 교체</button>}
      {(workspace.pending || workspace.localEdits || hasAccountRecovery(accountStorage(), accountCachePrefix(configured.config, runtime.user.id))) && <button onClick={downloadRecovery}>미전송 입력 복구 파일</button>}
      <button onClick={() => void logout()}>이 브라우저에서 로그아웃</button>
      <button onClick={() => setMenu(false)}>닫기</button>
    </section>}
    {(status === 'uncertain' || status === 'conflict' || notice || workspace.cacheFailed) && <section className="account-panel account-feedback" role="status">
      <p>{status === 'conflict' ? '다른 기기에서 변경되었습니다. 작성 중 입력은 보존되어 있습니다.' : status === 'uncertain' ? '저장 결과를 확인하지 못했습니다. 아직 다른 기기에 반영되지 않았을 수 있습니다.' : notice || '계정 저장은 유지되지만 이 브라우저에 복구 기록을 보관하지 못했습니다.'}</p>
      {status === 'uncertain' && <button onClick={() => void retry()}>저장 결과 다시 확인</button>}
      {status === 'conflict' && workspace.pending && workspace.pending.operation !== 'save_account_map' && <button onClick={() => void retry(true)}>최신 상태에서 다시 적용</button>}
      <button disabled={status === 'saving'} onClick={() => {
        if ((workspace.pending || workspace.localEdits) && !window.confirm('작성 중 입력을 버리고 최신 저장 계획을 볼까요?')) return;
        for (const key of Object.keys(workspace.recoveryDrafts)) workspace.recordRecoveryDraft(key, null);
        workspace.discardPending(); setNotice(''); setAppGeneration(value => value + 1);
      }}>최신 저장 계획 보기</button>
    </section>}
    <fieldset key={`${runtime.user.id}:${runtime.generation}:${appGeneration}`}
      onInputCapture={() => workspace.markEdited()} onChangeCapture={() => workspace.markEdited()}
      disabled={status === 'offline'} className="account-product">
      <AccountDraftContext.Provider value={workspace}>{children(workspace)}</AccountDraftContext.Provider>
    </fieldset>
  </>;
}

function accountStorage(): Storage | undefined {
  try {return window.localStorage;} catch {return undefined;}
}
function GatePage({title, busy = false, children}: {title: string; busy?: boolean; children?: ReactNode}) {
  return <main className="account-gate" data-testid="account-workspace-gate" aria-busy={busy}>
    <section className="account-panel"><p className="account-brand">Individual Savings Flow</p><h1 tabIndex={-1}>{title}</h1>{children}</section>
  </main>;
}
