/**
 * riskEngine.js — BRInsight Modular Risk Engine v1.1
 * ─────────────────────────────────────────────────────
 * Implements parameter-based risk assessment for 7 banking risk types.
 * Scoring scale: 1 (best/lowest risk) → 5 (worst/highest risk)
 *
 * Public API (window.riskEngine):
 *   .calculateParameterScore(value, paramConfig)   → { score, band, label }
 *   .calculateRiskTypeScore(paramValues, typeConfig) → { score, breakdown }
 *   .calculateCompositeScore(riskTypeValues)         → { score, grade, label, breakdown }
 *   .evaluate(unitData, config)                      → full risk report for one unit
 *   .evaluateAll(allUnitsData, config)               → sorted risk reports for all units
 *   .loadConfig()                                    → fetches riskConfig.json (async)
 *
 * Depends on: riskConfig.json (loaded once at init)
 * Compatible with: BRInsight SDSS | existing engine namespace (window.*)
 */

window.riskEngine = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL UTILITIES
    // ─────────────────────────────────────────────────────────────────────────

    /** Round to N decimal places. */
    const r = (n, dp = 2) => +n.toFixed(dp);

    /** Clamp value to [lo, hi]. */
    const clamp = (v, lo = 1, hi = 5) => Math.min(hi, Math.max(lo, v));

    /** Grade label from composite score (1–5 scale, lower = better). */
    function toGrade(score) {
        if (score <= 1.5) return 'A';
        if (score <= 2.5) return 'B';
        if (score <= 3.5) return 'C';
        if (score <= 4.5) return 'D';
        return 'E';
    }

    /** Human-readable risk level. */
    function toRiskLevel(score) {
        if (score <= 1.5) return 'Sangat Rendah';
        if (score <= 2.5) return 'Rendah';
        if (score <= 3.5) return 'Moderat';
        if (score <= 4.5) return 'Tinggi';
        return 'Sangat Tinggi';
    }

    /** Map score 1–5 to a CSS-friendly category token. */
    function toCategory(score) {
        if (score <= 1.5) return 'low';
        if (score <= 2.5) return 'low-moderate';
        if (score <= 3.5) return 'moderate';
        if (score <= 4.5) return 'high';
        return 'critical';
    }

    /** Indonesian rupiah formatter (Juta / Miliar / Triliun). */
    function fRp(n) {
        if (n >= 1e12) return 'Rp ' + r(n / 1e12, 2) + ' T';
        if (n >= 1e9)  return 'Rp ' + r(n / 1e9,  1) + ' M';
        if (n >= 1e6)  return 'Rp ' + r(n / 1e6,  0) + ' Jt';
        return 'Rp ' + Math.round(n).toLocaleString('id-ID');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INTERPRETATION LAYER — getRiskInterpretation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Map a 1–5 composite or risk-type score to a human-readable interpretation
     * with actionable urgency context.
     *
     * @param {number} score  - Risk score (1.00–5.00)
     * @returns {{
     *   level      : string,   // Short label
     *   description: string,   // Detailed description
     *   urgency    : string,   // Action urgency
     *   color      : string,   // Hex color for UI rendering
     *   icon       : string    // Emoji icon for quick visual scanning
     * }}
     */
    function getRiskInterpretation(score) {
        if (score <= 1.5) return {
            level:       'Very Low Risk',
            description: 'Kondisi sangat kuat. Seluruh indikator berada dalam zona aman.',
            urgency:     'Maintenance rutin',
            color:       '#16a34a',
            icon:        '🟢'
        };
        if (score <= 2.5) return {
            level:       'Low Risk',
            description: 'Kondisi stabil. Beberapa parameter perlu dipantau secara berkala.',
            urgency:     'Pemantauan periodik',
            color:       '#65a30d',
            icon:        '🟡'
        };
        if (score <= 3.5) return {
            level:       'Moderate Risk',
            description: 'Terdapat indikator yang membutuhkan perhatian. Tindakan pencegahan diperlukan.',
            urgency:     'Tindak lanjut dalam 30 hari',
            color:       '#d97706',
            icon:        '🟠'
        };
        if (score <= 4.5) return {
            level:       'High Risk',
            description: 'Beberapa indikator kritis terdeteksi. Eskalasi dan tindakan segera diperlukan.',
            urgency:     'Tindakan segera (dalam 7 hari)',
            color:       '#dc2626',
            icon:        '🔴'
        };
        return {
            level:       'Critical Risk',
            description: 'Kondisi darurat risiko. Intervensi manajemen senior dan remedial plan wajib dijalankan.',
            urgency:     'Eskalasi hari ini',
            color:       '#7f1d1d',
            icon:        '🚨'
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE FUNCTION 1 — calculateParameterScore
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Convert a raw parameter value into a 1–5 risk score using config thresholds.
     *
     * Algorithm:
     *   1. Iterate over threshold bands [score=1 … score=5].
     *   2. Find the band where value falls within [min, max).
     *   3. For partial bands, apply linear interpolation for sub-score precision.
     *   4. The final score is NOT interpolated between integer bands —
     *      it returns the exact integer score from the matching band, plus
     *      a decimal sub-position for explainability (e.g., 3.42 = upper-mid of band 3).
     *
     * @param {number} value          - Raw indicator value
     * @param {Object} paramConfig    - Single parameter config from riskConfig.json
     * @returns {{
     *   score      : number,   // Continuous 1.00–5.00 (interpolated within band)
     *   bandScore  : number,   // Integer band: 1, 2, 3, 4, or 5
     *   pctWithin  : number,   // How far (0–1) through the matched band
     *   label      : string,   // Human-readable risk level
     *   category   : string,   // CSS token
     *   direction  : string,   // 'higher_worse' | 'lower_worse'
     *   value      : number,   // Original value (pass-through for traceability)
     * }}
     */
    function calculateParameterScore(value, paramConfig) {
        const { thresholds, direction } = paramConfig;

        // Handle null / undefined gracefully — return neutral score
        if (value === null || value === undefined || isNaN(Number(value))) {
            return {
                score: 3, bandScore: 3, pctWithin: 0.5,
                label: 'Data Tidak Tersedia', category: 'moderate',
                direction, value: null
            };
        }

        const v = Number(value);

        // Sort thresholds ascending by score (defensive, config should already be ordered)
        const bands = [...thresholds].sort((a, b) => a.score - b.score);

        // Find matching band
        for (const band of bands) {
            const { score, min, max } = band;
            const inBand = (min <= v && v < max) || (score === 5 && v >= min);

            if (inBand) {
                // ── Compute pctWithin: distance travelled through the band [0, 1] ──
                //
                // For BOUNDED bands (both min and max are finite):
                //   pctWithin = (v - min) / (max - min)
                //
                // For OPEN-ENDED upper band (score 5, max = 999):
                //   pctWithin treated as 1.0 (top of scale)
                //
                // For OPEN-ENDED lower band (score 1 with lower_worse, min = -999):
                //   pctWithin treated as 0.0 (floor of scale)

                let pctWithin = 0.5; // safe default
                const range   = max - min;

                if (range > 0 && max < 999 && min > -999) {
                    // Bounded band — true linear interpolation
                    pctWithin = clamp((v - min) / range, 0, 1);
                } else if (max >= 999) {
                    // Open-ended upper band (score = 5 or worst bucket)
                    // Treat any value here as fully inside the worst end
                    const refRange = Math.abs(min) > 0 ? Math.abs(min) : 1;
                    pctWithin = clamp(Math.min((v - min) / refRange, 1), 0, 1);
                } else if (min <= -999) {
                    // Open-ended lower band (e.g. growth < -5%)
                    const refRange = Math.abs(max) > 0 ? Math.abs(max) : 1;
                    pctWithin = clamp(1 - Math.min(Math.abs(v - max) / refRange, 1), 0, 1);
                }

                // ── FIXED SCORING FORMULA ──────────────────────────────────────
                //
                // Rule: score must stay within [bandScore, bandScore + 1)
                //   — band 1 → [1.0 – 2.0)
                //   — band 2 → [2.0 – 3.0)
                //   — band 3 → [3.0 – 4.0)
                //   — band 4 → [4.0 – 5.0)
                //   — band 5 → capped at 5.0
                //
                // direction = "higher_worse":
                //   Higher value inside the band → closer to NEXT worse band
                //   continuousScore = bandScore + pctWithin
                //
                // direction = "lower_worse":
                //   Lower value inside the band → WORSE (closer to next worse band)
                //   continuousScore = bandScore + (1 - pctWithin)
                //
                // NOTE: We do NOT subtract 0.5. Score never drops below bandScore.

                let continuousScore;
                if (direction === 'higher_worse') {
                    continuousScore = score + pctWithin;
                } else {
                    // lower_worse: value at min of band = worst end = bandScore + 1
                    //              value at max of band = best end = bandScore + 0
                    continuousScore = score + (1 - pctWithin);
                }

                // Final clamp to valid scale [1, 5]
                continuousScore = clamp(r(continuousScore, 2), 1, 5);

                return {
                    score:      continuousScore,
                    bandScore:  score,
                    pctWithin:  r(pctWithin, 3),
                    label:      toRiskLevel(continuousScore),
                    category:   toCategory(continuousScore),
                    direction,
                    value:      v
                };
            }
        }

        // Fallback: value didn't match any band (e.g., value < min of score-1 band)
        // Return lowest risk score = 1
        return {
            score: 1, bandScore: 1, pctWithin: 0,
            label: toRiskLevel(1), category: toCategory(1),
            direction, value: v
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE FUNCTION 2 — calculateRiskTypeScore
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compute the weighted-average risk score for one risk type.
     *
     * Formula:
     *   riskTypeScore = Σ (paramWeight_i × paramScore_i) / Σ paramWeight_i
     *
     * Weights are taken from riskConfig.json parameters.
     * Missing values are excluded from the weighted sum (not penalized).
     *
     * @param {Object} paramValues   - { paramKey: rawValue, ... }
     * @param {Object} typeConfig    - Full risk type config (with .parameters)
     * @returns {{
     *   score      : number,   // Weighted average score 1.00–5.00
     *   grade      : string,
     *   riskLevel  : string,
     *   category   : string,
     *   coverage   : number,   // Fraction of parameters that had valid data
     *   breakdown  : Object,   // { paramKey: { score, bandScore, value, weight, ... } }
     *   weightedSum: number,
     *   totalWeight: number
     * }}
     */
    function calculateRiskTypeScore(paramValues, typeConfig) {
        const { parameters } = typeConfig;
        const breakdown = {};
        let weightedSum = 0;
        let totalWeight = 0;
        let presentCount = 0;
        const totalParams = Object.keys(parameters).length;

        for (const [paramKey, paramConfig] of Object.entries(parameters)) {
            const rawValue = paramValues[paramKey];
            const paramScore = calculateParameterScore(rawValue, paramConfig);

            breakdown[paramKey] = {
                ...paramScore,
                label:       paramConfig.label,
                weight:      paramConfig.weight,
                unit:        paramConfig.unit || '',
                note:        paramConfig.note  || null
            };

            // Only include in weighted sum if value is present
            if (rawValue !== null && rawValue !== undefined && !isNaN(Number(rawValue))) {
                weightedSum  += paramConfig.weight * paramScore.score;
                totalWeight  += paramConfig.weight;
                presentCount++;
            }
        }

        // Avoid division by zero (all params missing → return moderate score 3)
        const score = totalWeight > 0
            ? clamp(r(weightedSum / totalWeight, 2), 1, 5)
            : 3.0;

        return {
            score,
            grade:      toGrade(score),
            riskLevel:  toRiskLevel(score),
            category:   toCategory(score),
            coverage:   r(presentCount / totalParams, 3),
            breakdown,
            weightedSum: r(weightedSum, 4),
            totalWeight: r(totalWeight, 4)
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE FUNCTION 3 — calculateCompositeScore
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compute the composite (overall) risk score from all 7 risk type scores.
     *
     * Formula:
     *   compositeScore = Σ (riskTypeWeight_i × riskTypeScore_i) / Σ riskTypeWeight_i
     *
     * @param {Object} riskTypeScores  - { riskTypeKey: { score, ... }, ... }
     * @param {Object} config          - Full riskConfig.json
     * @returns {{
     *   score      : number,   // 1.00–5.00
     *   grade      : string,   // A–E
     *   riskLevel  : string,
     *   category   : string,
     *   breakdown  : Object,   // per risk type contribution
     *   dominantRisk: string,  // risk type key with highest score
     *   dominantRiskLabel: string
     * }}
     */
    function calculateCompositeScore(riskTypeScores, config) {
        const riskTypes = config.riskTypes;
        let weightedSum = 0;
        let totalWeight = 0;
        const breakdown = {};

        let dominantRisk = null;
        let dominantScore = -Infinity;

        for (const [typeKey, typeConfig] of Object.entries(riskTypes)) {
            const typeResult = riskTypeScores[typeKey];
            if (!typeResult) continue;

            const contrib = typeConfig.weight * typeResult.score;
            weightedSum  += contrib;
            totalWeight  += typeConfig.weight;

            breakdown[typeKey] = {
                label:       typeConfig.label,
                weight:      typeConfig.weight,
                score:       typeResult.score,
                grade:       typeResult.grade,
                riskLevel:   typeResult.riskLevel,
                category:    typeResult.category,
                contribution: r(contrib, 4),
                coverage:    typeResult.coverage
            };

            if (typeResult.score > dominantScore) {
                dominantScore = typeResult.score;
                dominantRisk  = typeKey;
            }
        }

        const compositeScore = totalWeight > 0
            ? clamp(r(weightedSum / totalWeight, 2), 1, 5)
            : 3.0;

        return {
            score:             compositeScore,
            grade:             toGrade(compositeScore),
            riskLevel:         toRiskLevel(compositeScore),
            category:          toCategory(compositeScore),
            interpretation:    getRiskInterpretation(compositeScore),   // ← NEW v1.1
            breakdown,
            dominantRisk,
            dominantRiskLabel: dominantRisk ? riskTypes[dominantRisk].label : null,
            weightedSum:       r(weightedSum, 4),
            totalWeight:       r(totalWeight, 4)
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HIGH-LEVEL FUNCTION — evaluate (single unit)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Full risk evaluation pipeline for one unit/cabang.
     *
     * Input: unitData must be flat object with all parameter keys from riskConfig.
     *        Organize by risk type: { credit: { npl_mikro: 3.2, ... }, liquidity: { ldr: 88.5, ... }, ... }
     *
     * @param {{ unit: string, [riskTypeKey]: Object }} unitData
     * @param {Object} config  - Parsed riskConfig.json
     * @returns {{
     *   unit          : string,
     *   composite     : Object,   // calculateCompositeScore output
     *   riskTypes     : Object,   // per-type calculateRiskTypeScore outputs
     *   evaluatedAt   : string,   // ISO timestamp
     *   meta          : Object    // input summary
     * }}
     */
    function evaluate(unitData, config) {
        const riskTypeScores = {};

        for (const [typeKey, typeConfig] of Object.entries(config.riskTypes)) {
            const paramValues = unitData[typeKey] || {};
            riskTypeScores[typeKey] = calculateRiskTypeScore(paramValues, typeConfig);
        }

        const composite = calculateCompositeScore(riskTypeScores, config);

        return {
            unit:        unitData.unit || 'Unknown',
            composite,
            riskTypes:   riskTypeScores,
            evaluatedAt: new Date().toISOString(),
            meta: {
                configVersion: config._meta?.version || '?',
                riskTypesCount: Object.keys(riskTypeScores).length
            }
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HIGH-LEVEL FUNCTION — evaluateAll (all units)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Evaluate all units and return sorted results (highest risk first).
     *
     * @param {Array<Object>} allUnitsData  - Array of unit data objects
     * @param {Object}        config        - Parsed riskConfig.json
     * @returns {Array<Object>}             - Sorted evaluations (highest composite score first)
     */
    function evaluateAll(allUnitsData, config) {
        return allUnitsData
            .map(unitData => evaluate(unitData, config))
            .sort((a, b) => b.composite.score - a.composite.score);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONFIG LOADER — v1.2 (file:// + server compatible)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Load riskConfig.json with a multi-path fallback strategy:
     *  1. Return cached copy if already loaded.
     *  2. Try relative path `./engine/riskConfig.json`  (works on file://).
     *  3. Try absolute root path `/engine/riskConfig.json` (works on servers).
     *  4. Fall back to window.RISK_CONFIG if both fetches fail.
     *  5. Throw only if all paths exhausted.
     */
    let _configCache = null;

    async function loadConfig() {
        // ── 1. Return cached config immediately ──────────────────────────────
        if (_configCache) return _configCache;

        // Paths tried in order: relative first (file://), then absolute (server)
        const CONFIG_PATHS = [
            './engine/riskConfig.json',
            '/engine/riskConfig.json'
        ];

        let lastErr = null;

        // ── 2 & 3. Try each path in turn ─────────────────────────────────────
        for (const path of CONFIG_PATHS) {
            try {
                const res = await fetch(path);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status} ${res.statusText}`);
                }
                _configCache = await res.json();
                console.log(
                    `[riskEngine] Config loaded from "${path}": ` +
                    `v${_configCache._meta?.version} ` +
                    `(${Object.keys(_configCache.riskTypes || {}).length} risk types)`
                );
                return _configCache;
            } catch (err) {
                console.warn(`[riskEngine] fetch "${path}" failed:`, err.message);
                lastErr = err;
            }
        }

        // ── 4. Fallback: window.RISK_CONFIG (injected inline or via <script>) ─
        if (window.RISK_CONFIG && window.RISK_CONFIG.riskTypes) {
            console.warn('[riskEngine] All fetches failed — using window.RISK_CONFIG fallback.');
            _configCache = window.RISK_CONFIG;
            return _configCache;
        }

        // ── 5. All paths exhausted ────────────────────────────────────────────
        console.error(
            '[riskEngine] FATAL: Cannot load config.\n' +
            '  • Tried: ' + CONFIG_PATHS.join(', ') + '\n' +
            '  • window.RISK_CONFIG: not defined\n' +
            '  • Last error:', lastErr
        );
        throw lastErr;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REPORTING HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate a human-readable risk summary for a single unit evaluation.
     *
     * @param {Object} evaluation - Output from evaluate()
     * @returns {string}
     */
    function buildRiskNarrative(evaluation) {
        const { unit, composite, riskTypes } = evaluation;
        const top = composite.dominantRiskLabel || 'N/A';

        const typeLines = Object.entries(riskTypes)
            .sort((a, b) => b[1].score - a[1].score)
            .map(([, t]) =>
                `  • ${t.label || '?'}: Skor ${t.score.toFixed(2)} (${t.riskLevel}) [Grade ${t.grade}]`
            )
            .join('\n');

        return (
            `=== LAPORAN RISIKO: ${unit} ===\n` +
            `Skor Komposit: ${composite.score.toFixed(2)} / 5.00\n` +
            `Grade: ${composite.grade} — ${composite.riskLevel}\n` +
            `Risiko Dominan: ${top}\n\n` +
            `Per Jenis Risiko (tertinggi → terendah):\n${typeLines}`
        );
    }

    /**
     * Extract top-N flagged parameters across all risk types for an evaluation.
     * Useful for dashboard "red flag" panels.
     *
     * @param {Object} evaluation - Output from evaluate()
     * @param {number} [n=5]      - Number of top flags to return
     * @returns {Array<{
     *   riskType: string, riskTypeLabel: string,
     *   param: string, paramLabel: string,
     *   score: number, value: number, unit: string,
     *   category: string
     * }>}
     */
    function getTopFlags(evaluation, n = 5) {
        const flags = [];

        for (const [typeKey, typeResult] of Object.entries(evaluation.riskTypes)) {
            for (const [paramKey, paramResult] of Object.entries(typeResult.breakdown)) {
                if (paramResult.value === null) continue;
                flags.push({
                    riskType:       typeKey,
                    riskTypeLabel:  typeResult.label || typeKey,
                    param:          paramKey,
                    paramLabel:     paramResult.label,
                    score:          paramResult.score,
                    bandScore:      paramResult.bandScore,
                    value:          paramResult.value,
                    unit:           paramResult.unit,
                    category:       paramResult.category
                });
            }
        }

        return flags
            .sort((a, b) => b.score - a.score)
            .slice(0, n);
    }

    /**
     * Compare two unit evaluations and return deltas per risk type.
     *
     * @param {Object} evalA - First evaluate() output
     * @param {Object} evalB - Second evaluate() output
     * @returns {Object}     - { composite: delta, riskTypes: { typeKey: delta } }
     */
    function compareUnits(evalA, evalB) {
        const compositeDelta = r(evalA.composite.score - evalB.composite.score, 2);
        const typesDeltas = {};

        const allKeys = new Set([
            ...Object.keys(evalA.riskTypes),
            ...Object.keys(evalB.riskTypes)
        ]);

        for (const key of allKeys) {
            const aScore = evalA.riskTypes[key]?.score ?? null;
            const bScore = evalB.riskTypes[key]?.score ?? null;
            typesDeltas[key] = {
                unit_a: aScore,
                unit_b: bScore,
                delta:  (aScore !== null && bScore !== null) ? r(aScore - bScore, 2) : null
            };
        }

        return {
            unit_a:    evalA.unit,
            unit_b:    evalB.unit,
            composite: compositeDelta,
            riskTypes: typesDeltas
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXPORTS
    // ─────────────────────────────────────────────────────────────────────────

    return {
        // Core scoring pipeline
        calculateParameterScore,
        calculateRiskTypeScore,
        calculateCompositeScore,

        // High-level evaluation
        evaluate,
        evaluateAll,

        // Config loader
        loadConfig,

        // Reporting utilities
        buildRiskNarrative,
        getTopFlags,
        compareUnits,

        // Interpretation layer
        getRiskInterpretation,

        // Exposed helpers for testing/extension
        _toGrade:      toGrade,
        _toRiskLevel:  toRiskLevel,
        _toCategory:   toCategory,
        _fRp:          fRp,
        _r:            r,
        _clamp:        clamp
    };

})();
