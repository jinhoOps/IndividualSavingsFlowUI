import { Button, ButtonLink } from '../../components/common/Button';
import {useContext, useEffect, useRef, useState} from 'react';
import {AccountManagementContext} from '../../auth/AccountManagementContext';
import {ResponsiveDialog} from '../../components/common/ResponsiveDialog';
import {ResponsiveDialogActionRow, ResponsiveDialogLayout} from '../../components/common/ResponsiveDialogLayout';
import {materializeAllocation} from '../../portfolio/domain/allocation';
import type {PortfolioDraft} from '../../portfolio/domain/model';
import {appPath} from '../../journey/routes';
import {draftFromPublication, type Publication} from '../domain/publication';
import {loungeErrorMessage, type LoungeRepository} from '../infrastructure/loungeRepository';
import {AllocationSummary} from './AllocationSummary';

export function PublicationImport({id, repository, investmentWon, onImport, onClose}: {
  id: string; repository: LoungeRepository; investmentWon: number; onImport(draft: PortfolioDraft): void; onClose(): void;
}) {
  const [post, setPost] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const imported = useRef<PortfolioDraft | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const account = useContext(AccountManagementContext);
  useEffect(() => {
    let active=true; setLoading(true); setError(''); setPost(null);
    void repository.get(id).then(value => {if (active) {setPost(value); if (!value) setError('삭제되었거나 더 이상 볼 수 없는 포트폴리오예요.');}},
      error => {if (active) setError(loungeErrorMessage(error));}).finally(() => {if (active) setLoading(false);});
    return () => {active=false;};
  }, [id, repository, attempt]);
  const draft = post && investmentWon > 0 ? draftFromPublication(post.allocation, investmentWon, Date.now()) : null;
  const amounts = draft ? materializeAllocation(draft, investmentWon) : null;
  return <ResponsiveDialog open labelledBy="lounge-import-title" returnFocusRef={trigger} onRequestClose={() => true}
    onClosed={() => {if (imported.current) onImport(imported.current); onClose();}}>
    {({requestClose}) => <ResponsiveDialogLayout title="내 투자금으로 미리보기" titleId="lounge-import-title" onClose={onClose} layout="preview"
      status={error ? <p role="alert">{error}</p> : undefined}
      footer={<ResponsiveDialogActionRow>{draft && !loading && !error ? <Button variant="primary" disabled={account?.readOnly} onClick={() => {imported.current=draft; requestClose('button');}}>초안으로 가져오기</Button>
        : investmentWon<=0 ? <ButtonLink variant="primary" href={`${appPath('main')}?edit=investment`}>Main에서 투자금 설정</ButtonLink>
        : error ? <Button variant="secondary" onClick={() => setAttempt(n=>n+1)}>다시 불러오기</Button> : null}</ResponsiveDialogActionRow>}>
      {loading ? <p role="status">공유한 비율을 불러오고 있어요…</p> : null}
      {post ? <div className="lounge-detail"><div><h3>{post.title}</h3><p className="lounge-muted">{post.alias}</p></div><AllocationSummary allocation={post.allocation} />
        {amounts ? <section className="lounge-import-amounts"><h3>내 월 투자금 {investmentWon.toLocaleString('ko-KR')}원 기준</h3><dl>
          {amounts.items.map(item => <div key={item.id}><dt>{item.name}</dt><dd>{item.amountWon.toLocaleString('ko-KR')}원</dd></div>)}
          {amounts.cashAmountWon>0 ? <div><dt>현금</dt><dd>{amounts.cashAmountWon.toLocaleString('ko-KR')}원</dd></div> : null}
        </dl></section> : null}
        <p className="lounge-muted">현재 편집 초안을 이 비율로 대체해요. 가져온 뒤 조정하고 적용할 수 있어요. 적용 전까지 기존 투자 배분은 유지돼요.</p>
      </div> : null}
    </ResponsiveDialogLayout>}
  </ResponsiveDialog>;
}
