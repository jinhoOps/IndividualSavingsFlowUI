/**
 * Step 3: DOM Rendering & Event Binding for Accumulative Portfolio Manager
 */

import { IsfUtils } from '../../../shared/core/utils.js';
import { IsfCalculator } from './calculator.js';

export const IsfDom = {
  // Selectors
  nodes: {
    portfolioList: document.getElementById('portfolioList'),
    portfolioCreator: document.getElementById('portfolioCreator'),
    portfolioName: document.getElementById('portfolioName'),
    periodSegment: document.getElementById('periodSegment'),
    addAssetBtn: document.getElementById('addAssetBtn'),
    creatorAssetTable: document.getElementById('creatorAssetTable'),
    creatorSummary: document.getElementById('creatorSummary'),
    creatorSummaryWonHint: document.getElementById('creatorSummaryWonHint'),
    savePortfolioBtn: document.getElementById('savePortfolioBtn'),
    portfolioDetailModal: document.getElementById('portfolioDetailModal'),
    modalPortfolioName: document.getElementById('modalPortfolioName'),
    modalPortfolioPeriod: document.getElementById('modalPortfolioPeriod'),
    modalPortfolioTotal: document.getElementById('modalPortfolioTotal'),
    modalAssetList: document.getElementById('modalAssetList'),
    modalChartBars: document.getElementById('modalChartBars'),
    closeModalBtn: document.getElementById('closeModalBtn'),
  },

  /**
   * 에디토리얼 요약 카드 리스트를 렌더링합니다.
   * @param {Array} portfolios 
   * @param {Object} handlers { onRemovePortfolio, onClickCard }
   */
  renderPortfolioList(portfolios, handlers) {
    const { portfolioList } = this.nodes;
    if (!portfolioList) return;

    if (!portfolios || portfolios.length === 0) {
      portfolioList.innerHTML = '<p class="hint">등록된 포트폴리오가 없습니다. 아래에서 첫 포트폴리오를 생성해 보세요.</p>';
      return;
    }

    portfolioList.innerHTML = portfolios.map(p => {
      return `
        <div class="portfolio-card" data-id="${p.id}" style="position: relative; background: rgba(30, 30, 30, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 20px; cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); backdrop-filter: blur(10px); display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <button type="button" class="btn-delete-portfolio" data-id="${p.id}" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: #888; font-size: 1.2rem; cursor: pointer; transition: color 0.2s;" title="삭제">&times;</button>
          <div style="font-size: 1.15rem; font-weight: 700; color: #fff; max-width: calc(100% - 24px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${IsfUtils.escapeHtml(p.name)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span class="badge" style="background: rgba(234, 91, 42, 0.15); color: var(--primary, #ea5b2a); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${p.period}</span>
            <span style="font-size: 0.85rem; color: #aaa;">종목 ${p.assets ? p.assets.length : 0}개</span>
          </div>
          <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; margin-top: 4px; display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 0.8rem; color: #888;">총 투자 금액</span>
            <span style="font-size: 1.1rem; font-weight: 700; color: #fff;">${IsfUtils.formatMoney(p.totalAmount)}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--primary, #ea5b2a); text-align: right; margin-top: -4px; font-weight: 500;">
            ${IsfUtils.convertToKoreanWon(p.totalAmount)}
          </div>
        </div>
      `;
    }).join('');

    // Bind events
    portfolioList.querySelectorAll('.portfolio-card').forEach(card => {
      card.onclick = (e) => {
        // 만약 삭제 버튼을 누른 경우 패스
        if (e.target.classList.contains('btn-delete-portfolio')) return;
        const id = card.dataset.id;
        handlers.onClickCard(id);
      };
    });

    portfolioList.querySelectorAll('.btn-delete-portfolio').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        handlers.onRemovePortfolio(id);
      };
    });
  },

  /**
   * 포트폴리오 크리에이터 폼을 동적으로 렌더링하고 유효성을 판별하여 UI를 갱신합니다.
   * @param {Object} activeCreator 
   * @param {Object} handlers { onInputChange, onRemoveAsset, onSave }
   */
  renderCreatorForm(activeCreator, handlers) {
    const { portfolioName, periodSegment, creatorAssetTable, creatorSummary, creatorSummaryWonHint, savePortfolioBtn } = this.nodes;

    if (!activeCreator) return;

    // 1. 포트폴리오 이름 바인딩 (수정 시 커서 유지를 위해 값이 다를 때만 대입)
    if (portfolioName.value !== activeCreator.name) {
      portfolioName.value = activeCreator.name || '';
    }

    // 2. 주기 세그먼트 버튼 바인딩
    periodSegment.querySelectorAll('.segment-btn').forEach(btn => {
      if (btn.dataset.period === activeCreator.period) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 3. 자산 리스트 렌더링
    const assets = activeCreator.assets || [];
    const totalAmount = IsfCalculator.sumAmounts(assets);
    const assetsWithRatios = IsfCalculator.calculateRatios(assets, totalAmount);

    creatorAssetTable.innerHTML = assetsWithRatios.map(as => {
      return `
        <tr data-asset-id="${as.id}" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 10px 4px;">
            <input type="text" class="input-minimal asset-name-input" data-id="${as.id}" data-field="name" value="${IsfUtils.escapeHtml(as.name)}" placeholder="종목명" style="width: 100%; border: none; background: transparent; color: #fff; padding: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.15); transition: border-color 0.2s; font-size: 0.9rem;" />
          </td>
          <td style="padding: 10px 4px;">
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
              <input type="number" class="input-minimal asset-amount-input" data-id="${as.id}" data-field="amount" value="${as.amount || ''}" placeholder="금액 입력" style="width: 100%; border: none; background: transparent; color: #fff; padding: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.15); font-size: 0.9rem;" />
              <span class="realtime-won-hint" style="font-size: 0.75rem; color: var(--primary, #ea5b2a); min-height: 14px; margin-top: 2px;">
                ${as.amount > 0 ? `실시간 변환: ${IsfUtils.convertToKoreanWon(as.amount)}` : ''}
              </span>
            </div>
          </td>
          <td style="padding: 10px 4px; text-align: right; font-weight: 600; color: #ccc;">
            <span class="asset-ratio-display" style="font-size: 0.95rem;">${as.ratio}%</span>
          </td>
          <td style="padding: 10px 4px; text-align: center;">
            <button type="button" class="btn-remove-creator-asset" data-id="${as.id}" style="background: transparent; border: none; color: #ff5e5e; font-size: 1.4rem; cursor: pointer; padding: 4px 10px; line-height: 1; transition: opacity 0.2s;">&times;</button>
          </td>
        </tr>
      `;
    }).join('');

    // 4. 합산 요약 정보 업데이트
    creatorSummary.textContent = `총 ${assets.length}개의 주식 | 총 매수 금액: ${totalAmount.toLocaleString('ko-KR')}원`;
    creatorSummaryWonHint.textContent = `실시간 변환: ${IsfUtils.convertToKoreanWon(totalAmount)}`;

    // 5. 생성 버튼 활성화 여부 제어
    const isValid = IsfCalculator.validatePortfolio(activeCreator);
    if (isValid) {
      savePortfolioBtn.disabled = false;
      savePortfolioBtn.style.cursor = 'pointer';
      savePortfolioBtn.style.opacity = '1';
      savePortfolioBtn.style.background = 'var(--primary, #ea5b2a)';
    } else {
      savePortfolioBtn.disabled = true;
      savePortfolioBtn.style.cursor = 'not-allowed';
      savePortfolioBtn.style.opacity = '0.5';
      savePortfolioBtn.style.background = 'rgba(255, 255, 255, 0.08)';
    }

    // Event binding
    this._bindCreatorEvents(handlers);
  },

  _bindCreatorEvents(handlers) {
    const { creatorAssetTable } = this.nodes;

    // 종목 제거
    creatorAssetTable.querySelectorAll('.btn-remove-creator-asset').forEach(btn => {
      btn.onclick = () => {
        handlers.onRemoveAsset(btn.dataset.id);
      };
    });

    // 인풋 데이터 바인딩
    creatorAssetTable.querySelectorAll('.asset-name-input').forEach(input => {
      input.oninput = (e) => {
        const id = input.dataset.id;
        handlers.onInputChange(id, 'name', e.target.value);
      };
    });

    creatorAssetTable.querySelectorAll('.asset-amount-input').forEach(input => {
      input.oninput = (e) => {
        const id = input.dataset.id;
        const val = parseFloat(e.target.value) || 0;
        handlers.onInputChange(id, 'amount', val);
      };
    });
  },

  /**
   * 포트폴리오 요약 카드를 클릭할 시 나타나는 Glassmorphism 팝업/모달의 세부 내역을 렌더링하고 모달을 엽니다.
   * @param {Object} portfolio 
   */
  showPortfolioDetailModal(portfolio) {
    const { portfolioDetailModal, modalPortfolioName, modalPortfolioPeriod, modalPortfolioTotal, modalAssetList, modalChartBars } = this.nodes;

    if (!portfolioDetailModal || !portfolio) return;

    modalPortfolioName.textContent = portfolio.name;
    modalPortfolioPeriod.textContent = portfolio.period;
    
    const totalWon = portfolio.totalAmount;
    modalPortfolioTotal.textContent = `${IsfUtils.formatMoney(totalWon)} (${IsfUtils.convertToKoreanWon(totalWon)})`;

    // 1. 구성 종목 리스트 렌더링
    const assets = portfolio.assets || [];
    modalAssetList.innerHTML = assets.map(as => {
      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 10px 4px;">${IsfUtils.escapeHtml(as.name)}</td>
          <td style="padding: 10px 4px; text-align: right;">${IsfUtils.formatMoney(as.amount)}</td>
          <td style="padding: 10px 4px; text-align: right; font-weight: 600; color: var(--primary, #ea5b2a);">${as.ratio}%</td>
        </tr>
      `;
    }).join('');

    // 2. 1년 누적 투자 추이 예시 막대 렌더링
    // 적립 납입 주기별 1년 환산 가중치
    let factor = 12; // default: 매달
    if (portfolio.period === '매일') {
      factor = 365;
    } else if (portfolio.period === '매주') {
      factor = 52;
    } else if (portfolio.period === '매달') {
      factor = 12;
    }

    const total1Year = totalWon * factor;

    // 5단계 지점 시뮬레이션: 1개월 후, 3개월 후, 6개월 후, 9개월 후, 12개월 후(1년 후)
    // 횟수로 환산
    const steps = [
      { label: '1개월', val: totalWon * (factor / 12 * 1) },
      { label: '3개월', val: totalWon * (factor / 12 * 3) },
      { label: '6개월', val: totalWon * (factor / 12 * 6) },
      { label: '9개월', val: totalWon * (factor / 12 * 9) },
      { label: '1년', val: total1Year },
    ];

    const maxVal = total1Year;

    modalChartBars.innerHTML = steps.map(step => {
      const heightPercent = maxVal > 0 ? (step.val / maxVal) * 100 : 0;
      return `
        <div class="chart-bar-wrap" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; height: 100%; justify-content: flex-end;">
          <span style="font-size: 0.7rem; color: #ccc;">${IsfUtils.formatMoney(step.val)}</span>
          <div class="chart-bar-body" style="width: 20px; height: ${heightPercent}%; background: linear-gradient(180deg, var(--primary, #ea5b2a) 0%, rgba(234, 91, 42, 0.4) 100%); border-radius: 4px 4px 0 0; transition: height 0.5s ease-out; box-shadow: 0 0 10px rgba(234, 91, 42, 0.3);"></div>
          <span style="font-size: 0.75rem; color: #888; margin-top: 4px;">${step.label}</span>
        </div>
      `;
    }).join('');

    portfolioDetailModal.style.display = 'flex';
  },

  /**
   * 모달을 닫습니다.
   */
  closePortfolioDetailModal() {
    const { portfolioDetailModal } = this.nodes;
    if (portfolioDetailModal) {
      portfolioDetailModal.style.display = 'none';
    }
  }
};
