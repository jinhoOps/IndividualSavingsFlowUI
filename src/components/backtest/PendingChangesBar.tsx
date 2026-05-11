import React from 'react';

interface PendingChangesBarProps {
  isVisible: boolean;
  onApply: () => void;
  onCancel: () => void;
}

export const PendingChangesBar: React.FC<PendingChangesBarProps> = ({ isVisible, onApply, onCancel }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-ink/90 backdrop-blur-md text-canvas px-6 py-4 rounded-pill shadow-float flex items-center gap-lg border border-line/20">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-primary">변경사항 감지됨</span>
          <span className="text-[11px] opacity-70">새로운 설정을 적용하시겠습니까?</span>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold hover:bg-white/10 rounded-pill transition-colors"
          >
            취소
          </button>
          <button
            onClick={onApply}
            className="px-6 py-2 text-xs font-black bg-primary text-white rounded-pill hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            시뮬레이션 적용
          </button>
        </div>
      </div>
    </div>
  );
};
