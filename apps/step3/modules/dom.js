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
    showCreatorBtn: document.getElementById('showCreatorBtn'),
    cancelCreatorBtn: document.getElementById('cancelCreatorBtn'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    pendingBar: document.getElementById('pendingBar'),
    pendingCancelBtn: document.getElementById('pendingCancelBtn'),
    pendingSaveBtn: document.getElementById('pendingSaveBtn'),
    modalChartDesc: document.getElementById('modalChartDesc'),
    portfolioConfirmModal: document.getElementById('portfolioConfirmModal'),
    confirmPortfolioName: document.getElementById('confirmPortfolioName'),
    confirmPortfolioPeriod: document.getElementById('confirmPortfolioPeriod'),
    confirmAssetCount: document.getElementById('confirmAssetCount'),
    confirmTotalAmount: document.getElementById('confirmTotalAmount'),
    confirmAssetList: document.getElementById('confirmAssetList'),
    confirmSaveBtn: document.getElementById('confirmSaveBtn'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmCloseModalBtn: document.getElementById('confirmCloseModalBtn'),
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
        <div class="portfolio-card" data-id="${p.id}" style="position: relative; display: flex; flex-direction: column; gap: 12px;">
          <button type="button" class="btn-delete-portfolio" data-id="${p.id}" style="position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: var(--muted); font-size: 1.2rem; cursor: pointer; transition: color 0.2s;" title="삭제">&times;</button>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--ink); max-width: calc(100% - 24px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${IsfUtils.escapeHtml(p.name)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span class="badge" style="background: rgba(234, 91, 42, 0.15); color: var(--primary, #ea5b2a); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">${p.period}</span>
            <span style="font-size: 0.85rem; color: var(--muted);">종목 ${p.assets ? p.assets.length : 0}개</span>
          </div>
          <div style="border-top: 1px solid var(--line); padding-top: 10px; margin-top: 4px; display: flex; justify-content: space-between; align-items: baseline;">
            <span style="font-size: 0.8rem; color: var(--muted);">총 투자 금액</span>
            <span style="font-size: 1.1rem; font-weight: 700; color: var(--ink);">${IsfUtils.convertToKoreanWon(p.totalAmount)}</span>
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
      const amountVal = Number(as.amount) || 0;
      const isAmountValid = amountVal === 0 || IsfCalculator.validateAssetAmount(amountVal);
      const borderBottomStyle = isAmountValid ? 'var(--line)' : 'var(--status-error, #ff5e5e)';

      return `
        <tr data-asset-id="${as.id}" style="border-bottom: 1px solid var(--line);">
          <td style="padding: 10px 4px; vertical-align: middle;">
            <input type="text" class="input-minimal asset-name-input" data-id="${as.id}" data-field="name" value="${IsfUtils.escapeHtml(as.name)}" placeholder="종목명" style="width: 100%; border: none; background: transparent; color: var(--ink); padding: 6px; border-bottom: 1px solid var(--line); transition: border-color 0.2s; font-size: 0.9rem;" />
          </td>
          <td style="padding: 10px 4px;">
            <div style="display: flex; align-items: center; gap: 4px; width: 100%;">
              <button type="button" class="btn-creator-adjust minus" data-id="${as.id}" style="width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;">-</button>
              <input type="number" class="input-minimal asset-amount-input no-won-hint" data-id="${as.id}" data-field="amount" value="${as.amount || ''}" placeholder="금액" style="width: 80px; border: none; background: transparent; color: var(--ink); padding: 6px; border-bottom: 1px solid ${borderBottomStyle}; font-size: 0.9rem; text-align: right;" />원
              <button type="button" class="btn-creator-adjust plus" data-id="${as.id}" style="width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;">+</button>
            </div>
          </td>
          <td style="padding: 10px 4px; text-align: right; font-weight: 600; color: var(--ink); vertical-align: middle;">
            <span class="asset-ratio-display" style="font-size: 0.95rem;">${as.ratio}%</span>
          </td>
          <td style="padding: 10px 4px; text-align: center; vertical-align: middle;">
            <button type="button" class="btn-remove-creator-asset" data-id="${as.id}" style="background: transparent; border: none; color: var(--status-error, #ff5e5e); font-size: 1.4rem; cursor: pointer; padding: 4px 10px; line-height: 1; transition: opacity 0.2s;">&times;</button>
          </td>
        </tr>
      `;
    }).join('');

    // 4. 합산 요약 정보 업데이트
    creatorSummary.textContent = `총 ${assets.length}개의 주식 | 총 매수 금액: ${IsfUtils.convertToKoreanWon(totalAmount)}`;

    // 5. 생성 버튼 상시 활성화 (클릭 시 미입력 항목 피드백을 지원하기 위함)
    if (savePortfolioBtn) {
      savePortfolioBtn.disabled = false;
      savePortfolioBtn.style.cursor = 'pointer';
      savePortfolioBtn.style.opacity = '1';
    }

    // Event binding
    this._bindCreatorEvents(handlers);
  },

  /**
   * 인풋 입력 시 innerHTML을 호출하지 않고, 금액/비중/요약/버튼 상태 등 스탯 정보만 부분 업데이트합니다.
   * @param {Object} activeCreator 
   */
  updateCreatorFormStats(activeCreator) {
    const { creatorAssetTable, creatorSummary, savePortfolioBtn } = this.nodes;
    if (!activeCreator) return;

    const assets = activeCreator.assets || [];
    const totalAmount = IsfCalculator.sumAmounts(assets);
    const assetsWithRatios = IsfCalculator.calculateRatios(assets, totalAmount);

    // 각 행의 비중 부분 갱신
    assetsWithRatios.forEach(as => {
      const row = creatorAssetTable.querySelector(`tr[data-asset-id="${as.id}"]`);
      if (row) {
        const amountInput = row.querySelector('.asset-amount-input');
        const ratioSpan = row.querySelector('.asset-ratio-display');

        const amountVal = Number(as.amount) || 0;
        const isAmountValid = amountVal === 0 || IsfCalculator.validateAssetAmount(amountVal);
        
        // input border style 업데이트
        if (amountInput) {
          amountInput.style.borderBottomColor = isAmountValid ? 'var(--line)' : 'var(--status-error, #ff5e5e)';
        }

        // 비중 업데이트
        if (ratioSpan) {
          ratioSpan.textContent = `${as.ratio}%`;
        }
      }
    });

    // 합산 요약 정보 업데이트
    if (creatorSummary) {
      creatorSummary.textContent = `총 ${assets.length}개의 주식 | 총 매수 금액: ${IsfUtils.convertToKoreanWon(totalAmount)}`;
    }

    // 생성 버튼 상시 활성화 (클릭 시 미입력 항목 피드백을 지원하기 위함)
    if (savePortfolioBtn) {
      savePortfolioBtn.disabled = false;
      savePortfolioBtn.style.cursor = 'pointer';
      savePortfolioBtn.style.opacity = '1';
    }
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

    // 금액 인풋 포커스에 따른 tr 스타일 트랜지션 바인딩 및 입력 핸들러
    creatorAssetTable.querySelectorAll('.asset-amount-input').forEach(input => {
      input.onfocus = () => {
        const tr = creatorAssetTable.querySelector(`tr[data-asset-id="${input.dataset.id}"]`);
        if (tr) tr.classList.add('editing');
      };
      input.onblur = () => {
        const tr = creatorAssetTable.querySelector(`tr[data-asset-id="${input.dataset.id}"]`);
        if (tr) tr.classList.remove('editing');
      };
      input.oninput = (e) => {
        const id = input.dataset.id;
        const val = parseFloat(e.target.value) || 0;
        handlers.onInputChange(id, 'amount', val);
      };
    });

    // 만들기 화면 - / + 증감 버튼 이벤트 바인딩 및 올림/내림 처리 공식 적용
    creatorAssetTable.querySelectorAll('.btn-creator-adjust').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const inputEl = creatorAssetTable.querySelector(`input[data-id="${id}"][data-field="amount"]`);
        if (inputEl) {
          let val = parseFloat(inputEl.value) || 0;
          if (btn.classList.contains('minus')) {
            if (val % 1000 !== 0) {
              val = Math.floor(val / 1000) * 1000;
            } else {
              val = Math.max(0, val - 1000);
            }
          } else if (btn.classList.contains('plus')) {
            if (val % 1000 !== 0) {
              val = Math.ceil(val / 1000) * 1000;
            } else {
              val = val + 1000;
            }
          }
          inputEl.value = val;
          handlers.onInputChange(id, 'amount', val);
        }
      };
    });
  },

  /**
   * 포트폴리오 요약 카드를 클릭할 시 나타나는 Glassmorphism 팝업/모달의 세부 내역을 렌더링하고 모달을 엽니다.
   * @param {Object} portfolio 원래 포트폴리오 데이터
   * @param {Object|null} pendingData 현재 편집 중인 임시 데이터 (없으면 portfolio 기반)
   * @param {Object} handlers { onModalDataChange }
   */
  showPortfolioDetailModal(portfolio, pendingData, handlers) {
    const { portfolioDetailModal, modalPortfolioName, modalPortfolioPeriod, modalPortfolioTotal, modalAssetList, modalChartBars } = this.nodes;

    if (!portfolioDetailModal || !portfolio) return;

    // 현재 표시 및 편집에 사용할 데이터를 결정합니다.
    const activeData = pendingData ? pendingData.currentData : {
      name: portfolio.name,
      period: portfolio.period,
      assets: (portfolio.assets || []).map(as => ({ id: as.id, name: as.name, ticker: as.ticker, amount: as.amount }))
    };

    const originalData = pendingData ? pendingData.originalData : {
      name: portfolio.name,
      period: portfolio.period,
      assets: (portfolio.assets || []).map(as => ({ id: as.id, name: as.name, ticker: as.ticker, amount: as.amount }))
    };

    modalPortfolioName.value = activeData.name;
    modalPortfolioPeriod.value = activeData.period;
    
    const assets = activeData.assets;

    // 1. 구성 종목 리스트 렌더링 (금액을 input으로, 좌우에 - / + 버튼과 하단에 한글 힌트)
    const renderModalAssetList = (currentAssets) => {
      const currentTotal = IsfCalculator.sumAmounts(currentAssets);
      const assetsWithRatios = IsfCalculator.calculateRatios(currentAssets, currentTotal);

      modalAssetList.innerHTML = assetsWithRatios.map(as => {
        const hintText = as.amount > 0 ? `(${IsfUtils.formatMoney(as.amount)})` : '';
        return `
          <tr data-asset-id="${as.id}" style="border-bottom: 1px solid var(--line); transition: all 0.25s ease;">
            <td style="padding: 10px 4px; color: var(--ink); vertical-align: middle; transition: all 0.25s ease;">${IsfUtils.escapeHtml(as.name)}</td>
            <td style="padding: 10px 4px; text-align: right;">
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <button type="button" class="btn-modal-adjust minus" data-id="${as.id}" style="width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;">-</button>
                  <input type="number" class="input-minimal modal-asset-amount-input no-won-hint" data-id="${as.id}" value="${as.amount}" style="width: 100px; text-align: right; border: none; background: transparent; border-bottom: 1px solid var(--line); color: var(--ink); padding: 4px;" />원
                  <button type="button" class="btn-modal-adjust plus" data-id="${as.id}" style="width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font-size: 0.9rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;">+</button>
                </div>
                <span class="modal-asset-won-hint" data-id="${as.id}" style="font-size: 0.75rem; color: var(--primary, #ea5b2a); font-weight: 500; text-align: right; min-height: 14px;">${hintText}</span>
              </div>
            </td>
            <td style="padding: 10px 4px; text-align: right; font-weight: 600; color: var(--primary, #ea5b2a); vertical-align: middle; transition: all 0.25s ease;">
              <span class="modal-asset-ratio-display" data-id="${as.id}">${as.ratio}%</span>
            </td>
          </tr>
        `;
      }).join('');
    };

    renderModalAssetList(assets);

    // 2. 실시간 모달 편집 반영 함수
    const updateModalStats = () => {
      const name = modalPortfolioName.value.trim();
      const period = modalPortfolioPeriod.value;
      
      const updatedAssets = assets.map(as => {
        const inputEl = modalAssetList.querySelector(`input[data-id="${as.id}"]`);
        const amount = inputEl ? (parseFloat(inputEl.value) || 0) : as.amount;
        return {
          ...as,
          amount
        };
      });

      const currentTotal = IsfCalculator.sumAmounts(updatedAssets);
      const assetsWithRatios = IsfCalculator.calculateRatios(updatedAssets, currentTotal);

      // 총액 업데이트
      modalPortfolioTotal.textContent = IsfUtils.convertToKoreanWon(currentTotal);

      // 개별 한글 금액 힌트 및 비중 업데이트
      assetsWithRatios.forEach(as => {
        const hintSpan = modalAssetList.querySelector(`.modal-asset-won-hint[data-id="${as.id}"]`);
        if (hintSpan) {
          hintSpan.textContent = as.amount > 0 ? `(${IsfUtils.formatMoney(as.amount)})` : '';
        }
        const ratioSpan = modalAssetList.querySelector(`.modal-asset-ratio-display[data-id="${as.id}"]`);
        if (ratioSpan) {
          ratioSpan.textContent = `${as.ratio}%`;
        }
      });

      // 1년 차트 업데이트 (누적 투입금 4단계: 1개월, 3개월, 6개월, 1년)
      // 매일 적립의 경우 영업일 기준(월 평균 20일, 연 240일)으로 대략적인 수치를 산출합니다.
      let factor = 12;
      if (period === '매일') factor = 240;
      else if (period === '매주') factor = 52;
      else if (period === '매달') factor = 12;

      const total1Year = currentTotal * factor;
      const steps = [
        { label: '1개월', val: currentTotal * (factor / 12 * 1) },
        { label: '3개월', val: currentTotal * (factor / 12 * 3) },
        { label: '6개월', val: currentTotal * (factor / 12 * 6) },
        { label: '1년', val: total1Year },
      ];
      const maxVal = total1Year;

      modalChartBars.innerHTML = steps.map(step => {
        const heightPercent = maxVal > 0 ? (step.val / maxVal) * 100 : 0;
        return `
          <div class="chart-bar-wrap" style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; height: 100%; justify-content: flex-end;">
            <span style="font-size: 0.7rem; color: var(--muted);">${IsfUtils.formatMoney(step.val)}</span>
            <div class="chart-bar-body" style="width: 20px; height: ${heightPercent}%; background: linear-gradient(180deg, var(--primary, #ea5b2a) 0%, rgba(234, 91, 42, 0.4) 100%); border-radius: 4px 4px 0 0; transition: height 0.5s ease-out; box-shadow: 0 0 10px rgba(234, 91, 42, 0.15);"></div>
            <span style="font-size: 0.75rem; color: var(--muted); margin-top: 4px;">${step.label}</span>
          </div>
        `;
      }).join('');

      // 누적 투입금 대략적인 영업일 기준 힌트 문구 동적 반영
      const { modalChartDesc } = this.nodes;
      if (modalChartDesc) {
        if (period === '매일') {
          modalChartDesc.textContent = '매일 적립은 월 평균 영업일(20일, 연 240일) 기준의 대략적인 수치입니다.';
        } else if (period === '매주') {
          modalChartDesc.textContent = '매주 적립은 연 52주 기준의 대략적인 수치입니다.';
        } else {
          modalChartDesc.textContent = '매달 적립은 연 12개월 기준의 대략적인 수치입니다.';
        }
      }

      // 변경사항 유무 체크
      let hasChanges = false;
      if (name !== originalData.name) hasChanges = true;
      if (period !== originalData.period) hasChanges = true;
      for (let i = 0; i < updatedAssets.length; i++) {
        const orig = originalData.assets.find(a => a.id === updatedAssets[i].id);
        if (orig && orig.amount !== updatedAssets[i].amount) {
          hasChanges = true;
        }
      }

      handlers.onModalDataChange({
        name,
        period,
        assets: updatedAssets,
        totalAmount: currentTotal
      }, hasChanges);
    };

    // 초기 차트 및 총액 렌더링
    updateModalStats();

    // 이벤트 리스너 바인딩
    modalPortfolioName.oninput = updateModalStats;
    modalPortfolioPeriod.onchange = updateModalStats;

    // 인풋 포커스에 따른 tr 스타일 트랜지션 바인딩
    const bindFocusTransitions = () => {
      modalAssetList.querySelectorAll('.modal-asset-amount-input').forEach(input => {
        input.onfocus = () => {
          const tr = modalAssetList.querySelector(`tr[data-asset-id="${input.dataset.id}"]`);
          if (tr) tr.classList.add('editing');
        };
        input.onblur = () => {
          const tr = modalAssetList.querySelector(`tr[data-asset-id="${input.dataset.id}"]`);
          if (tr) tr.classList.remove('editing');
        };
        input.oninput = () => {
          updateModalStats();
        };
      });
    };

    bindFocusTransitions();

    // - / + 증감 버튼 이벤트 바인딩 및 올림/내림 처리 공식 적용 (모달)
    modalAssetList.querySelectorAll('.btn-modal-adjust').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const inputEl = modalAssetList.querySelector(`input[data-id="${id}"]`);
        if (inputEl) {
          let val = parseFloat(inputEl.value) || 0;
          if (btn.classList.contains('minus')) {
            if (val % 1000 !== 0) {
              val = Math.floor(val / 1000) * 1000;
            } else {
              val = Math.max(0, val - 1000);
            }
          } else if (btn.classList.contains('plus')) {
            if (val % 1000 !== 0) {
              val = Math.ceil(val / 1000) * 1000;
            } else {
              val = val + 1000;
            }
          }
          inputEl.value = val;
          updateModalStats();
        }
      };
    });

    portfolioDetailModal.style.display = 'flex';
  },

  /**
   * 플로팅 펜딩 바를 노출하되, 3가지 애니메이션 중 무작위로 하나를 실행합니다.
   */
  showPendingBar() {
    const { pendingBar } = this.nodes;
    if (pendingBar && pendingBar.style.display === 'none') {
      // 기존 애니메이션 클래스 제거
      pendingBar.classList.remove('anim-slide-up', 'anim-fade-scale', 'anim-bounce-in');
      
      const anims = ['anim-slide-up', 'anim-fade-scale', 'anim-bounce-in'];
      const selected = anims[Math.floor(Math.random() * anims.length)];
      pendingBar.classList.add(selected);
      pendingBar.style.display = 'block';
    }
  },

  /**
   * 플로팅 펜딩 바를 숨깁니다.
   */
  hidePendingBar() {
    const { pendingBar } = this.nodes;
    if (pendingBar) {
      pendingBar.style.display = 'none';
      pendingBar.classList.remove('anim-slide-up', 'anim-fade-scale', 'anim-bounce-in');
    }
  },

  /**
   * 모달을 닫습니다.
   */
  closePortfolioDetailModal() {
    const { portfolioDetailModal } = this.nodes;
    if (portfolioDetailModal) {
      portfolioDetailModal.style.display = 'none';
    }
  },

  /**
   * 포트폴리오 크리에이터 폼을 화면에 표시합니다.
   */
  showPortfolioCreator() {
    const { portfolioCreator } = this.nodes;
    if (portfolioCreator) {
      portfolioCreator.style.display = 'block';
      portfolioCreator.scrollIntoView({ behavior: 'smooth' });
    }
  },

  /**
   * 포트폴리오 크리에이터 폼을 숨깁니다.
   */
  hidePortfolioCreator() {
    const { portfolioCreator } = this.nodes;
    if (portfolioCreator) {
      portfolioCreator.style.display = 'none';
    }
  },

  /**
   * 포트폴리오 생성을 최종 확인하는 모달을 엽니다.
   * @param {Object} portfolio 
   */
  showPortfolioConfirmModal(portfolio) {
    const {
      portfolioConfirmModal,
      confirmPortfolioName,
      confirmPortfolioPeriod,
      confirmAssetCount,
      confirmTotalAmount,
      confirmAssetList
    } = this.nodes;

    if (!portfolioConfirmModal || !portfolio) return;

    confirmPortfolioName.textContent = portfolio.name;
    confirmPortfolioPeriod.textContent = portfolio.period;
    confirmAssetCount.textContent = `${portfolio.assets ? portfolio.assets.length : 0}개`;
    confirmTotalAmount.textContent = IsfUtils.convertToKoreanWon(portfolio.totalAmount);

    confirmAssetList.innerHTML = (portfolio.assets || []).map(as => {
      return `
        <tr style="border-bottom: 1px solid var(--line);">
          <td style="padding: 8px 6px; color: var(--ink);">${IsfUtils.escapeHtml(as.name)}</td>
          <td style="padding: 8px 6px; text-align: right; color: var(--ink);">${IsfUtils.convertToKoreanWon(as.amount)}</td>
          <td style="padding: 8px 6px; text-align: right; font-weight: 600; color: var(--primary, #ea5b2a);">${as.ratio}%</td>
        </tr>
      `;
    }).join('');

    portfolioConfirmModal.style.display = 'flex';
  },

  /**
   * 최종 확인 모달을 닫습니다.
   */
  closePortfolioConfirmModal() {
    const { portfolioConfirmModal } = this.nodes;
    if (portfolioConfirmModal) {
      portfolioConfirmModal.style.display = 'none';
    }
  }
};
