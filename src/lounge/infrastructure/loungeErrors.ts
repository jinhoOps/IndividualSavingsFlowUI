export class LoungeError extends Error {
  constructor(public readonly code: 'conflict' | 'invalid' | 'unavailable' | 'account' | 'full' | 'nickname-taken' | 'profile-required' | 'rate-limited' | 'comment-limit' | 'missing' | 'forbidden' | 'mention-changed') {super(code);}
}
export function loungeErrorMessage(error: unknown): string {
  if (error instanceof LoungeError) {
    if (error.code === 'mention-changed') return '멘션할 사용자의 이름이 바뀌었거나 더 이상 찾을 수 없어요. 다시 선택해 주세요.';
    if (error.code === 'rate-limited') return '잠시 후 다시 시도해 주세요.';
    if (error.code === 'comment-limit') return '이 게시물에 더 이상 댓글을 남길 수 없어요.';
    if (error.code === 'missing') return '삭제되었거나 더 이상 볼 수 없는 게시물이에요.';
    if (error.code === 'forbidden') return '내가 작성한 댓글만 삭제할 수 있어요.';
    if (error.code === 'nickname-taken') return '이미 사용 중인 닉네임이에요. 다른 이름을 입력해 주세요.';
    if (error.code === 'profile-required') return '커뮤니티에서 닉네임을 먼저 설정해 주세요.';
    if (error.code === 'conflict') return '다른 곳에서 공유 내용이 바뀌었어요. 닫고 다시 열어 주세요.';
    if (error.code === 'invalid') return '공유할 이름과 비율을 확인해 주세요.';
    if (error.code === 'account') return '로그인 상태가 바뀌었어요. 새로고침해 주세요.';
    if (error.code === 'full') return '지금은 새 내용을 저장할 수 없어요. 잠시 후 다시 시도해 주세요.';
  }
  return '불러오거나 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
}
