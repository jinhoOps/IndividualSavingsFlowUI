import {useContext, useRef, useState, type RefObject} from 'react';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogLayout, ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {useUncommittedInput} from '../../auth/useUncommittedInput';
import {parsePublicationInput, type Publication, type SharedAllocation} from '../domain/publication';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';
import {AllocationSummary} from './AllocationSummary';

export function PublicationEditor({repository, existing, allocation, returnFocusRef, onClose, onSaved}: {
  repository: LoungeRepository; existing: Publication | null; allocation: SharedAllocation;
  returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(post: Publication): void;
}) {
  const account = useContext(AccountManagementContext);
  const [title, setTitle] = useState(existing?.title ?? '나의 포트폴리오');
  const [alias, setAlias] = useState(existing?.alias ?? '투자자');
  const [note, setNote] = useState(existing?.note ?? '');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const saved = useRef<Publication | null>(null);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const discardApproved = useRef(false);
  const dirty = title !== (existing?.title ?? '나의 포트폴리오') || alias !== (existing?.alias ?? '투자자') || note !== (existing?.note ?? '');
  useUncommittedInput(dirty && saved.current === null && !discardApproved.current);
  const input = parsePublicationInput({title, alias, note, allocation});
  return <ResponsiveDialog open labelledBy="lounge-editor-title" returnFocusRef={returnFocusRef} busy={pending}
    onRequestClose={() => {
      if (lock.current) return false;
      if (dirty && !saved.current && !discardApproved.current) {setDiscard(true); return false;}
      return true;
    }} onClosed={() => {if (saved.current) onSaved(saved.current); else onClose();}}>
    {({requestClose}) => <ResponsiveDialogLayout title={discard ? '작성 중인 내용을 닫을까요?' : existing ? '공유 포트폴리오 갱신' : '내 포트폴리오 공유'} titleId="lounge-editor-title" onClose={onClose}
      status={error ? <p role="alert">{error}</p> : undefined}
      footer={<ResponsiveDialogActionRow>{discard ? <>
        <button className="ui-button ui-button--secondary" onClick={() => setDiscard(false)}>계속 작성</button>
        <button className="ui-button ui-button--primary" onClick={() => {discardApproved.current = true; requestClose('button');}}>그만두기</button>
      </> : <button className="ui-button ui-button--primary" disabled={pending || !input || account?.readOnly} onClick={async () => {
        if (lock.current || !input) return;
        lock.current = true; setPending(true); setError('');
        try {saved.current = await repository.publish(input, existing?.version ?? null); lock.current = false; setPending(false); requestClose('button');}
        catch(error) {setError(loungeErrorMessage(error)); lock.current = false; setPending(false);}
      }}>{pending ? '공유 중…' : existing ? '이 내용으로 갱신' : '라운지에 공유'}</button>}</ResponsiveDialogActionRow>}>
      {discard ? <p>아직 공유하지 않은 입력 내용이 사라져요.</p> : <div className="lounge-editor">
        <p className="lounge-audience">로그인한 모든 사용자에게 공개 · 금액 제외</p>
        <label>제목<input value={title} maxLength={40} onChange={e => setTitle(e.target.value)} disabled={pending} /></label>
        <label>공유할 별명<input value={alias} maxLength={20} onChange={e => setAlias(e.target.value)} disabled={pending} autoComplete="off" /></label>
        <label>짧은 메모 <span className="lounge-muted">선택</span><input value={note} maxLength={160} onChange={e => setNote(e.target.value)} disabled={pending} /></label>
        <AllocationSummary allocation={allocation} />
        <p className="lounge-muted">현재 적용한 비율을 공유해요. 이후 내 계획을 수정해도 이 게시물은 자동으로 바뀌지 않아요. 직접 삭제할 때까지 라운지에 남아요.</p>
      </div>}
    </ResponsiveDialogLayout>}
  </ResponsiveDialog>;
}
