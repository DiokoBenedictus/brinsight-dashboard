/**
 * vintageEngine.js — Vintage / Cohort Analysis Engine
 * BRInsight SDSS | Phase 2
 *
 * Goal: Identify which loan cohort (booking year) contributes most to NPL risk.
 * Approach: Group lending by year → compute outstanding + weighted NPL per cohort.
 */

window.vintageEngine = (function () {

    /**
     * Classify cohort risk level based on weighted NPL.
     * @param {number} npl - weighted NPL percentage
     * @returns {'CRITICAL'|'HIGH'|'MODERATE'|'LOW'}
     */
    function classifyRisk(npl) {
        if (npl > 3)    return 'CRITICAL';
        if (npl > 2)    return 'HIGH';
        if (npl > 1)    return 'MODERATE';
        return 'LOW';
    }

    /**
     * Analyze lending portfolio by cohort year.
     *
     * @param {Object[]} lending - filtered lending records from IndexedDB
     * @returns {{
     *   cohorts: Array,
     *   riskiestCohort: Object|null,
     *   totalExposure: number,
     *   totalWeightedNpl: number,
     *   hasMultipleCohorts: boolean
     * }}
     */
    function analyze(lending) {
        if (!lending || lending.length === 0) {
            return {
                cohorts: [],
                riskiestCohort: null,
                totalExposure: 0,
                totalWeightedNpl: 0,
                hasMultipleCohorts: false
            };
        }

        // Group lending records by booking year
        const cohortMap = {};
        lending.forEach(item => {
            const year = new Date(item.tanggal).getFullYear();
            if (!cohortMap[year]) {
                cohortMap[year] = { items: [], totalOutstanding: 0, nplWeightedSum: 0 };
            }
            cohortMap[year].items.push(item);
            cohortMap[year].totalOutstanding += item.nominal;
            if (item.npl !== null && item.npl !== undefined) {
                cohortMap[year].nplWeightedSum += item.nominal * (item.npl / 100);
            }
        });

        // Compute per-cohort metrics
        const totalPortfolio = lending.reduce((s, i) => s + i.nominal, 0);

        const cohorts = Object.entries(cohortMap)
            .map(([year, data]) => {
                const weightedNpl = data.totalOutstanding > 0
                    ? (data.nplWeightedSum / data.totalOutstanding) * 100
                    : 0;
                const portfolioShare = totalPortfolio > 0
                    ? (data.totalOutstanding / totalPortfolio) * 100
                    : 0;
                const nplExposure = data.nplWeightedSum; // absolute NPL exposure in Rp

                return {
                    year:           parseInt(year),
                    totalOutstanding: data.totalOutstanding,
                    weightedNpl:    parseFloat(weightedNpl.toFixed(2)),
                    portfolioShare: parseFloat(portfolioShare.toFixed(1)),
                    nplExposure,
                    riskLevel:      classifyRisk(weightedNpl),
                    recordCount:    data.items.length
                };
            })
            .sort((a, b) => b.year - a.year); // newest first

        // Identify riskiest cohort (highest absolute NPL exposure)
        const riskiestCohort = cohorts.length > 0
            ? cohorts.reduce((max, c) => c.nplExposure > max.nplExposure ? c : max, cohorts[0])
            : null;

        // Overall portfolio weighted NPL
        const totalNplWeighted = lending
            .filter(i => i.npl !== null)
            .reduce((s, i) => s + i.nominal * (i.npl / 100), 0);
        const totalWithNpl = lending
            .filter(i => i.npl !== null)
            .reduce((s, i) => s + i.nominal, 0);
        const totalWeightedNpl = totalWithNpl > 0
            ? (totalNplWeighted / totalWithNpl) * 100
            : 0;

        return {
            cohorts,
            riskiestCohort,
            totalExposure:     totalPortfolio,
            totalWeightedNpl:  parseFloat(totalWeightedNpl.toFixed(2)),
            hasMultipleCohorts: cohorts.length > 1
        };
    }

    return { analyze };
})();
