/**
 * scoringEngine.js — Branch Health Scoring Engine
 * BRInsight SDSS | Phase 2
 *
 * Goal: Compute a single composite Branch Health Score (0–100) from
 *       all engine outputs, with weighted dimensions and grade assignment.
 *
 * Dimensions & Weights:
 *   1. CASA Health       25% — CASA ratio + MoM trend
 *   2. NPL Risk          25% — weighted NPL + riskiest cohort
 *   3. Growth Momentum   20% — DPK + lending MoM trend
 *   4. Strategy Align.   20% — from strategyEngine alignmentScore
 *   5. Seasonal Stability 10% — anomaly count penalty
 */

window.scoringEngine = (function () {

    const WEIGHTS = {
        casaHealth:        0.25,
        nplRisk:           0.25,
        growthMomentum:    0.20,
        strategyAlignment: 0.20,
        seasonalStability: 0.10
    };

    // Thresholds used for normalization
    const THRESHOLDS = {
        casaRatioTarget:   0.60,   // CASA ratio target 60%
        casaRatioMin:      0.40,   // Below this = 0 score
        nplGreen:          2.0,    // NPL <= 2% = full score
        nplRed:            5.0,    // NPL >= 5% = 0 score
        momGrowthTarget:   1.5,    // % MoM target
        momGrowthMin:     -3.0,    // % MoM floor (0 score)
        maxAnomalies:      6       // >= 6 anomalies = 0 stability score
    };

    /**
     * Clamp to [0, 100].
     */
    function clamp(v) { return Math.min(100, Math.max(0, v)); }

    /**
     * Linear interpolation: map value in [lo, hi] → [0, 100].
     * Lower is better if invert=true.
     */
    function linearScore(value, lo, hi, invert = false) {
        if (hi === lo) return 50;
        const pct = (value - lo) / (hi - lo);
        return clamp(invert ? (1 - pct) * 100 : pct * 100);
    }

    /**
     * Compute CASA dimension score (0–100).
     */
    function scoreCasa(funding) {
        if (!funding || funding.length === 0) return 50;

        const totalDpk  = funding.reduce((s, i) => s + i.nominal, 0);
        const totalCasa = funding
            .filter(f => !f.produk.toLowerCase().includes('deposito'))
            .reduce((s, i) => s + i.nominal, 0);

        const casaRatio = totalDpk > 0 ? totalCasa / totalDpk : 0;

        // Score 1: CASA Ratio (0-100 mapped between 40% and 60% targets)
        const ratioScore = linearScore(casaRatio, THRESHOLDS.casaRatioMin, THRESHOLDS.casaRatioTarget);

        // Score 2: CASA MoM trend from casaRadar output (injected via compute())
        // Will be resolved externally via casaRadar.totalCasaGrowthMoM
        return ratioScore; // MoM blending done in compute()
    }

    /**
     * Compute NPL dimension score (0–100). Lower NPL = higher score.
     */
    function scoreNpl(vintage) {
        if (!vintage) return 70;
        const { totalWeightedNpl, riskiestCohort } = vintage;

        // Primary: weighted NPL (inverted: lower NPL = higher score)
        const nplScore = linearScore(totalWeightedNpl, THRESHOLDS.nplGreen, THRESHOLDS.nplRed, true);

        // Penalty if riskiest cohort is CRITICAL
        const cohortPenalty = riskiestCohort && riskiestCohort.riskLevel === 'CRITICAL' ? 15 : 0;

        return clamp(nplScore - cohortPenalty);
    }

    /**
     * Compute Growth Momentum score (0–100).
     */
    function scoreGrowth(casaRadar, seasonal) {
        let baseScore = 70; // neutral default

        // Use CASA MoM as DPK proxy
        const casaMoM = casaRadar ? casaRadar.totalCasaGrowthMoM : null;
        if (casaMoM !== null) {
            baseScore = linearScore(casaMoM, THRESHOLDS.momGrowthMin, THRESHOLDS.momGrowthTarget);
        }

        // Bonus if no anomalies (seasonal engine)
        if (seasonal && !seasonal.hasAnomalies) baseScore = clamp(baseScore + 10);

        return clamp(baseScore);
    }

    /**
     * Compute Seasonal Stability score (0–100). Fewer anomalies = higher score.
     */
    function scoreSeasonalStability(seasonal) {
        if (!seasonal) return 80;
        const anomalies = seasonal.anomalyCount || 0;
        return linearScore(anomalies, 0, THRESHOLDS.maxAnomalies, true);
    }

    /**
     * Assign grade letter from a numeric score.
     */
    function toGrade(score) {
        if (score >= 80) return 'A';
        if (score >= 65) return 'B';
        if (score >= 50) return 'C';
        return 'D';
    }

    /**
     * Human-readable health status.
     */
    function toStatus(grade) {
        return { A: 'Sehat', B: 'Perhatian', C: 'Waspada', D: 'Kritis' }[grade];
    }

    /**
     * Compute the composite branch health score.
     *
     * @param {Object} engines - { casaRadar, vintage, seasonal, strategy, funding }
     * @returns {{
     *   score: number,
     *   grade: 'A'|'B'|'C'|'D',
     *   status: string,
     *   breakdown: Object,
     *   label: string
     * }}
     */
    function compute({ casaRadar, vintage, seasonal, strategy, funding }) {

        // Dimension scores
        let casaScore = scoreCasa(funding || []);

        // Blend CASA ratio score with MoM growth signal
        if (casaRadar && casaRadar.totalCasaGrowthMoM !== null) {
            const momScore = linearScore(
                casaRadar.totalCasaGrowthMoM,
                THRESHOLDS.momGrowthMin,
                THRESHOLDS.momGrowthTarget
            );
            casaScore = clamp(casaScore * 0.6 + momScore * 0.4);
        }
        // Penalize if fund-shifting units exist
        if (casaRadar && casaRadar.fundShiftingUnits && casaRadar.fundShiftingUnits.length > 0) {
            casaScore = clamp(casaScore - casaRadar.fundShiftingUnits.length * 10);
        }

        const nplScore       = scoreNpl(vintage);
        const growthScore    = scoreGrowth(casaRadar, seasonal);
        const stratScore     = strategy ? strategy.alignmentScore : 60;
        const stabilityScore = scoreSeasonalStability(seasonal);

        // Composite weighted score
        const rawScore =
            casaScore       * WEIGHTS.casaHealth       +
            nplScore        * WEIGHTS.nplRisk          +
            growthScore     * WEIGHTS.growthMomentum   +
            stratScore      * WEIGHTS.strategyAlignment +
            stabilityScore  * WEIGHTS.seasonalStability;

        const score = Math.round(clamp(rawScore));
        const grade = toGrade(score);

        return {
            score,
            grade,
            status: toStatus(grade),
            label:  `${score}/100 — ${toStatus(grade)}`,
            breakdown: {
                casaHealth:        Math.round(casaScore),
                nplRisk:           Math.round(nplScore),
                growthMomentum:    Math.round(growthScore),
                strategyAlignment: Math.round(stratScore),
                seasonalStability: Math.round(stabilityScore)
            }
        };
    }

    return { compute, WEIGHTS, THRESHOLDS };
})();
