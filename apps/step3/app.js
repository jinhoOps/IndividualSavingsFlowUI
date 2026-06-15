/**
 * Step 3: Portfolio Manager - Main Application
 * 3-Tier Architecture: State / Helpers / UI
 */

import { IsfUtils } from '../../shared/core/utils.js';
import { IsfState } from './modules/state.js';
import { IsfDom } from './modules/dom.js';
import { IsfCalculator } from './modules/calculator.js';

const App = {
  // 1. State
  state: null,

  // 2. Core Helpers
  async init() {
    console.log('[Step3] Initializing Accumulative Portfolio Manager...');
    this.state = new IsfState();
    
    try {
      await this.state.loadFromStorage();
      this.bindEvents();
      this.render();
      console.log('[Step3] Initialization Complete.');
    } catch (error) {
      console.error('[Step3] Initialization Failed:', error);
    }
  },

  bindEvents() {
    // 1. 포트폴리오명 입력 변경 핸들러
    IsfDom.nodes.portfolioName.oninput = (e) => {
      this.state.updateActiveCreator('name', e.target.value);
      this.renderCreatorOnly(); // 폼만 부분 렌더링하여 반응 속도 극대화
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

    // 6. 포트폴리오 저장 버튼 핸들러
    IsfDom.nodes.savePortfolioBtn.onclick = () => {
      const activeCreator = this.state.data.activeCreator;
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

      if (IsfCalculator.validatePortfolio(newPortfolio)) {
        this.state.addPortfolio(newPortfolio);
        this.render(); // 전체 화면 재렌더링
      }
    };
  },

  // 3. UI Logic & Render Pipeline
  render() {
    // 포트폴리오 목록 렌더링
    IsfDom.renderPortfolioList(this.state.data.portfolios, {
      onRemovePortfolio: (id) => {
        if (confirm('이 포트폴리오를 삭제하시겠습니까?')) {
          this.state.removePortfolio(id);
          this.render();
        }
      },
      onClickCard: (id) => {
        const portfolio = this.state.data.portfolios.find(p => p.id === id);
        if (portfolio) {
          IsfDom.showPortfolioDetailModal(portfolio);
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
        this.state.updateCreatorAsset(assetId, field, value);
        // 값이 바뀔 때마다 실시간 합산 정보와 비중 %를 갱신
        this.renderCreatorOnly();
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
