/**
 * Step 3: Portfolio Manager - Main Application
 * 3-Tier Architecture: State / Helpers / UI
 */

import { IsfUtils } from '../../shared/core/utils.js';
import { IsfState } from './modules/state.js';
import { IsfDom } from './modules/dom.js';
import { IsfCalculator } from './modules/calculator.js';
import { Step1Connector } from './modules/step1-connector.js';

const App = {
  // 1. State
  state: null,
  pendingModalChanges: null,
  pendingNewPortfolio: null,

  // 2. Core Helpers
  async init() {
    console.log('[Step3] Initializing Accumulative Portfolio Manager...');
    this.state = new IsfState();
    
    try {
      await this.state.loadFromStorage();
      await this.syncAccountFlowHandoff();
      this.bindEvents();
      this.render();
      console.log('[Step3] Initialization Complete.');
    } catch (error) {
      console.error('[Step3] Initialization Failed:', error);
    }
  },

  async syncAccountFlowHandoff() {
    const handoff = await Step1Connector.fetchAccountFlowHandoff();
    this.state.setAccountFlowHandoff(handoff);
  },

  bindEvents() {
    // 0. 만들기 보이기/숨기기 토글 핸들러 (과거 잔여 파손 데이터를 완전히 차단하기 위해 리셋 추가)
    IsfDom.nodes.showCreatorBtn.onclick = () => {
      this.state.resetActiveCreator();
      this.renderCreatorOnly();
      IsfDom.showPortfolioCreator();
    };

    IsfDom.nodes.cancelCreatorBtn.onclick = () => {
      this.state.resetActiveCreator();
      IsfDom.hidePortfolioCreator();
    };

    // 1. 포트폴리오명 입력 변경 핸들러
    IsfDom.nodes.portfolioName.oninput = (e) => {
      this.state.updateActiveCreator('name', e.target.value);
      IsfDom.updateCreatorFormStats(this.state.data.activeCreator);
    };

    // 2. 주기 세그먼트 버튼 클릭 핸들러
    IsfDom.nodes.periodSegment.querySelectorAll('.segment-btn').forEach(btn => {
      btn.onclick = () => {
        const period = btn.dataset.period;
        this.state.updateActiveCreator('period', period);
        this.renderCreatorOnly();
      };
    });

    // 3. 종목 추가 버튼 핸들러
    IsfDom.nodes.addAssetBtn.onclick = () => {
      this.state.addAssetToCreator();
      this.renderCreatorOnly();
    };

    // 4. 모달 닫기 버튼 핸들러
    IsfDom.nodes.closeModalBtn.onclick = () => {
      IsfDom.closePortfolioDetailModal();
    };

    // 5. 모달 바깥 영역 클릭 시 닫기
    IsfDom.nodes.portfolioDetailModal.onclick = (e) => {
      if (e.target === IsfDom.nodes.portfolioDetailModal) {
        IsfDom.closePortfolioDetailModal();
      }
    };

    // 6. 포트폴리오 생성 버튼 핸들러 (클릭 시 미입력/오입력 항목을 짚어주고 생성 중단)
    IsfDom.nodes.savePortfolioBtn.onclick = () => {
      const activeCreator = this.state.data.activeCreator;

      // 1. 포트폴리오 이름 검증
      if (!activeCreator.name || !activeCreator.name.trim()) {
        alert('포트폴리오 이름을 입력해 주세요.');
        return;
      }

      // 2. 종목 개수 검증 (최소 2개)
      const assets = activeCreator.assets || [];
      if (assets.length < 2) {
        alert('최소 2개 이상의 종목을 설정해 주세요.');
        return;
      }

      // 3. 개별 종목 이름 및 금액 검증
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        const displayIndex = i + 1;
        if (!asset.name || !asset.name.trim()) {
          alert(`${displayIndex}번째 종목의 이름을 입력해 주세요.`);
          return;
        }
        
        const amountVal = Number(asset.amount) || 0;
        if (amountVal < 1000) {
          alert(`'${asset.name || displayIndex + '번째 종목'}'의 금액은 최소 1,000원 이상이어야 합니다.`);
          return;
        }
        if (amountVal % 1000 !== 0) {
          alert(`'${asset.name}' 종목의 금액은 1,000원 단위로 입력해 주세요.`);
          return;
        }
      }

      const totalAmount = IsfCalculator.sumAmounts(activeCreator.assets);
      const assetsWithRatios = IsfCalculator.calculateRatios(activeCreator.assets, totalAmount);
      
      const newPortfolio = {
        id: `port-${Date.now()}`,
        name: activeCreator.name.trim(),
        period: activeCreator.period,
        totalAmount,
        assets: assetsWithRatios,
        createdAt: new Date().toISOString()
      };

      this.pendingNewPortfolio = newPortfolio;
      IsfDom.showPortfolioConfirmModal(newPortfolio);
    };

    // 7. 플로팅 펜딩 바 취소 버튼 핸들러 (취소 누르면 펜딩 바만 숨기고 이어서 편집하도록 처리)
    IsfDom.nodes.pendingCancelBtn.onclick = () => {
      IsfDom.hidePendingBar();
    };

    // 8. 플로팅 펜딩 바 저장 버튼 핸들러
    IsfDom.nodes.pendingSaveBtn.onclick = () => {
      if (!this.pendingModalChanges) return;

      const { portfolioId, currentData } = this.pendingModalChanges;
      const name = currentData.name.trim();

      if (!name) {
        alert('포트폴리오 이름을 입력해 주세요.');
        return;
      }

      const totalAmount = IsfCalculator.sumAmounts(currentData.assets);
      const assetsWithRatios = IsfCalculator.calculateRatios(currentData.assets, totalAmount);

      const dummyPortfolio = {
        name,
        period: currentData.period,
        assets: assetsWithRatios
      };

      if (!IsfCalculator.validatePortfolio(dummyPortfolio)) {
        alert('입력 정보가 유효하지 않습니다. (최소 2개 종목, 종목당 금액은 최소 1,000원 이상이고 1,000원 단위여야 합니다.)');
        return;
      }

      const targetPort = this.state.data.portfolios.find(p => p.id === portfolioId);
      if (targetPort) {
        targetPort.name = name;
        targetPort.period = currentData.period;
        targetPort.totalAmount = totalAmount;
        targetPort.assets = assetsWithRatios;
        
        this.state.saveToStorage();
        IsfDom.closePortfolioDetailModal();
        IsfDom.hidePendingBar();
        this.pendingModalChanges = null;
        this.render();
      }
    };

    // 9. 최종 확인 모달 관련 핸들러
    IsfDom.nodes.confirmCloseModalBtn.onclick = () => {
      IsfDom.closePortfolioConfirmModal();
      this.pendingNewPortfolio = null;
    };

    IsfDom.nodes.confirmCancelBtn.onclick = () => {
      IsfDom.closePortfolioConfirmModal();
      this.pendingNewPortfolio = null;
    };

    IsfDom.nodes.confirmSaveBtn.onclick = () => {
      if (this.pendingNewPortfolio) {
        this.state.addPortfolio(this.pendingNewPortfolio);
        IsfDom.closePortfolioConfirmModal();
        IsfDom.hidePortfolioCreator();
        this.pendingNewPortfolio = null;
        this.render(); // 전체 화면 재렌더링
      }
    };

    IsfDom.nodes.portfolioConfirmModal.onclick = (e) => {
      if (e.target === IsfDom.nodes.portfolioConfirmModal) {
        IsfDom.closePortfolioConfirmModal();
        this.pendingNewPortfolio = null;
      }
    };
  },

  // 3. UI Logic & Render Pipeline
  render() {
    IsfDom.renderAccountFlowHandoffStatus(this.state.data.accountFlowHandoff);

    // 포트폴리오 목록 렌더링
    IsfDom.renderPortfolioList(this.state.data.portfolios, {
      onRemovePortfolio: (id) => {
        if (confirm('이 포트폴리오를 삭제하시겠습니까?')) {
          if (this.pendingModalChanges && this.pendingModalChanges.portfolioId === id) {
            this.pendingModalChanges = null;
            IsfDom.hidePendingBar();
          }
          this.state.removePortfolio(id);
          this.render();
        }
      },
      onClickCard: (id) => {
        const portfolio = this.state.data.portfolios.find(p => p.id === id);
        if (portfolio) {
          const currentPending = (this.pendingModalChanges && this.pendingModalChanges.portfolioId === id) ? this.pendingModalChanges : null;

          IsfDom.showPortfolioDetailModal(portfolio, currentPending, {
            onModalDataChange: (updatedData, hasChanges) => {
              if (!this.pendingModalChanges || this.pendingModalChanges.portfolioId !== id) {
                this.pendingModalChanges = {
                  portfolioId: id,
                  originalData: {
                    name: portfolio.name,
                    period: portfolio.period,
                    assets: (portfolio.assets || []).map(as => ({ id: as.id, name: as.name, ticker: as.ticker, amount: as.amount }))
                  },
                  currentData: updatedData
                };
              } else {
                this.pendingModalChanges.currentData = updatedData;
              }

              if (hasChanges) {
                IsfDom.showPendingBar();
              } else {
                IsfDom.hidePendingBar();
              }
            }
          });
        }
      }
    });

    // 포트폴리오 크리에이터 폼 렌더링
    this.renderCreatorOnly();
  },

  /**
   * 전체 화면을 갱신하지 않고, 크리에이터 입력 폼 영역만 반응형으로 부분 렌더링합니다.
   */
  renderCreatorOnly() {
    IsfDom.renderCreatorForm(this.state.data.activeCreator, {
      onInputChange: (assetId, field, value) => {
        const finalValue = field === 'amount' ? (Number(value) || 0) : value;
        this.state.updateCreatorAsset(assetId, field, finalValue);
        // 값이 바뀔 때마다 실시간 합산 정보와 비중 %를 부분 갱신하여 인풋 포커스 보존
        IsfDom.updateCreatorFormStats(this.state.data.activeCreator);
      },
      onRemoveAsset: (assetId) => {
        this.state.removeAssetFromCreator(assetId);
        this.renderCreatorOnly();
      }
    });
  }
};

// Start App
document.addEventListener('DOMContentLoaded', () => App.init());
