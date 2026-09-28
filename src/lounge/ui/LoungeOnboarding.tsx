import {useContext, useEffect, useRef, useState} from 'react';
import {ChartPie, ArrowDownToLine, Users} from 'lucide-react';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {useUncommittedInput} from '../../auth/useUncommittedInput';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogLayout, ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {NICKNAME_RULE, parseNickname, type LoungeProfile} from '../domain/profile';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';

export function LoungeOnboarding({repository, onRegistered}: {repository: LoungeRepository; onRegistered(profile: LoungeProfile): void}) {
  const account = useContext(AccountManagementContext);
  const [raw, setRaw] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<LoungeProfile | null>(null);
  const savedRef = useRef<LoungeProfile | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const locked = useRef(false);
  const composing = useRef(false);
  const nickname = parseNickname(raw);
  useUncommittedInput(raw.length > 0 && saved === null);
  useEffect(() => {heading.current?.focus();}, []);
  return <section className="lounge-welcome" aria-labelledby="lounge-welcome-title">
    <header><p className="lounge-eyebrow">PORTFOLIO LOUNGE</p><h1 id="lounge-welcome-title" ref={heading} tabIndex={-1}>서로의 투자 구성을 만나보세요</h1>
      <p className="lounge-muted">로그인한 사용자끼리 종목과 비율을 나누는 공간이에요.</p></header>
    <ul className="lounge-welcome__features">
      <li><ChartPie aria-hidden="true" /><div><strong>비율 둘러보기</strong><span>다른 사람의 종목·자산군 구성을 확인해요.</span></div></li>
      <li><ArrowDownToLine aria-hidden="true" /><div><strong>내 투자금으로 적용</strong><span>마음에 드는 비율을 내 포트폴리오 초안으로 가져와요.</span></div></li>
      <li><Users aria-hidden="true" /><div><strong>내 구성 공유</strong><span>정확한 금액은 제외하고, 자산 규모는 원할 때만 표시해요.</span></div></li>
    </ul>
    <form className="lounge-nickname-form" onSubmit={event => {event.preventDefault(); if (nickname && !composing.current) {setError(''); setConfirm(true);}}}>
      <label htmlFor="lounge-nickname">라운지에서 사용할 닉네임</label>
      <input id="lounge-nickname" value={raw} maxLength={60} autoComplete="off" autoCapitalize="none" spellCheck={false}
        aria-describedby="lounge-nickname-rule lounge-nickname-permanent" aria-invalid={raw.length > 0 && !nickname}
        onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}}
        onChange={event => {setRaw(event.target.value); setError('');}} />
      <p id="lounge-nickname-rule" className="lounge-muted">{NICKNAME_RULE} 기호만 쓰거나 다른 사람과 같은 이름은 사용할 수 없어요.</p>
      <p id="lounge-nickname-permanent" className="lounge-nickname-warning">설정 후 닉네임을 바꿀 수 있어요. 변경하면 48시간 동안 다시 바꿀 수 없어요.</p>
      <button ref={trigger} className="ui-button ui-button--primary" disabled={!nickname || account?.readOnly}>닉네임 확인</button>
    </form>
    {confirm && nickname ? <ResponsiveDialog open labelledBy="nickname-confirm-title" size="compact" returnFocusRef={trigger} busy={pending}
      onRequestClose={() => !locked.current} onClosed={() => {setConfirm(false); if (savedRef.current) onRegistered(savedRef.current);}}>
      {({requestClose}) => <ResponsiveDialogLayout title="이 닉네임으로 시작할까요?" titleId="nickname-confirm-title" layout="confirm" onClose={() => setConfirm(false)}
        status={error ? <p role="alert">{error}</p> : undefined}
        footer={<ResponsiveDialogActionRow><button className="ui-button ui-button--secondary" disabled={pending} onClick={() => requestClose('button')}>다시 입력</button>
          <button className="ui-button ui-button--primary" disabled={pending || account?.readOnly} onClick={async () => {
            if (locked.current) return;
            locked.current = true; setPending(true); setError('');
            try {const profile = await repository.registerNickname(nickname); savedRef.current = profile; setSaved(profile); locked.current = false; setPending(false); requestClose('button');}
            catch (error) {setError(loungeErrorMessage(error)); locked.current = false; setPending(false);}
          }}>{pending ? '설정 중…' : '이 닉네임으로 시작'}</button></ResponsiveDialogActionRow>}>
        <div className="lounge-nickname-confirm"><strong>{nickname}</strong><p>닉네임을 변경하면 48시간 동안 다시 바꿀 수 없어요.</p>
          <p className="lounge-muted">기존 공유 포트폴리오에도 이 닉네임이 적용돼요. 다른 기기에서 이미 설정했다면 먼저 등록한 닉네임을 사용해요.</p></div>
      </ResponsiveDialogLayout>}
    </ResponsiveDialog> : null}
  </section>;
}
