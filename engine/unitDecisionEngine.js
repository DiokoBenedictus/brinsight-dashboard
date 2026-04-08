/**
 * unitDecisionEngine.js — BRInsight Unit Decision Support System
 * ──────────────────────────────────────────────────────────────
 * Deterministic DSS. NO LLM. NO recomputation of analytics.
 * Consumes analyticsEngine output directly.
 *
 * Input contract per unit (merged riskMatrix + growthMatrix row):
 * { unit, npl, sml, riskScore, riskIndex, growthScore,
 *   casaGrowth, giroGrowth, tabunganGrowth, lendingGrowth, channelGrowth,
 *   category, drivers: { npl, sml, growth },
 *   trends: { nplTrend: { direction, delta, values } } }
 *
 * Exposed as: window.unitDecisionEngine
 */

window.unitDecisionEngine = (function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1 — PRIORITY SCORING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * High risk + low growth = highest priority.
     * riskIndex: 0-100 (higher = more dangerous)
     * growthScore: 0-100 (higher = stronger growth)
     */
    function calculatePriorityScore(unit) {
        return +((0.6 * unit.riskIndex) + (0.4 * (100 - unit.growthScore))).toFixed(2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2 — ROOT CAUSE DETECTION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Deterministic rule cascade — returns the PRIMARY root cause string.
     * Priority: structural credit risk > SML pipeline > funding leakage > digital
     */
    function detectRootCause(unit) {
        const d   = unit.drivers || {};
        const t   = unit.trends?.nplTrend || {};
        const npl = unit.npl ?? 0;
        const sml = unit.sml ?? 0;

        // Rule 1: High NPL + deteriorating trend → structural credit risk
        if (d.npl < 60 && t.direction === 'deteriorating') {
            return `Risiko kredit struktural — NPL ${npl.toFixed(2)}% meningkat ${Math.abs(t.delta ?? 0).toFixed(2)}pp dalam 3 periode. Diperlukan restrukturisasi portofolio menyeluruh.`;
        }

        // Rule 2: High NPL (without deteriorating trend)
        if (d.npl < 60) {
            return `Kualitas kredit bermasalah — NPL ${npl.toFixed(2)}% melampaui ambang batas regulasi. Identifikasi debitur berisiko dan eskalasi ke komite kredit.`;
        }

        // Rule 3: High SML → early warning pipeline risk
        if (d.sml < 55) {
            return `Early warning pipeline risk — SML ${sml.toFixed(2)}% tinggi, indikasi potensi sliding kredit ke macet. Aktifkan koleksi dini sebelum NPL meningkat.`;
        }

        // Rule 4: Funding leakage (CASA negative)
        const casaG = unit.casaGrowth ?? 0;
        const giroG = unit.giroGrowth ?? 0;
        const tabG  = unit.tabunganGrowth ?? 0;
        if (casaG < 0 || (giroG < 0 && tabG < 0)) {
            return `Kebocoran DPK — pertumbuhan CASA ${casaG.toFixed(2)}% negatif. Nasabah beralih ke kompetitor atau produk deposito berbiaya tinggi.`;
        }

        // Rule 5: Weak channel growth → low digital adoption
        if (d.growth < 45) {
            return `Adopsi digital rendah — growth score channel ${d.growth?.toFixed(1) ?? '–'} di bawah target. Akselerasi onboarding BRImo, QRIS, dan Qlola diperlukan.`;
        }

        return `Unit dalam kondisi optimal. Fokus pertumbuhan berkelanjutan dan pemantauan dini indikator risiko.`;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3 — ACTION GENERATION
    // ─────────────────────────────────────────────────────────────────────────

    /** Generate max 5 specific, prioritized actions. */
    function generateActions(unit) {
        const actions = [];
        const d   = unit.drivers || {};
        const t   = unit.trends?.nplTrend || {};
        const npl = unit.npl ?? 0;
        const sml = unit.sml ?? 0;

        // Action: NPL recovery + restructuring
        if (d.npl < 70) {
            actions.push(`Recovery NPL: identifikasi top-10 debitur bermasalah (NPL ${npl.toFixed(2)}%) dan jadwalkan kunjungan fisik minggu ini beserta proposal restrukturisasi kepada Komite Kredit.`);
        }

        // Action: NPL trend escalation
        if (t.direction === 'deteriorating' && (t.delta ?? 0) > 0.1) {
            actions.push(`Eskalasi tren: NPL naik ${(t.delta ?? 0).toFixed(2)}pp dalam 3 periode — ajukan exception report ke Regional Manager dan siapkan action plan 30 hari.`);
        }

        // Action: SML early collection
        if (d.sml < 70) {
            actions.push(`Early collection SML: aktifkan tim collection untuk debitur SML (estimasi ${sml.toFixed(2)}%) — target konversi ke lancar dalam 45 hari sebelum jatuh ke NPL.`);
        }

        // Action: CASA depositor engagement
        const casaG = unit.casaGrowth ?? 0;
        const giroG = unit.giroGrowth ?? 0;
        const tabG  = unit.tabunganGrowth ?? 0;
        if (casaG < 1 || giroG < 0 || tabG < 0) {
            actions.push(`CASA acquisition: bundling giro payroll + tabungan BritAma — target 50 rekening baru per unit minggu ini, libatkan nasabah korporasi eksisting.`);
        }

        // Action: Lending pipeline acceleration
        if ((unit.lendingGrowth ?? 0) < 1.5) {
            actions.push(`Pipeline kredit: review 20 aplikasi di pre-approval — percepat analisis dan jadwalkan komite kredit harian selama 2 minggu ke depan.`);
        }

        // Action: Digital activation
        if (d.growth < 55) {
            actions.push(`Digital activation: kampanye 100 merchant QRIS baru + 200 onboarding BRImo — assign relationship officer per target dengan laporan harian ke pimpinan.`);
        }

        return actions.slice(0, 5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4 — UNIT DECISION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a full unit decision object.
     * `priority` label is a placeholder — overwritten by generateGlobalDecision().
     */
    function generateDecision(unit) {
        const priorityScore = calculatePriorityScore(unit);
        const rootCause     = detectRootCause(unit);
        const actions       = generateActions(unit);

        const npl = unit.npl ?? 0;
        const impacts = [];
        if (npl > 3)
            impacts.push(`Potensi penurunan NPL ${(npl * 0.12).toFixed(2)}pp dalam 60 hari dengan koleksi terstruktur`);
        if ((unit.lendingGrowth ?? 0) < 1.5)
            impacts.push(`Potensi akselerasi kredit +${Math.max(1.5, (unit.lendingGrowth ?? 0) + 2.5).toFixed(1)}% MoM dari percepatan pipeline`);
        if ((unit.casaGrowth ?? 0) < 1)
            impacts.push(`Potensi DPK baru ~Rp 15–30 M dari program CASA intensif`);
        const expectedImpact = impacts.length
            ? impacts.join(' · ')
            : 'Pertahankan momentum — optimasi portofolio untuk pertumbuhan profitabel berkelanjutan';

        return {
            unit:          unit.unit,
            priority:      'MEDIUM',   // placeholder; set by generateGlobalDecision
            priorityScore,
            riskIndex:     unit.riskIndex   ?? 0,
            riskScore:     unit.riskScore   ?? 0,
            growthScore:   unit.growthScore ?? 0,
            npl,
            sml:           unit.sml           ?? 0,
            casaGrowth:    unit.casaGrowth    ?? 0,
            giroGrowth:    unit.giroGrowth    ?? 0,
            tabunganGrowth:unit.tabunganGrowth ?? 0,
            lendingGrowth: unit.lendingGrowth  ?? 0,
            channelGrowth: unit.channelGrowth  ?? 0,
            category:      unit.category      ?? 'Sedang',
            rootCause,
            actions,
            expectedImpact,
            drivers:       unit.drivers || {},
            trends:        unit.trends  || {},
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 5 — GLOBAL DECISION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Synthesize a branch-level global decision from all unit decisions.
     * - Sorts by priorityScore DESC
     * - Assigns priority labels: top 30% HIGH, mid 40% MEDIUM, rest LOW
     * - Detects systemic focus area
     * - Produces summary + consolidated top-5 actions
     */
    function generateGlobalDecision(decisions) {
        if (!decisions || decisions.length === 0) return null;

        const sorted = [...decisions].sort((a, b) => b.priorityScore - a.priorityScore);
        const n      = sorted.length;

        // Assign priority labels based on population percentile
        const top30 = Math.max(1, Math.ceil(n * 0.30));
        const mid40 = Math.max(1, Math.ceil(n * 0.40));
        sorted.forEach((d, i) => {
            d.priority = i < top30 ? 'HIGH' : i < top30 + mid40 ? 'MEDIUM' : 'LOW';
        });

        const avgRiskIndex    = +(sorted.reduce((s, d) => s + d.riskIndex,   0) / n).toFixed(2);
        const avgGrowthScore  = +(sorted.reduce((s, d) => s + d.growthScore, 0) / n).toFixed(2);
        const criticalCount   = sorted.filter(d => d.priority === 'HIGH').length;
        const top3            = sorted.slice(0, 3);

        // Systemic focus area
        const thresh = Math.ceil(n * 0.40);
        let focusArea;
        if      (sorted.filter(d => d.riskIndex  > 50).length          >= thresh) focusArea = 'Credit Risk Management';
        else if (sorted.filter(d => d.casaGrowth < 0).length           >= thresh) focusArea = 'CASA & Funding Recovery';
        else if (sorted.filter(d => d.growthScore < 45).length         >= thresh) focusArea = 'Growth Acceleration';
        else if (sorted.filter(d => d.channelGrowth < 2).length        >= thresh) focusArea = 'Digital Channel Activation';
        else                                                                        focusArea = 'Portfolio Optimization';

        const topNames = top3.map(d => d.unit.replace('KCP ', '').replace('KC ', 'KC ')).join(', ');
        const summary  = [
            `${criticalCount} dari ${n} unit memerlukan intervensi segera (prioritas HIGH).`,
            `Risk Index rata-rata: ${avgRiskIndex} | Growth Score rata-rata: ${avgGrowthScore}.`,
            `Unit dengan prioritas tertinggi: ${topNames}.`,
            `Fokus strategis hari ini: ${focusArea}.`,
        ].join(' ');

        // Consolidated unique actions from top 3
        const seen = new Set();
        const consolidatedActions = [];
        for (const d of top3) {
            for (const a of d.actions) {
                const key = a.substring(0, 35);
                if (!seen.has(key)) {
                    seen.add(key);
                    const shortUnit = d.unit.replace('KCP ', '').replace('KC ', 'KC ');
                    consolidatedActions.push(`[${shortUnit}] ${a}`);
                }
                if (consolidatedActions.length >= 5) break;
            }
            if (consolidatedActions.length >= 5) break;
        }

        return {
            priority:       sorted[0]?.priority || 'MEDIUM',
            focusArea,
            summary,
            actions:        consolidatedActions,
            topUnits:       top3,
            allDecisions:   sorted,
            avgRiskIndex,
            avgGrowthScore,
            criticalCount,
            n,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    return { calculatePriorityScore, detectRootCause, generateActions, generateDecision, generateGlobalDecision };
})();
