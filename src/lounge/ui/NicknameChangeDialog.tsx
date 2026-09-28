import {useCallback, useContext, useEffect, useRef, useState, type RefObject} from 'react';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {useUncommittedInput} from '../../auth/useUncommittedInput';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogActionRow, ResponsiveDialogLayout} from '../../components/common/ResponsiveDialogLayout';
import {NICKNAME_RULE, parseNickname, type NicknameSettings} from '../domain/profile';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';

export function NicknameChangeDialog({repository, returnFocusRef, onCurrentNickname, onChanged, onClose}: {
  repository: LoungeRepository; returnFocusRef: RefObject<HTMLButtonElement | null>;
  onCurrentNickname(nickname: string): void; onChanged(): void; onClose(): void;
}) {
  const account = useContext(AccountManagementContext);
  const [settings, setSettings] = useState<NicknameSettings | null>(null);
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [discard, setDiscard] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);
  const edited = useRef(false);
  const locked = useRef(false);
  const composing = useRef(false);
  const discardApproved = useRef(false);
  const generation = useRef(0);
  const deadline = useRef(0);
  const adopt = useCallback((profile: NicknameSettings) => {
    setSettings(profile);
    const milliseconds = profile.nextChangeAt === null ? 0 : Math.max(0, Date.parse(profile.nextChangeAt) - Date.parse(profile.serverNow));
    deadline.current = performance.now() + milliseconds; setRemaining(milliseconds);
    onCurrentNickname(profile.nickname);
    if (!edited.current) setRaw(profile.nickname);
  }, [onCurrentNickname]);
  const load = useCallback(async () => {
    if (locked.current) return;
    const token = ++generation.current; setLoading(true); setError('');
    try {const profile = await repository.getNicknameSettings(); if (token === generation.current) {adopt(profile); setLoadFailed(false);}}
    catch (error) {if (token === generation.current) {setLoadFailed(true); setError(loungeErrorMessage(error));}}
    finally {if (token === generation.current) setLoading(false);}
  }, [repository, adopt]);
  useEffect(() => {
    void load();
    const resume = () => {if (document.visibilityState === 'visible') void load();};
    document.addEventListener('visibilitychange', resume);
    const timer = window.setInterval(() => setRemaining(Math.max(0, deadline.current - performance.now())), 1000);
    return () => {generation.current++; clearInterval(timer); document.removeEventListener('visibilitychange', resume);};
  }, [load]);
  const nickname = parseNickname(raw);
  const dirty = edited.current && (nickname ?? raw) !== settings?.nickname;
  useUncommittedInput(dirty && !saved && !discardApproved.current);
  const canSave = settings && nickname && nickname !== settings.nickname && remaining === 0 && !loading && !loadFailed && !pending && !account?.readOnly;
  return <ResponsiveDialog open labelledBy="nickname-change-title" size="compact" returnFocusRef={returnFocusRef} busy={pending}
    onRequestClose={() => {
      if (locked.current) return false;
      if (dirty && !savedRef.current && !discardApproved.current) {setDiscard(true); return false;}
      return true;
    }} onClosed={() => {if (savedRef.current) onChanged(); onClose();}}>
    {({requestClose}) => <ResponsiveDialogLayout title={discard ? '입력 중인 닉네임을 버릴까요?' : '닉네임 변경'} titleId="nickname-change-title" layout={discard ? 'confirm' : 'edit'} onClose={onClose}
      status={error && !discard ? <p role="alert">{error}</p> : undefined}
      footer={<ResponsiveDialogActionRow>{discard ? <>
        <button className="ui-button ui-button--secondary" onClick={() => setDiscard(false)}>계속 입력</button>
        <button className="ui-button ui-button--primary" onClick={() => {discardApproved.current = true; requestClose('button');}}>입력 버리기</button>
      </> : <>
        <button className="ui-button ui-button--secondary" disabled={pending} onClick={() => requestClose('button')}>닫기</button>
        <button className="ui-button ui-button--primary" type="submit" form="nickname-change-form" disabled={!canSave}>{pending ? '변경 중…' : '변경하기'}</button>
      </>}</ResponsiveDialogActionRow>}>
      {discard ? <p>아직 저장하지 않은 새 닉네임이 사라져요.</p> : <form id="nickname-change-form" className="lounge-nickname-edit" onSubmit={async event => {
        event.preventDefault(); if (!canSave || locked.current || composing.current) return;
        generation.current++; locked.current = true; setPending(true); setError('');
        try {
          const result = await repository.changeNickname(nickname, settings.version);
          adopt(result.profile);
          if (result.status === 'saved' || result.status === 'unchanged') {
            savedRef.current = true; setSaved(true); locked.current = false; setPending(false); requestClose('button');
          } else {
            setError(result.status === 'cooldown' ? '변경 후 48시간이 지나야 다시 바꿀 수 있어요.' : '다른 곳에서 닉네임이 바뀌었어요. 현재 이름과 변경 가능 시간을 확인해 주세요.');
            locked.current = false; setPending(false);
          }
        } catch (error) {setError(loungeErrorMessage(error)); locked.current = false; setPending(false);}
      }}>
        {loading ? <p role="status">변경 가능 여부를 확인하고 있어요…</p> : null}
        {loadFailed ? <button className="ui-button ui-button--secondary" type="button" onClick={() => void load()}>다시 불러오기</button> : null}
        {settings ? <>
          <p className="lounge-publisher"><span className="lounge-muted">현재 닉네임</span><strong>{settings.nickname}</strong></p>
          <label htmlFor="lounge-new-nickname">새 닉네임</label>
          <input id="lounge-new-nickname" value={raw} maxLength={60} autoComplete="off" autoCapitalize="none" spellCheck={false}
            disabled={pending || loading || loadFailed || remaining > 0} aria-invalid={dirty && !nickname} aria-describedby="nickname-change-rule nickname-change-policy"
            onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}}
            onChange={event => {edited.current = true; setRaw(event.target.value); setError('');}} />
          <p className="lounge-muted" id="nickname-change-rule">{NICKNAME_RULE} 영문 대소문자가 달라도 같은 이름은 사용할 수 없어요.</p>
          {remaining > 0 && settings.nextChangeAt ? <p role="status" className="lounge-nickname-warning">다음 변경 가능: <time dateTime={settings.nextChangeAt}>{new Date(settings.nextChangeAt).toLocaleString('ko-KR', {year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></p> : null}
        </> : null}
        <p id="nickname-change-policy" className="lounge-nickname-warning">변경하면 48시간 동안 다시 바꿀 수 없어요.</p>
        <p className="lounge-muted">기존 공유 포트폴리오에도 새 닉네임이 적용돼요.</p>
      </form>}
    </ResponsiveDialogLayout>}
  </ResponsiveDialog>;
}
