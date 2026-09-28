import { Button } from '../../components/common/Button';
import {useContext, useRef, useState, type RefObject} from 'react';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogLayout, ResponsiveDialogActionRow} from '../../components/common/ResponsiveDialogLayout';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {useUncommittedInput} from '../../auth/useUncommittedInput';
import {parsePublicationInput, type Publication, type SharedAllocation} from '../domain/publication';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';
import {ASSET_BANDS, isAssetBand, type AssetBand} from '../domain/assetBand';
import {AssetBandBadge} from './AssetBandBadge';
import {AllocationSummary} from './AllocationSummary';

export function PublicationEditor({repository, nickname, existing, allocation, suggestedAssetBand, returnFocusRef, onClose, onSaved}: {
  repository: LoungeRepository; nickname: string; existing: Publication | null; allocation: SharedAllocation; suggestedAssetBand: AssetBand | null;
  returnFocusRef: RefObject<HTMLElement | null>; onClose(): void; onSaved(post: Publication): void;
}) {
  const account = useContext(AccountManagementContext);
  const [title, setTitle] = useState(existing?.title ?? '나의 포트폴리오');
  const [note, setNote] = useState(existing?.note ?? '');
  const [showAssetBand, setShowAssetBand] = useState(Boolean(existing?.assetBand));
  const [selectedAssetBand, setSelectedAssetBand] = useState<AssetBand | null>(existing?.assetBand ?? suggestedAssetBand);
  const assetBand = showAssetBand ? selectedAssetBand : null;
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const saved = useRef<Publication | null>(null);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const discardApproved = useRef(false);
  const dirty = title !== (existing?.title ?? '나의 포트폴리오') || note !== (existing?.note ?? '') || showAssetBand !== Boolean(existing?.assetBand) || assetBand !== (existing?.assetBand ?? null);
  useUncommittedInput(dirty && saved.current === null && !discardApproved.current);
  const input = showAssetBand && !assetBand ? null : parsePublicationInput({title, note, allocation, assetBand});
  return <ResponsiveDialog open labelledBy="lounge-editor-title" returnFocusRef={returnFocusRef} busy={pending}
    onRequestClose={() => {
      if (lock.current) return false;
      if (dirty && !saved.current && !discardApproved.current) {setDiscard(true); return false;}
      return true;
    }} onClosed={() => {if (saved.current) onSaved(saved.current); else onClose();}}>
    {({requestClose}) => <ResponsiveDialogLayout title={discard ? '작성 중인 내용을 닫을까요?' : existing ? '공유 포트폴리오 갱신' : '내 포트폴리오 공유'} titleId="lounge-editor-title" onClose={onClose}
      status={error ? <p role="alert">{error}</p> : undefined}
      footer={<ResponsiveDialogActionRow>{discard ? <>
        <Button variant="secondary" onClick={() => setDiscard(false)}>계속 작성</Button>
        <Button variant="primary" onClick={() => {discardApproved.current = true; requestClose('button');}}>그만두기</Button>
      </> : <Button variant="primary" disabled={pending || !input || account?.readOnly} onClick={async () => {
        if (lock.current || !input) return;
        lock.current = true; setPending(true); setError('');
        try {saved.current = await repository.publish(input, existing?.version ?? null); lock.current = false; setPending(false); requestClose('button');}
        catch(error) {setError(loungeErrorMessage(error)); lock.current = false; setPending(false);}
      }}>{pending ? '공유 중…' : existing ? '이 내용으로 갱신' : '커뮤니티에 공유'}</Button>}</ResponsiveDialogActionRow>}>
      {discard ? <p>아직 공유하지 않은 입력 내용이 사라져요.</p> : <div className="lounge-editor">
        <p className="lounge-audience">로그인한 모든 사용자에게 공개 · 정확한 금액 제외</p>
        <label>제목<input value={title} maxLength={40} onChange={e => setTitle(e.target.value)} disabled={pending} /></label>
        <p className="lounge-publisher"><span className="lounge-muted">공유 닉네임</span><strong>{nickname}</strong></p>
        <label>짧은 메모 <span className="lounge-muted">선택</span><input value={note} maxLength={160} onChange={e => setNote(e.target.value)} disabled={pending} /></label>
        <section className="lounge-asset-option" aria-label="자산 규모 공유 설정">
          <label className="lounge-asset-toggle"><span>자산 규모 표시 <span className="lounge-muted">선택</span></span>
            <input type="checkbox" role="switch" aria-label="자산 규모 표시" checked={showAssetBand} disabled={pending} onChange={e => setShowAssetBand(e.target.checked)} />
          </label>
          {showAssetBand ? <>
            <label>공유할 자산 규모<select value={selectedAssetBand ?? ''} disabled={pending} onChange={e => setSelectedAssetBand(isAssetBand(e.target.value) ? e.target.value : null)}>
              <option value="" disabled>구간 선택</option>
              {ASSET_BANDS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select></label>
            <p className="lounge-muted">{suggestedAssetBand ? '시작 자산 기준으로 제안해요. 직접 바꿀 수 있어요.' : '공유할 구간을 직접 선택해 주세요.'}</p>
            <AssetBandBadge band={assetBand} />
          </> : null}
        </section>
        <AllocationSummary allocation={allocation} />
        <p className="lounge-muted">현재 적용한 비율을 공유해요. 이후 내 계획을 수정해도 이 게시물은 자동으로 바뀌지 않아요. 직접 삭제할 때까지 커뮤니티에 남아요.</p>
      </div>}
    </ResponsiveDialogLayout>}
  </ResponsiveDialog>;
}
