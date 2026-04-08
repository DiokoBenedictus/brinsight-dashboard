/**
 * analyticsEngine.js — BRInsight Core Analytics Layer  v2
 * ─────────────────────────────────────────────────────────
 * Critical fixes applied (v2):
 *   [FIX-1]  riskIndex = 100 - riskScore  (higher = more dangerous; used for sort/prioritization)
 *   [FIX-2]  Growth values clamped to [-20, +20] before normalization (stability)
 *   [FIX-3]  CASA breakdown: giroGrowth + tabunganGrowth
 *   [FIX-4]  drivers: { npl, sml, growth } sub-object per unit
 *   [FIX-5]  nplTrend computed from last 3 chronological periods
 *   [FIX-6]  Unified output structure: { unit, riskScore, riskIndex, growthScore, drivers, trends }
 *
 * Public API:
 *   window.analyticsEngine.run(data)               → { unitMetrics, riskMatrix, growthMatrix }
 *   window.analyticsEngine.aggregateUnitMetrics(data)
 *   window.analyticsEngine.calculateRiskScore(unitData)
 *   window.analyticsEngine.calculateGrowthScore(unitData, growthStats)
 *   window.analyticsEngine.buildRiskMatrix(units)
 *   window.analyticsEngine.buildGrowthMatrix(units)
 *
 * Depends on: window.ALLOWED_LENDING_PRODUCTS  (set by db.js)
 */

window.analyticsEngine = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────────────────────────────────

    /** [FIX-2] Hard cap on growth values before any normalization. */
    const GROWTH_FLOOR = -20;
    const GROWTH_CAP   =  20;

    /** Number of most-recent periods used for trend computation. */
    const TREND_PERIODS = 3;

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    /** Clamp value to [0, 100]. */
    function clamp100(v) { return Math.min(100, Math.max(0, v)); }

    /** [FIX-2] Clamp a raw growth value to the stable range before normalization. */
    function clampGrowth(g) { return Math.max(GROWTH_FLOOR, Math.min(GROWTH_CAP, g)); }

    /** Safe average over a numeric array; returns 0 if empty or all null. */
    function safeAvg(arr) {
        const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
        return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
    }

    /** Nominal-weighted average of a given field across an array of lending rows. */
    function weightedAvg(items, valueKey) {
        let totalNominal = 0;
        let weightedSum  = 0;
        for (const item of items) {
            const v = item[valueKey];
            if (v === null || v === undefined || isNaN(v)) continue;
            const n = item.nominal || 0;
            weightedSum  += v * n;
            totalNominal += n;
        }
        return totalNominal > 0 ? weightedSum / totalNominal : 0;
    }

    /** Round to N decimal places. */
    function r(n, dp = 3) { return +n.toFixed(dp); }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2 — AGGREGATION LAYER
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Aggregate raw IndexedDB records into per-unit summary metrics.
     * Single-pass O(n) aggregation.
     *
     * @param  {Object[]} data  — All records from dbManager.getAllData()
     * @returns {Object[]}      — One summary object per unit (see shape below)
     *
     * Output shape per unit:
     * {
     *   unit              : string,
     *   totalFunding      : number,
     *   totalLending      : number,
     *   avgNPL            : number,   // nominal-weighted
     *   avgSML            : number,   // nominal-weighted
     *   casaGrowth        : number,   // avg(giroGrowth, tabunganGrowth) — clamped
     *   giroGrowth        : number,   // [FIX-3] Giro-only avg growth  — clamped
     *   tabunganGrowth    : number,   // [FIX-3] Tabungan-only avg growth — clamped
     *   lendingGrowth     : number,   // avg lending growth — clamped
     *   channelGrowth     : number,   // avg channel growth — clamped
     *   lendingItems      : Object[], // raw lending rows for drill-down / trend
     *   _nplByPeriod      : Object,   // internal: { "YYYY-MM-DD": weightedNPL } for trend
     * }
     */
    function aggregateUnitMetrics(data) {
        const allowed = new Set(
            window.ALLOWED_LENDING_PRODUCTS || ['BRIguna', 'KPR', 'SME CC', 'SME NCC']
        );

        // Single-pass accumulator map
        const map = {};

        for (const row of data) {
            const unit = row.unit;
            if (!unit) continue;

            if (!map[unit]) {
                map[unit] = {
                    unit,
                    totalFunding:    0,
                    totalLending:    0,
                    _lendingItems:   [],
                    _giroGrowths:    [],
                    _tabGrowths:     [],
                    _casaGrowths:    [],
                    _lendingGrowths: [],
                    _channelGrowths: [],
                    // period-keyed accumulator for NPL trend  { date → { sum, totalNom } }
                    _nplPeriods:     {},
                };
            }

            const acc  = map[unit];
            const tipo = row.jenis_produk;

            // ── Funding ────────────────────────────────────────────────────
            if (tipo === 'Funding') {
                acc.totalFunding += row.nominal || 0;
                const p = (row.produk || '').toLowerCase();
                if (p === 'giro') {
                    if (row.growth !== null && row.growth !== undefined) acc._giroGrowths.push(row.growth);
                    if (row.growth !== null && row.growth !== undefined) acc._casaGrowths.push(row.growth);
                } else if (p === 'tabungan') {
                    if (row.growth !== null && row.growth !== undefined) acc._tabGrowths.push(row.growth);
                    if (row.growth !== null && row.growth !== undefined) acc._casaGrowths.push(row.growth);
                }

            // ── Lending ────────────────────────────────────────────────────
            } else if (tipo === 'Lending') {
                if (allowed.has(row.produk)) {
                    acc.totalLending += row.nominal || 0;
                    acc._lendingItems.push(row);
                    if (row.growth !== null && row.growth !== undefined) acc._lendingGrowths.push(row.growth);

                    // [FIX-5] Accumulate NPL by period for trend computation
                    const date = row.tanggal || '__';
                    const nVal = row.npl;
                    const nNom = row.nominal || 0;
                    if (nVal !== null && nVal !== undefined && !isNaN(nVal) && nNom > 0) {
                        if (!acc._nplPeriods[date]) acc._nplPeriods[date] = { wSum: 0, wTot: 0 };
                        acc._nplPeriods[date].wSum += nVal * nNom;
                        acc._nplPeriods[date].wTot += nNom;
                    }
                }

            // ── Channel ────────────────────────────────────────────────────
            } else if (tipo === 'Channel') {
                if (row.growth !== null && row.growth !== undefined) acc._channelGrowths.push(row.growth);
            }
        }

        // ── Post-process: compute final metrics ────────────────────────────
        return Object.values(map).map(acc => {
            const avgNPL = weightedAvg(acc._lendingItems, 'npl');
            const avgSML = weightedAvg(acc._lendingItems, 'sml');

            // [FIX-2] Clamp all growth values before averaging
            const giroGrowth     = r(clampGrowth(safeAvg(acc._giroGrowths)));
            const tabunganGrowth = r(clampGrowth(safeAvg(acc._tabGrowths)));
            const casaGrowth     = r(clampGrowth(safeAvg(acc._casaGrowths)));
            const lendingGrowth  = r(clampGrowth(safeAvg(acc._lendingGrowths)));
            const channelGrowth  = r(clampGrowth(safeAvg(acc._channelGrowths)));

            // [FIX-5] nplTrend from last TREND_PERIODS sorted periods
            const nplTrend = _computeNplTrend(acc._nplPeriods);

            return {
                unit:              acc.unit,
                totalFunding:      acc.totalFunding,
                totalLending:      acc.totalLending,
                avgNPL:            r(avgNPL),
                avgSML:            r(avgSML),
                casaGrowth,
                giroGrowth,        // [FIX-3]
                tabunganGrowth,    // [FIX-3]
                lendingGrowth,
                channelGrowth,
                lendingItems:      acc._lendingItems,
                _nplPeriods:       acc._nplPeriods,  // kept for external drill-down
            };
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FIX-5 — NPL TREND COMPUTATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compute nplTrend from a period-keyed accumulator.
     * Trend = slope direction over the last TREND_PERIODS periods.
     *
     * @param {Object} nplPeriods — { "YYYY-MM-DD": { wSum, wTot } }
     * @returns {{
     *   direction : 'improving' | 'deteriorating' | 'stable',
     *   delta     : number,    // NPL change over the trend window (pp)
     *   periods   : string[],  // sorted dates used
     *   values    : number[],  // weighted NPL per period
     * }}
     */
    function _computeNplTrend(nplPeriods) {
        const dates = Object.keys(nplPeriods).sort();  // ascending chronological
        const window = dates.slice(-TREND_PERIODS);

        if (window.length < 2) {
            return { direction: 'stable', delta: 0, periods: window, values: window.map(d => {
                const p = nplPeriods[d];
                return p.wTot > 0 ? r(p.wSum / p.wTot, 3) : 0;
            })};
        }

        const values = window.map(d => {
            const p = nplPeriods[d];
            return p.wTot > 0 ? r(p.wSum / p.wTot, 3) : 0;
        });

        const delta = r(values[values.length - 1] - values[0], 3);

        let direction;
        if (delta <= -0.10)       direction = 'improving';     // NPL falling ≥ 0.10pp
        else if (delta >= 0.10)   direction = 'deteriorating'; // NPL rising  ≥ 0.10pp
        else                      direction = 'stable';

        return { direction, delta, periods: window, values };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3 — RISK SCORING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * NPL tier score (0–100).  Lower NPL → higher score → lower risk.
     * Continuous interpolation within each regulatory band.
     */
    function _nplTierScore(npl) {
        if (npl <= 2) return 95 - (npl / 2) * 15;          // 95 → 80
        if (npl <= 3) return 80 - (npl - 2) * 20;          // 80 → 60
        if (npl <= 5) return 60 - ((npl - 3) / 2) * 20;   // 60 → 40
        return Math.max(0, 40 - (npl - 5) * 5);            // <40, floor 0
    }

    /**
     * SML tier score — same band shape but 5 pts harsher per level (≈15% tighter).
     */
    function _smlTierScore(sml) {
        if (sml <= 2) return 90 - (sml / 2) * 15;          // 90 → 75
        if (sml <= 3) return 75 - (sml - 2) * 20;          // 75 → 55
        if (sml <= 5) return 55 - ((sml - 3) / 2) * 20;   // 55 → 35
        return Math.max(0, 35 - (sml - 5) * 6);            // <35, floor 0
    }

    /**
     * Growth component for the risk score (0–100).
     * Uses GROWTH_FLOOR/CAP clamped values — already applied upstream;
     * secondary clamp here is a safety guard.
     */
    function _growthRiskScore(u) {
        const norm = (g) => clamp100(((clampGrowth(g) - GROWTH_FLOOR) / (GROWTH_CAP - GROWTH_FLOOR)) * 100);
        return norm(u.casaGrowth) * 0.4
             + norm(u.lendingGrowth) * 0.4
             + norm(u.channelGrowth) * 0.2;
    }

    /**
     * Compute composite risk score (0–100, higher = safer).
     * Also returns riskIndex = 100 - riskScore (higher = more dangerous). [FIX-1]
     *
     * @param {{ avgNPL, avgSML, casaGrowth, lendingGrowth, channelGrowth }} unitData
     * @returns {{
     *   riskScore  : number,   // 0–100, higher = safer     (internal orientation)
     *   riskIndex  : number,   // 0–100, higher = more risky (sort/priority key)  [FIX-1]
     *   nplScore   : number,
     *   smlScore   : number,
     *   growthScore: number,
     * }}
     */
    function calculateRiskScore(unitData) {
        const nplScore    = clamp100(_nplTierScore(unitData.avgNPL));
        const smlScore    = clamp100(_smlTierScore(unitData.avgSML));
        const growthScore = clamp100(_growthRiskScore(unitData));

        const riskScore = clamp100(
            0.5 * nplScore +
            0.3 * smlScore +
            0.2 * growthScore
        );

        const riskIndex = clamp100(100 - riskScore);   // [FIX-1]

        return {
            riskScore:   r(riskScore, 2),
            riskIndex:   r(riskIndex, 2),               // [FIX-1]
            nplScore:    r(nplScore,  2),
            smlScore:    r(smlScore,  2),
            growthScore: r(growthScore, 2),
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4 — GROWTH SCORING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Min/max stats for each growth axis across all units.
     * [FIX-2] Values are clamped before min/max computation.
     *
     * @param {Object[]} units — output of aggregateUnitMetrics()
     * @returns {{ casa, lending, channel, giro, tabungan }}  each: { min, max }
     */
    function _growthStats(units) {
        const pick = (key) => units.map(u => clampGrowth(u[key] ?? 0));
        const stat = (arr)  => ({ min: Math.min(...arr), max: Math.max(...arr) });
        return {
            casa:      stat(pick('casaGrowth')),
            lending:   stat(pick('lendingGrowth')),
            channel:   stat(pick('channelGrowth')),
            giro:      stat(pick('giroGrowth')),        // [FIX-3]
            tabungan:  stat(pick('tabunganGrowth')),    // [FIX-3]
        };
    }

    /**
     * Normalize a pre-clamped growth value to 0–100 given population min/max.
     * Returns 50 when min === max (no variance in population).
     */
    function _normalizeGrowth(value, min, max) {
        if (max === min) return 50;
        return clamp100(((clampGrowth(value) - min) / (max - min)) * 100);
    }

    /**
     * Compute composite growth score (0–100).  Higher = stronger growth.
     *
     * @param {{ casaGrowth, lendingGrowth, channelGrowth,
     *            giroGrowth, tabunganGrowth }} unitData
     * @param {{ casa, lending, channel, giro, tabungan }} growthStats
     * @returns {{
     *   growthScore   : number,
     *   casaNorm      : number,
     *   lendingNorm   : number,
     *   channelNorm   : number,
     *   giroNorm      : number,   // [FIX-3]
     *   tabunganNorm  : number,   // [FIX-3]
     * }}
     */
    function calculateGrowthScore(unitData, growthStats) {
        const gs = growthStats || {
            casa:    { min: GROWTH_FLOOR, max: GROWTH_CAP },
            lending: { min: GROWTH_FLOOR, max: GROWTH_CAP },
            channel: { min: GROWTH_FLOOR, max: GROWTH_CAP },
            giro:    { min: GROWTH_FLOOR, max: GROWTH_CAP },
            tabungan:{ min: GROWTH_FLOOR, max: GROWTH_CAP },
        };

        const casaNorm     = _normalizeGrowth(unitData.casaGrowth,     gs.casa.min,     gs.casa.max);
        const lendingNorm  = _normalizeGrowth(unitData.lendingGrowth,  gs.lending.min,  gs.lending.max);
        const channelNorm  = _normalizeGrowth(unitData.channelGrowth,  gs.channel.min,  gs.channel.max);
        const giroNorm     = _normalizeGrowth(unitData.giroGrowth,     gs.giro.min,     gs.giro.max);     // [FIX-3]
        const tabunganNorm = _normalizeGrowth(unitData.tabunganGrowth, gs.tabungan.min, gs.tabungan.max); // [FIX-3]

        const growthScore = clamp100(
            0.4 * casaNorm +
            0.4 * lendingNorm +
            0.2 * channelNorm
        );

        return {
            growthScore:   r(growthScore,  2),
            casaNorm:      r(casaNorm,     2),
            lendingNorm:   r(lendingNorm,  2),
            channelNorm:   r(channelNorm,  2),
            giroNorm:      r(giroNorm,     2),      // [FIX-3]
            tabunganNorm:  r(tabunganNorm, 2),      // [FIX-3]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 5a — RISK MATRIX
    // ─────────────────────────────────────────────────────────────────────────

    /** Map riskIndex (0–100, higher = riskier) to a category label. */
    function _riskCategory(riskIndex) {
        if (riskIndex < 20) return 'Rendah';     // Low risk
        if (riskIndex < 35) return 'Sedang';     // Medium
        if (riskIndex < 50) return 'Waspada';    // Caution
        return 'Tinggi';                          // High risk
    }

    /**
     * Build Risk Matrix.  [FIX-1] Sorted by riskIndex DESC (highest danger first).
     * [FIX-4] Each row includes a drivers sub-object.
     * [FIX-5] Each row includes a trends sub-object.
     * [FIX-6] Unified output structure.
     *
     * @param  {Object[]} units — output of aggregateUnitMetrics()
     * @returns {Array<{
     *   unit       : string,
     *   npl        : number,
     *   sml        : number,
     *   riskScore  : number,
     *   riskIndex  : number,
     *   category   : string,
     *   drivers    : { npl: number, sml: number, growth: number },
     *   trends     : { nplTrend: Object }
     * }>}
     */
    function buildRiskMatrix(units) {
        return units
            .map(u => {
                const s = calculateRiskScore(u);
                const nplTrend = _computeNplTrend(u._nplPeriods || {});

                return {
                    // [FIX-6] Unified structure
                    unit:       u.unit,
                    npl:        u.avgNPL,
                    sml:        u.avgSML,
                    riskScore:  s.riskScore,
                    riskIndex:  s.riskIndex,   // [FIX-1]
                    category:   _riskCategory(s.riskIndex),
                    // [FIX-4] Driver breakdown
                    drivers: {
                        npl:    s.nplScore,
                        sml:    s.smlScore,
                        growth: s.growthScore,
                    },
                    // [FIX-5] Trend metrics
                    trends: {
                        nplTrend,
                    },
                };
            })
            .sort((a, b) => b.riskIndex - a.riskIndex);  // [FIX-1] highest danger first
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 5b — GROWTH MATRIX
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build Growth Matrix.  Sorted by growthScore DESC (highest growth first).
     * [FIX-4] Each row includes a drivers sub-object.
     * [FIX-6] Unified output structure.
     *
     * @param  {Object[]} units — output of aggregateUnitMetrics()
     * @returns {Array<{
     *   unit          : string,
     *   casaGrowth    : number,
     *   lendingGrowth : number,
     *   channelGrowth : number,
     *   giroGrowth    : number,
     *   tabunganGrowth: number,
     *   growthScore   : number,
     *   riskScore     : number,
     *   riskIndex     : number,
     *   drivers       : { npl: number, sml: number, growth: number },
     *   trends        : { nplTrend: Object }
     * }>}
     */
    function buildGrowthMatrix(units) {
        const gs = _growthStats(units);   // computed once for consistent normalization

        return units
            .map(u => {
                const gScores  = calculateGrowthScore(u, gs);
                const rScores  = calculateRiskScore(u);
                const nplTrend = _computeNplTrend(u._nplPeriods || {});

                return {
                    // [FIX-6] Unified structure
                    unit:           u.unit,
                    casaGrowth:     u.casaGrowth,
                    lendingGrowth:  u.lendingGrowth,
                    channelGrowth:  u.channelGrowth,
                    giroGrowth:     u.giroGrowth,       // [FIX-3]
                    tabunganGrowth: u.tabunganGrowth,   // [FIX-3]
                    growthScore:    gScores.growthScore,
                    riskScore:      rScores.riskScore,
                    riskIndex:      rScores.riskIndex,  // [FIX-1] — context for decision engine
                    // [FIX-4] Driver breakdown
                    drivers: {
                        npl:    rScores.nplScore,
                        sml:    rScores.smlScore,
                        growth: gScores.growthScore,
                    },
                    // [FIX-5]
                    trends: {
                        nplTrend,
                    },
                    // Normalised sub-scores (for explainability)
                    _norm: {
                        casaNorm:      gScores.casaNorm,
                        lendingNorm:   gScores.lendingNorm,
                        channelNorm:   gScores.channelNorm,
                        giroNorm:      gScores.giroNorm,
                        tabunganNorm:  gScores.tabunganNorm,
                    },
                };
            })
            .sort((a, b) => b.growthScore - a.growthScore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API — CONVENIENCE RUNNER
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * One-shot runner: takes raw DB data, returns all matrices + unit metrics.
     *
     * @param  {Object[]} data  — from dbManager.getAllData()
     * @returns {{
     *   unitMetrics  : Object[],   // per-unit aggregated metrics with sml, trends
     *   riskMatrix   : Object[],   // sorted high-risk-first, includes drivers + trends
     *   growthMatrix : Object[],   // sorted high-growth-first, includes drivers + riskIndex
     * }}
     */
    function run(data) {
        const unitMetrics  = aggregateUnitMetrics(data);
        const riskMatrix   = buildRiskMatrix(unitMetrics);
        const growthMatrix = buildGrowthMatrix(unitMetrics);
        return { unitMetrics, riskMatrix, growthMatrix };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPORTS
    // ─────────────────────────────────────────────────────────────────────────
    return {
        // Main API
        run,
        aggregateUnitMetrics,
        calculateRiskScore,
        calculateGrowthScore,
        buildRiskMatrix,
        buildGrowthMatrix,
        // Internals exposed for downstream engines / testing
        _growthStats,
        _computeNplTrend,
        _nplTierScore,
        _smlTierScore,
        _normalizeGrowth,
        clampGrowth,
        // Constants
        GROWTH_FLOOR,
        GROWTH_CAP,
        TREND_PERIODS,
    };
})();
