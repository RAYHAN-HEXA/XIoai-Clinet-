import type { Fen, LocalizedText } from './types';

/**
 * Financing Matcher — QUALITATIVE ranking only.
 *
 * RULES (never invents rates, amounts, approval odds or availability):
 *  - gap < 14 days            → extend supplier terms rises to the top
 *  - payout delayed           → settlement/receivables advance rises to the top
 *  - seasonal stock-up        → merchant working-capital loan rises to the top
 *  - planned expansion        → bank SME loan rises to the top
 * Scores are rule-based points for deterministic ordering; they are NOT
 * approval probabilities and are not displayed as such.
 */

export type FinancingReason = 'SHORT_GAP' | 'PAYOUT_DELAYED' | 'SEASONAL_STOCKUP' | 'PLANNED_EXPANSION';
export type FinancingCost = 'LOWEST' | 'LOW' | 'MEDIUM';
export type FinancingSpeed = 'FAST' | 'DAYS' | 'SLOW';

export interface FinancingOption {
  id: 'EXTEND_SUPPLIER_TERMS' | 'SETTLEMENT_ADVANCE' | 'MERCHANT_WORKING_CAPITAL' | 'BANK_SME_LOAN';
  name: LocalizedText;
  cost: FinancingCost;
  costLabel: LocalizedText;
  speed: FinancingSpeed;
  speedLabel: LocalizedText;
  bestWhen: LocalizedText;
  documents: LocalizedText[];
  risks: LocalizedText[];
  matchedOn: LocalizedText;
  /** rule-based ordering score — NOT a probability, NOT shown to users as one */
  score: number;
  rank: number;
}

export interface FinancingInput {
  /** projected cash gap in fen; null when no shortage is projected */
  gapAmountFen: Fen | null;
  /** day index of the first projected shortage; null when none */
  firstShortageDay: number | null;
  reason: FinancingReason;
}

export interface FinancingResult {
  ranked: FinancingOption[];
  gapSummary: LocalizedText;
  disclaimer: LocalizedText;
}

const BASE: Omit<FinancingOption, 'rank' | 'score' | 'matchedOn'>[] = [
  {
    id: 'EXTEND_SUPPLIER_TERMS',
    name: { en: 'Extend supplier payment terms', zh: '延长供应商账期' },
    cost: 'LOWEST',
    costLabel: { en: 'Usually lowest cost (often free if the relationship is good)', zh: '通常成本最低（合作关系良好时常常免费）' },
    speed: 'DAYS',
    speedLabel: { en: 'Days — needs supplier consent', zh: '数天——需要供应商同意' },
    bestWhen: {
      en: 'Short gaps (< 2 weeks) and suppliers you pay on time today',
      zh: '短期缺口（不到两周）且您目前按时付款的供应商'
    },
    documents: [
      { en: 'Payment history with the supplier', zh: '与供应商的付款记录' },
      { en: 'A simple revised payment schedule', zh: '一份修订后的付款时间表' }
    ],
    risks: [
      { en: 'Uses goodwill — a delayed payment today can hurt future pricing', zh: '消耗信任——今天的延期可能影响今后的价格' },
      { en: 'Suppliers may decline; have plan B ready', zh: '供应商可能拒绝；请准备好备选方案' }
    ]
  },
  {
    id: 'SETTLEMENT_ADVANCE',
    name: { en: 'Settlement / receivables advance', zh: '回款提前 / 应收账款融资' },
    cost: 'LOW',
    costLabel: { en: 'Low–medium: a fee per advance', zh: '低到中等：按提前笔数收费' },
    speed: 'FAST',
    speedLabel: { en: 'Fast — often 1–3 days via the platform', zh: '快——通常 1–3 天，经平台办理' },
    bestWhen: {
      en: 'Money is already earned but stuck in D15–D28 platform settlements',
      zh: '钱已经赚到，但卡在 D15–D28 的平台账期里'
    },
    documents: [
      { en: 'Platform settlement statements', zh: '平台结算单' },
      { en: 'Store health / rating standing', zh: '店铺健康分/评分状况' }
    ],
    risks: [
      { en: 'Advance fees reduce margin on the advanced orders', zh: '提前回款的手续费会摊薄相关订单利润' },
      { en: 'Advancing too often becomes a habit that hides the real margin problem', zh: '频繁提前回款会变成习惯，掩盖真实的利润问题' }
    ]
  },
  {
    id: 'MERCHANT_WORKING_CAPITAL',
    name: { en: 'Merchant working-capital loan', zh: '商家经营周转贷' },
    cost: 'MEDIUM',
    costLabel: { en: 'Medium: interest or factor rate applies', zh: '中等：会产生利息或费率' },
    speed: 'DAYS',
    speedLabel: { en: 'Days — platform-based underwriting', zh: '数天——平台侧审核' },
    bestWhen: {
      en: 'Seasonal stock-ups before big campaigns, repayable from the campaign',
      zh: '大促前的季节性备货，可用大促回款偿还'
    },
    documents: [
      { en: '6–12 months of store sales data', zh: '6–12 个月的店铺销售数据' },
      { en: 'Business licence', zh: '营业执照' }
    ],
    risks: [
      { en: 'Real interest cost — compare before accepting', zh: '有真实的利息成本——接受前先比较' },
      { en: 'Borrowing for stock that does not sell deepens the hole', zh: '为滞销库存借钱会加深窟窿' }
    ]
  },
  {
    id: 'BANK_SME_LOAN',
    name: { en: 'Bank SME loan', zh: '银行小微企业贷款' },
    cost: 'LOW',
    costLabel: { en: 'Low rate but process-heavy', zh: '利率较低但流程繁琐' },
    speed: 'SLOW',
    speedLabel: { en: 'Slow — weeks of documentation and review', zh: '慢——需数周的材料与审核' },
    bestWhen: {
      en: 'Planned expansion with time to prepare, not emergency gaps',
      zh: '有时间准备的扩张计划，而非紧急缺口'
    },
    documents: [
      { en: 'Audited or bookkept financials', zh: '审计或记账报表' },
      { en: 'Tax records, business licence, collateral info', zh: '纳税记录、营业执照、抵押信息' }
    ],
    risks: [
      { en: 'Personal guarantees are commonly required', zh: '通常需要个人担保' },
      { en: 'Too slow for a cash emergency', zh: '对现金危机来说太慢' }
    ]
  }
];

export function financingMatcher(input: FinancingInput): FinancingResult {
  const scored = BASE.map((opt) => {
    let score = 50;
    let matchedOn: LocalizedText;

    switch (opt.id) {
      case 'EXTEND_SUPPLIER_TERMS':
        matchedOn = { en: 'Cheapest lever when the gap is short', zh: '缺口较短时是最省钱的手段' };
        if (input.firstShortageDay !== null && input.firstShortageDay < 14) score += 30;
        if (input.reason === 'SHORT_GAP') score += 15;
        if (input.firstShortageDay !== null && input.firstShortageDay <= 7) score -= 10; // too slow for emergencies
        break;
      case 'SETTLEMENT_ADVANCE':
        matchedOn = { en: 'Fastest when the money is already earned', zh: '钱已赚到时是最快的选择' };
        if (input.reason === 'PAYOUT_DELAYED') score += 35; // must beat the generic <14d supplier-terms bonus
        if (input.firstShortageDay !== null && input.firstShortageDay <= 7) score += 10;
        break;
      case 'MERCHANT_WORKING_CAPITAL':
        matchedOn = { en: 'Sized for stock-up cycles', zh: '适合备货周期' };
        if (input.reason === 'SEASONAL_STOCKUP') score += 30;
        if (input.reason === 'PLANNED_EXPANSION') score += 10;
        break;
      case 'BANK_SME_LOAN':
        matchedOn = { en: 'Best for planned, larger needs', zh: '适合有计划的更大需求' };
        if (input.reason === 'PLANNED_EXPANSION') score += 25;
        if (input.firstShortageDay !== null && input.firstShortageDay <= 7) score -= 15; // far too slow
        break;
    }
    return { ...opt, score, matchedOn };
  });

  const order = ['EXTEND_SUPPLIER_TERMS', 'SETTLEMENT_ADVANCE', 'MERCHANT_WORKING_CAPITAL', 'BANK_SME_LOAN'] as const;
  scored.sort(
    (a, b) => b.score - a.score || order.indexOf(a.id) - order.indexOf(b.id)
  );
  const ranked = scored.map((opt, i) => ({ ...opt, rank: i + 1 }));

  const gapSummary: LocalizedText =
    input.gapAmountFen === null || input.firstShortageDay === null
      ? { en: 'No cash shortage is currently projected in the 30-day window.', zh: '当前 30 天预测内未出现现金短缺。' }
      : {
          en: `Projected gap around day ${input.firstShortageDay}. Ranking below is qualitative guidance based on your situation — verify every term with the lender.`,
          zh: `预计第 ${input.firstShortageDay} 天前后出现缺口。以下排序是基于您情况的定性参考——所有条款请与资金方核实。`
        };

  return {
    ranked,
    gapSummary,
    disclaimer: {
      en: 'Qualitative ranking only — no interest rates, amounts or approvals are implied. Live rates come from partner lenders, and the owner approves every application.',
      zh: '仅为定性排序——不包含任何利率、额度或审批承诺。实际利率由合作资金方提供，每笔申请均由企业主审批。'
    }
  };
}
