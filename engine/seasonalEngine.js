/**
 * seasonalEngine.js — Seasonal Pattern & Anomaly Detection Engine
 * BRInsight SDSS | Phase 2
 *
 * Goal: Distinguish NORMAL seasonal fluctuations from genuine ANOMALIES.
 * Context: Prevents false alarms during Lebaran, year-end, and Q1 post-holiday periods.
 *
 * Special Periods (hardcoded Indonesian fiscal calendar):
 *  - Q1 Slow:   Jan-Feb (post year-end, client funding withdrawals common)
 *  - Lebaran:   Mar-Apr (salary/THR period, Tabungan demand high, Deposito may drop)
 *  - Mid-Year:  Jun (semester close, moderate DPK pressure)
 *  - Year-End:  Dec (strong DPK inflow target, but lending pullback)
 */

window.seasonalEngine = (function () {

    // Hardcoded Indonesian banking calendar
    const SPECIAL_PERIODS = {
        '2025-01': { name: 'Q1 Lambat (Pasca Year-End)',  expectedDpkDir: 'flat',  expectedLendDir: 'flat'  },
        '2025-02': { name: 'Q1 Lambat',                   expectedDpkDir: 'flat',  expectedLendDir: 'up'    },
        '2025-03': { name: 'Pre-Ramadan / Pre-Lebaran',   expectedDpkDir: 'down',  expectedLendDir: 'up'    },
        '2025-04': { name: 'Lebaran / Idul Fitri',        expectedDpkDir: 'down',  expectedLendDir: 'flat'  },
        '2025-06': { name: 'Tutup Semester',              expectedDpkDir: 'up',    expectedLendDir: 'up'    },
        '2025-12': { name: 'Year-End Push',               expectedDpkDir: 'up',    expectedLendDir: 'up'    },
        '2026-01': { name: 'Q1 Lambat (Pasca Year-End)',  expectedDpkDir: 'flat',  expectedLendDir: 'flat'  },
        '2026-03': { name: 'Q1 Tutup Kuartal',            expectedDpkDir: 'up',    expectedLendDir: 'up'    },
    };

    // Thresholds
    const ANOMALY_THRESHOLD   = -3.0;  // Drop > 3% in a non-seasonal month = ANOMALY
    const SEASONAL_THRESHOLD  = -5.0;  // Drop > 5% even in seasonal period = still ANOMALY

    /**
     * Extract YYYYMM key from a date string.
     */
    function toMonthKey(dateStr) {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    /**
     * Compute month-over-month growth for a given dataset grouped by month.
     * @param {Object[]} records
     * @returns {Object[]} array of { month, total, momGrowth }
     */
    function computeMonthlyGrowth(records) {
        const byMonth = {};
        records.forEach(r => {
            const k = toMonthKey(r.tanggal);
            byMonth[k] = (byMonth[k] || 0) + r.nominal;
        });

        const months = Object.keys(byMonth).sort();
        return months.map((m, idx) => {
            const total = byMonth[m];
            const prev  = idx > 0 ? byMonth[months[idx - 1]] : null;
            const momGrowth = prev && prev > 0 ? ((total - prev) / prev) * 100 : null;
            return { month: m, total, momGrowth };
        });
    }

    /**
     * Classify a monthly deviation as ANOMALY, SEASONAL_NORMAL, or STABLE.
     */
    function classifyDeviation(month, momGrowth, type) {
        if (momGrowth === null) return 'BASELINE';

        const special = SPECIAL_PERIODS[month];
        const isSpecial = !!special;

        if (momGrowth >= 0) return 'STABLE';

        // Even in seasonal period, if drop is extreme — still flag
        if (momGrowth < SEASONAL_THRESHOLD) return 'ANOMALY';

        // Below threshold in non-seasonal month
        if (momGrowth < ANOMALY_THRESHOLD && !isSpecial) return 'ANOMALY';

        // Decline in a seasonal period — check direction alignment
        if (isSpecial) {
            const expectedDir = type === 'dpk' ? special.expectedDpkDir : special.expectedLendDir;
            if (expectedDir === 'down' || expectedDir === 'flat') return 'SEASONAL_NORMAL';
            // Expected to go up but went down — still anomaly
            if (momGrowth < ANOMALY_THRESHOLD) return 'ANOMALY';
            return 'SEASONAL_EXPECTED';
        }

        return 'MILD_DECLINE';
    }

    /**
     * Analyze seasonal patterns for both DPK and lending.
     *
     * @param {Object[]} funding - filtered Funding records
     * @param {Object[]} lending - filtered Lending records
     * @returns {{
     *   dpkMonthly: Array,
     *   lendingMonthly: Array,
     *   anomalies: Array,
     *   seasonalNormal: Array,
     *   latestMonthContext: Object|null,
     *   hasAnomalies: boolean,
     *   anomalyCount: number
     * }}
     */
    function analyze(funding, lending) {
        const dpkMonthly     = computeMonthlyGrowth(funding);
        const lendingMonthly = computeMonthlyGrowth(lending);

        // Enrich with classification
        const dpkAnalyzed = dpkMonthly.map(m => ({
            ...m,
            type:         'DPK',
            classification: classifyDeviation(m.month, m.momGrowth, 'dpk'),
            specialPeriod:  SPECIAL_PERIODS[m.month] || null
        }));

        const lendingAnalyzed = lendingMonthly.map(m => ({
            ...m,
            type:         'Kredit',
            classification: classifyDeviation(m.month, m.momGrowth, 'lending'),
            specialPeriod:  SPECIAL_PERIODS[m.month] || null
        }));

        const allAnalyzed = [...dpkAnalyzed, ...lendingAnalyzed];

        const anomalies = allAnalyzed.filter(m => m.classification === 'ANOMALY');
        const seasonalNormal = allAnalyzed.filter(m =>
            m.classification === 'SEASONAL_NORMAL' || m.classification === 'SEASONAL_EXPECTED'
        );

        // Determine current month context
        const allMonths = [...new Set(funding.map(f => toMonthKey(f.tanggal)))].sort();
        const latestMonth = allMonths[allMonths.length - 1];
        const latestMonthContext = latestMonth ? {
            month:   latestMonth,
            special: SPECIAL_PERIODS[latestMonth] || null,
            isSpecialPeriod: !!SPECIAL_PERIODS[latestMonth]
        } : null;

        return {
            dpkMonthly:          dpkAnalyzed,
            lendingMonthly:      lendingAnalyzed,
            anomalies,
            seasonalNormal,
            latestMonthContext,
            hasAnomalies:  anomalies.length > 0,
            anomalyCount:  anomalies.length
        };
    }

    return { analyze, SPECIAL_PERIODS };
})();
