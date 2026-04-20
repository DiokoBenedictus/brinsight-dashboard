/**
 * riskDummyData.js — BRInsight Risk Engine Dummy Data
 * ─────────────────────────────────────────────────────
 * Provides realistic, banking-context dummy data for all 7 units.
 * Data reflects typical branch-level conditions in Indonesia (BRI context).
 *
 * Structure matches riskEngine.evaluate(unitData, config) input format:
 *  {
 *    unit     : string,
 *    period   : string,       // YYYY-MM reference month
 *    credit   : { npl_mikro, npl_sme, ... },
 *    liquidity: { ldr, casa_ratio, cost_of_fund },
 *    operational: { ... },
 *    legal    : { ... },
 *    strategic: { ... },
 *    reputational: { ... },
 *    compliance: { ... }
 *  }
 *
 * Usage:
 *   const config = await window.riskEngine.loadConfig();
 *   const results = window.riskEngine.evaluateAll(window.RISK_DUMMY_DATA, config);
 */

window.RISK_DUMMY_DATA = [

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIT 1: KC Veteran — Flagship branch, mixed portfolio, moderate risk
  // Profile: High-volume branch, strong CASA, occasional legal exposure
  // ═══════════════════════════════════════════════════════════════════════════
  {
    unit:   'KC Veteran',
    period: '2026-03',

    credit: {
      npl_mikro:            2.85,   // % — slightly above green zone
      npl_sme:              4.10,   // % — moderate SME stress
      npl_konsumer:         1.95,   // % — BRIguna/KPR healthy
      npl_menengah:         3.20,   // % — acceptable
      lar_mikro:            7.50,   // % — within acceptable range
      lar_sme:              11.20,  // % — moderate
      lar_konsumer:         5.80,   // % — ok
      lar_menengah:         9.40,   // % — moderate
      dpk_mikro_growth:     6.80,   // % YoY — healthy
      dpk_sme_growth:       4.50,   // % YoY — below target
      dpk_konsumer_growth:  8.20,   // % YoY — good
      dpk_menengah_growth:  11.00,  // % YoY — strong
      cost_of_credit:       1.10    // % — within acceptable
    },

    liquidity: {
      ldr:           84.50,   // % — ideal corridor
      casa_ratio:    62.30,   // % — above 60% target
      cost_of_fund:   3.10    // % — moderate
    },

    operational: {
      span_of_control_mantri:    185,    // nasabah/mantri — acceptable
      os_worker_ratio:            28.0,  // % — ok
      spv_fulfillment:            92.0,  // % — good
      mantri_fulfillment:         88.0,  // % — good
      turnover:                    7.5,  // % — moderate
      human_error_loss:           12.0,  // Juta Rp
      fraud_internal_loss:         0.0,  // Juta Rp — none
      fraud_internal_freq_growth: -5.0,  // % YoY — improving
      fraud_external_loss:        18.0,  // Juta Rp — minor ATM skimming
      fraud_external_freq_growth: 10.0,  // % YoY — slight uptick
      max_fraud_3m_ma:            22.0,  // Juta Rp — low
      disaster_loss_natural:       0.0,  // Juta Rp
      disaster_loss_non_natural:   5.0,  // Juta Rp — minor power outage
      external_event_growth:      15.0,  // % YoY
      pct_affected_assets:         2.1,  // %
      atm_reliability:            98.2,  // %
      crm_reliability:            97.8,  // %
      edc_reliability:            96.5   // %
    },

    legal: {
      lawsuit_nominal:      150.0,  // Juta Rp — one pending case
      potential_loss:        60.0,  // Juta Rp
      actual_loss:            0.0,  // Juta Rp — not yet resolved
      lawsuit_frequency:      1,    // kasus/tahun
      lost_cases_frequency:   0     // kasus/tahun
    },

    strategic: {
      profit_growth:          9.50,   // % YoY — above 8% threshold
      fbi_growth:            12.00,   // % YoY — good
      avg_loan_growth:        7.80,   // % YoY — building momentum
      avg_dpk_growth:         6.50,   // % YoY — at target
      tabungan_growth:        8.10,   // % YoY
      giro_growth:            7.40,   // % YoY
      recovery_rate:         42.00,   // % — moderate
      edc_qris_volume_growth: 22.00,  // % YoY — strong digital push
      brimo_users_growth:    25.00,   // % YoY — good
      qlola_users_growth:    18.00,   // % YoY
      merchant_dpk:        3500.00,   // Juta Rp — solid merchant base
      market_share:          20.50,   // % — strong local share
      daily_avg_loan_growth:  0.75,   // % MoM
      daily_avg_dana_growth:  0.60,   // % MoM
      daily_avg_casa_growth:  0.55    // % MoM
    },

    reputational: {
      negative_news_ratio:       8.0,   // % — minor press coverage
      complaint_rate:            2.5,   // per 1000 nasabah
      unresolved_complaints_pct: 4.0    // %
    },

    compliance: {
      financial_penalty_nominal:    0.0,  // Juta Rp — clean
      financial_penalty_frequency:  0,
      slik_violations:              1,    // 1 kasus minor
      tax_violations:               0,
      lbu_violations:               1,    // 1 kasus late reporting
      other_violations:             2
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIT 2: KCP Pertamina — SME-heavy branch, elevated credit risk
  // Profile: High NPL, concentrated SME, operational stress, no legal issues
  // ═══════════════════════════════════════════════════════════════════════════
  {
    unit:   'KCP Pertamina',
    period: '2026-03',

    credit: {
      npl_mikro:            5.40,   // % — above threshold (score 4)
      npl_sme:              7.80,   // % — HIGH (score 4)
      npl_konsumer:         3.10,   // % — moderate
      npl_menengah:         6.50,   // % — high
      lar_mikro:           13.00,   // % — elevated (score 3)
      lar_sme:             18.50,   // % — critical (score 4)
      lar_konsumer:         9.20,   // % — moderate
      lar_menengah:        16.00,   // % — high
      dpk_mikro_growth:    -2.10,   // % YoY — contraction (score 4)
      dpk_sme_growth:       1.50,   // % YoY — barely positive (score 3)
      dpk_konsumer_growth:  3.00,   // % YoY — low
      dpk_menengah_growth:  5.00,   // % YoY — moderate
      cost_of_credit:       2.20    // % — above acceptable (score 4)
    },

    liquidity: {
      ldr:           93.80,   // % — above 92% OJK threshold (score 4)
      casa_ratio:    49.50,   // % — below 50% (score 4)
      cost_of_fund:   4.30    // % — high (score 4)
    },

    operational: {
      span_of_control_mantri:    265,    // nasabah/mantri — high (score 4)
      os_worker_ratio:            42.0,  // % — high dependency
      spv_fulfillment:            72.0,  // % — below standard (score 4)
      mantri_fulfillment:         65.0,  // % — critical (score 4)
      turnover:                   18.5,  // % — high (score 4)
      human_error_loss:           55.0,  // Juta Rp — concerning
      fraud_internal_loss:        35.0,  // Juta Rp — detected internal fraud
      fraud_internal_freq_growth: 45.0,  // % YoY — deteriorating (score 4)
      fraud_external_loss:        85.0,  // Juta Rp — significant
      fraud_external_freq_growth: 55.0,  // % YoY — crisis (score 5)
      max_fraud_3m_ma:           160.0,  // Juta Rp — high (score 4)
      disaster_loss_natural:       0.0,  // Juta Rp
      disaster_loss_non_natural:  30.0,  // Juta Rp — system incident
      external_event_growth:      80.0,  // % YoY — many external events
      pct_affected_assets:         7.5,  // % — high exposure (score 4)
      atm_reliability:            93.5,  // % — unreliable (score 4)
      crm_reliability:            94.0,  // % — below standard
      edc_reliability:            90.5   // % — below standard (score 4)
    },

    legal: {
      lawsuit_nominal:       0.0,  // Juta Rp — no active lawsuits
      potential_loss:        0.0,
      actual_loss:           0.0,
      lawsuit_frequency:     0,
      lost_cases_frequency:  0
    },

    strategic: {
      profit_growth:         -3.50,   // % YoY — declining (score 4)
      fbi_growth:             2.00,   // % YoY — weak
      avg_loan_growth:        1.50,   // % YoY — stagnant (score 3)
      avg_dpk_growth:        -1.80,   // % YoY — shrinking (score 4)
      tabungan_growth:       -0.50,   // % YoY — declining (score 4)
      giro_growth:           -2.00,   // % YoY — declining (score 4)
      recovery_rate:         22.00,   // % — poor (score 4)
      edc_qris_volume_growth: 8.00,   // % YoY — below target (score 3)
      brimo_users_growth:    12.00,   // % YoY — moderate
      qlola_users_growth:     4.00,   // % YoY — weak (score 4)
      merchant_dpk:         400.00,   // Juta Rp — weak (score 4)
      market_share:           9.50,   // % — losing ground (score 4)
      daily_avg_loan_growth: -0.20,   // % MoM — declining
      daily_avg_dana_growth: -0.40,   // % MoM — declining
      daily_avg_casa_growth: -0.35    // % MoM — declining
    },

    reputational: {
      negative_news_ratio:       28.0,  // % — notable negative coverage (score 3)
      complaint_rate:             7.5,  // per 1000 — high (score 4)
      unresolved_complaints_pct: 14.0   // % — significant backlog (score 4)
    },

    compliance: {
      financial_penalty_nominal:   120.0,  // Juta Rp — sanctioned (score 3)
      financial_penalty_frequency:   2,    // kali — twice this year (score 3)
      slik_violations:               6,    // kasus — high (score 4)
      tax_violations:                2,    // kasus — moderate (score 3)
      lbu_violations:                4,    // kasus — repeated (score 4)
      other_violations:              8     // kasus — (score 3)
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIT 3: KCP Taspen — BRIguna-focused, low risk, government payroll base
  // Profile: Stable konsumer, very low fraud, strong compliance
  // ═══════════════════════════════════════════════════════════════════════════
  {
    unit:   'KCP Taspen',
    period: '2026-03',

    credit: {
      npl_mikro:            1.20,
      npl_sme:              null,    // No SME portfolio
      npl_konsumer:         1.10,    // Very healthy BRIguna
      npl_menengah:         null,    // No menengah book
      lar_mikro:            3.50,
      lar_sme:              null,
      lar_konsumer:         3.00,
      lar_menengah:         null,
      dpk_mikro_growth:     7.50,
      dpk_sme_growth:       null,
      dpk_konsumer_growth:  9.20,
      dpk_menengah_growth:  null,
      cost_of_credit:       0.60
    },

    liquidity: {
      ldr:           78.50,
      casa_ratio:    66.80,
      cost_of_fund:   2.40
    },

    operational: {
      span_of_control_mantri:    130,
      os_worker_ratio:            20.0,
      spv_fulfillment:            97.0,
      mantri_fulfillment:         94.0,
      turnover:                    4.5,
      human_error_loss:            3.0,
      fraud_internal_loss:         0.0,
      fraud_internal_freq_growth: -15.0,
      fraud_external_loss:         5.0,
      fraud_external_freq_growth: -5.0,
      max_fraud_3m_ma:             8.0,
      disaster_loss_natural:       0.0,
      disaster_loss_non_natural:   0.0,
      external_event_growth:       5.0,
      pct_affected_assets:         0.5,
      atm_reliability:            99.2,
      crm_reliability:            99.0,
      edc_reliability:            98.5
    },

    legal: {
      lawsuit_nominal:       0.0,
      potential_loss:        0.0,
      actual_loss:           0.0,
      lawsuit_frequency:     0,
      lost_cases_frequency:  0
    },

    strategic: {
      profit_growth:         11.00,
      fbi_growth:            14.00,
      avg_loan_growth:        8.50,
      avg_dpk_growth:         7.80,
      tabungan_growth:        9.00,
      giro_growth:            8.20,
      recovery_rate:         55.00,
      edc_qris_volume_growth: 28.00,
      brimo_users_growth:    32.00,
      qlola_users_growth:    20.00,
      merchant_dpk:        2800.00,
      market_share:          16.00,
      daily_avg_loan_growth:  0.85,
      daily_avg_dana_growth:  0.70,
      daily_avg_casa_growth:  0.65
    },

    reputational: {
      negative_news_ratio:       3.0,
      complaint_rate:            1.2,
      unresolved_complaints_pct: 1.5
    },

    compliance: {
      financial_penalty_nominal:    0.0,
      financial_penalty_frequency:  0,
      slik_violations:              0,
      tax_violations:               0,
      lbu_violations:               0,
      other_violations:             1
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIT 4: KCP Abdul Muis — Mixed portfolio, recovering from prior year stress
  // Profile: NPL on downtrend, compliance hiccups, growing digital channels
  // ═══════════════════════════════════════════════════════════════════════════
  {
    unit:   'KCP Abdul Muis',
    period: '2026-03',

    credit: {
      npl_mikro:            3.60,
      npl_sme:              5.20,
      npl_konsumer:         2.30,
      npl_menengah:         4.00,
      lar_mikro:            9.80,
      lar_sme:             13.50,
      lar_konsumer:         6.80,
      lar_menengah:        12.00,
      dpk_mikro_growth:     3.80,
      dpk_sme_growth:       2.50,
      dpk_konsumer_growth:  5.50,
      dpk_menengah_growth:  7.00,
      cost_of_credit:       1.60
    },

    liquidity: {
      ldr:           88.20,
      casa_ratio:    56.40,
      cost_of_fund:   3.50
    },

    operational: {
      span_of_control_mantri:    220,
      os_worker_ratio:            34.0,
      spv_fulfillment:            82.0,
      mantri_fulfillment:         76.0,
      turnover:                   12.0,
      human_error_loss:           28.0,
      fraud_internal_loss:         0.0,
      fraud_internal_freq_growth:  5.0,
      fraud_external_loss:        32.0,
      fraud_external_freq_growth: 18.0,
      max_fraud_3m_ma:            65.0,
      disaster_loss_natural:       8.0,
      disaster_loss_non_natural:  12.0,
      external_event_growth:      30.0,
      pct_affected_assets:         3.8,
      atm_reliability:            96.8,
      crm_reliability:            96.0,
      edc_reliability:            94.5
    },

    legal: {
      lawsuit_nominal:      300.0,
      potential_loss:       120.0,
      actual_loss:           25.0,
      lawsuit_frequency:      2,
      lost_cases_frequency:   1
    },

    strategic: {
      profit_growth:          5.00,
      fbi_growth:             7.50,
      avg_loan_growth:        4.50,
      avg_dpk_growth:         3.80,
      tabungan_growth:        4.00,
      giro_growth:            3.50,
      recovery_rate:         31.00,
      edc_qris_volume_growth: 16.00,
      brimo_users_growth:    21.00,
      qlola_users_growth:    12.00,
      merchant_dpk:        1200.00,
      market_share:          13.50,
      daily_avg_loan_growth:  0.35,
      daily_avg_dana_growth:  0.28,
      daily_avg_casa_growth:  0.22
    },

    reputational: {
      negative_news_ratio:       12.0,
      complaint_rate:             4.2,
      unresolved_complaints_pct:  7.5
    },

    compliance: {
      financial_penalty_nominal:   60.0,
      financial_penalty_frequency:  1,
      slik_violations:              3,
      tax_violations:               1,
      lbu_violations:               2,
      other_violations:             5
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIT 5: KCP Depkeu — Civil servant payroll, very low risk across the board
  // Profile: Safest unit, strong government base, minimal operational issues
  // ═══════════════════════════════════════════════════════════════════════════
  {
    unit:   'KCP Depkeu',
    period: '2026-03',

    credit: {
      npl_mikro:            1.05,
      npl_sme:              null,
      npl_konsumer:         0.90,
      npl_menengah:         null,
      lar_mikro:            2.80,
      lar_sme:              null,
      lar_konsumer:         2.20,
      lar_menengah:         null,
      dpk_mikro_growth:     8.50,
      dpk_sme_growth:       null,
      dpk_konsumer_growth: 10.50,
      dpk_menengah_growth:  null,
      cost_of_credit:       0.45
    },

    liquidity: {
      ldr:           72.00,
      casa_ratio:    71.20,
      cost_of_fund:   2.10
    },

    operational: {
      span_of_control_mantri:    110,
      os_worker_ratio:            15.0,
      spv_fulfillment:            98.5,
      mantri_fulfillment:         96.0,
      turnover:                    3.5,
      human_error_loss:            2.0,
      fraud_internal_loss:         0.0,
      fraud_internal_freq_growth: -20.0,
      fraud_external_loss:         2.0,
      fraud_external_freq_growth: -8.0,
      max_fraud_3m_ma:             4.0,
      disaster_loss_natural:       0.0,
      disaster_loss_non_natural:   0.0,
      external_event_growth:       0.0,
      pct_affected_assets:         0.3,
      atm_reliability:            99.5,
      crm_reliability:            99.3,
      edc_reliability:            98.8
    },

    legal: {
      lawsuit_nominal:       0.0,
      potential_loss:        0.0,
      actual_loss:           0.0,
      lawsuit_frequency:     0,
      lost_cases_frequency:  0
    },

    strategic: {
      profit_growth:         13.50,
      fbi_growth:            16.00,
      avg_loan_growth:        9.50,
      avg_dpk_growth:         9.00,
      tabungan_growth:       10.00,
      giro_growth:           10.50,
      recovery_rate:         65.00,
      edc_qris_volume_growth: 30.00,
      brimo_users_growth:    35.00,
      qlola_users_growth:    28.00,
      merchant_dpk:        6500.00,
      market_share:          22.00,
      daily_avg_loan_growth:  1.10,
      daily_avg_dana_growth:  0.95,
      daily_avg_casa_growth:  0.90
    },

    reputational: {
      negative_news_ratio:       2.0,
      complaint_rate:            0.8,
      unresolved_complaints_pct: 1.0
    },

    compliance: {
      financial_penalty_nominal:    0.0,
      financial_penalty_frequency:  0,
      slik_violations:              0,
      tax_violations:               0,
      lbu_violations:               0,
      other_violations:             0
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIT 6: KCP Lemhanas — SME-heavy, high operational risk, growing NPL
  // Profile: Underperforming SME unit, staffing issues, compliance violations
  // ═══════════════════════════════════════════════════════════════════════════
  {
    unit:   'KCP Lemhanas',
    period: '2026-03',

    credit: {
      npl_mikro:            6.20,
      npl_sme:              8.90,
      npl_konsumer:         3.80,
      npl_menengah:         7.50,
      lar_mikro:           15.50,
      lar_sme:             21.00,
      lar_konsumer:        10.50,
      lar_menengah:        19.00,
      dpk_mikro_growth:    -4.50,
      dpk_sme_growth:      -2.00,
      dpk_konsumer_growth:  0.50,
      dpk_menengah_growth:  1.00,
      cost_of_credit:       2.80
    },

    liquidity: {
      ldr:           98.50,
      casa_ratio:    42.00,
      cost_of_fund:   4.80
    },

    operational: {
      span_of_control_mantri:    290,
      os_worker_ratio:            48.0,
      spv_fulfillment:            62.0,
      mantri_fulfillment:         55.0,
      turnover:                   22.0,
      human_error_loss:           90.0,
      fraud_internal_loss:        80.0,
      fraud_internal_freq_growth: 60.0,
      fraud_external_loss:       180.0,
      fraud_external_freq_growth: 75.0,
      max_fraud_3m_ma:           320.0,
      disaster_loss_natural:      20.0,
      disaster_loss_non_natural:  45.0,
      external_event_growth:     120.0,
      pct_affected_assets:        11.0,
      atm_reliability:            89.0,
      crm_reliability:            91.0,
      edc_reliability:            87.5
    },

    legal: {
      lawsuit_nominal:      1200.0,
      potential_loss:        500.0,
      actual_loss:           150.0,
      lawsuit_frequency:       7,
      lost_cases_frequency:    4
    },

    strategic: {
      profit_growth:         -7.50,
      fbi_growth:            -5.00,
      avg_loan_growth:       -2.00,
      avg_dpk_growth:        -3.50,
      tabungan_growth:       -3.00,
      giro_growth:           -4.50,
      recovery_rate:          8.00,
      edc_qris_volume_growth: 1.50,
      brimo_users_growth:     5.00,
      qlola_users_growth:     1.00,
      merchant_dpk:          80.00,
      market_share:           5.50,
      daily_avg_loan_growth: -0.60,
      daily_avg_dana_growth: -0.70,
      daily_avg_casa_growth: -0.65
    },

    reputational: {
      negative_news_ratio:       42.0,
      complaint_rate:            11.5,
      unresolved_complaints_pct: 22.0
    },

    compliance: {
      financial_penalty_nominal:   800.0,
      financial_penalty_frequency:   5,
      slik_violations:              12,
      tax_violations:                5,
      lbu_violations:                8,
      other_violations:             18
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIT 7: KCP BUMN — Corporate/BUMN payroll base, digital-forward, low risk
  // Profile: Growing digital, decent SME, slight NPL on SME CC
  // ═══════════════════════════════════════════════════════════════════════════
  {
    unit:   'KCP BUMN',
    period: '2026-03',

    credit: {
      npl_mikro:            2.10,
      npl_sme:              3.80,
      npl_konsumer:         1.60,
      npl_menengah:         2.90,
      lar_mikro:            6.00,
      lar_sme:              9.50,
      lar_konsumer:         4.50,
      lar_menengah:         8.00,
      dpk_mikro_growth:     6.00,
      dpk_sme_growth:       8.50,
      dpk_konsumer_growth:  7.00,
      dpk_menengah_growth: 12.00,
      cost_of_credit:       0.90
    },

    liquidity: {
      ldr:           81.00,
      casa_ratio:    63.50,
      cost_of_fund:   2.80
    },

    operational: {
      span_of_control_mantri:    160,
      os_worker_ratio:            22.0,
      spv_fulfillment:            94.0,
      mantri_fulfillment:         90.0,
      turnover:                    6.0,
      human_error_loss:            8.0,
      fraud_internal_loss:         0.0,
      fraud_internal_freq_growth: -8.0,
      fraud_external_loss:        10.0,
      fraud_external_freq_growth:  5.0,
      max_fraud_3m_ma:            18.0,
      disaster_loss_natural:       0.0,
      disaster_loss_non_natural:   2.0,
      external_event_growth:       8.0,
      pct_affected_assets:         1.2,
      atm_reliability:            98.8,
      crm_reliability:            98.5,
      edc_reliability:            97.8
    },

    legal: {
      lawsuit_nominal:       0.0,
      potential_loss:        0.0,
      actual_loss:           0.0,
      lawsuit_frequency:     0,
      lost_cases_frequency:  0
    },

    strategic: {
      profit_growth:         10.50,
      fbi_growth:            13.00,
      avg_loan_growth:        8.00,
      avg_dpk_growth:         8.50,
      tabungan_growth:        8.80,
      giro_growth:            9.00,
      recovery_rate:         48.00,
      edc_qris_volume_growth: 26.00,
      brimo_users_growth:    28.00,
      qlola_users_growth:    22.00,
      merchant_dpk:        4200.00,
      market_share:          19.00,
      daily_avg_loan_growth:  0.90,
      daily_avg_dana_growth:  0.80,
      daily_avg_casa_growth:  0.75
    },

    reputational: {
      negative_news_ratio:       4.0,
      complaint_rate:            1.8,
      unresolved_complaints_pct: 2.5
    },

    compliance: {
      financial_penalty_nominal:    0.0,
      financial_penalty_frequency:  0,
      slik_violations:              1,
      tax_violations:               0,
      lbu_violations:               1,
      other_violations:             2
    }
  }

];

console.log(`[BRInsight] RISK_DUMMY_DATA loaded: ${window.RISK_DUMMY_DATA.length} units.`);
