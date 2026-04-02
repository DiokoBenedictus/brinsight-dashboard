/**
 * strategyEngine.js — Strategy Alignment Engine
 * BRInsight SDSS | Phase 2
 *
 * Goal: Measure how well the branch execution aligns with bank strategy:
 *   1. SME & Commercial as new growth engine
 *   2. "Loan follow transaction" — borrowers should use CASA & digital channels
 *   3. CASA retention is critical — DPK must grow in step with lending
 *
 * HARD RULE (Critical Misalignment):
 *   If a unit's lending share >> its CASA share → flag "LOAN_WITHOUT_CASA"
 *   This directly violates the bank's ecosystem strategy.
 */

window.strategyEngine = (function () {

    // Strategy weights for alignment score
    const WEIGHTS = {
        smeContribution:  0.35,   // SME + Ritel lending as % of total
        casaRetention:    0.35,   // Unit CASA share proportional to lending share
        ecosystemUsage:   0.30    // QRIS + Qlola volume vs total DPK
    };

    // Thresholds
    const SME_TARGET_RATIO         = 0.20;   // SME should be >= 20% of total lending
    const LOAN_WITHOUT_CASA_FACTOR = 1.5;    // lendingShare > casaShare * 1.5 → flag
    const ECOSYSTEM_TARGET_RATIO   = 0.08;   // (QRIS + Qlola) / DPK >= 8%

    /**
     * Clamp a value between 0 and 100.
     */
    function clamp100(v) { return Math.min(100, Math.max(0, v)); }

    /**
     * Convert a ratio (0–1) to a score vs a target (0–1).
     * Returns 100 if ratio >= target, scales linearly below.
     */
    function ratioScore(ratio, target) {
        if (target <= 0) return 100;
        return clamp100((ratio / target) * 100);
    }

    /**
     * Analyze strategy alignment for the current filtered dataset.
     *
     * @param {Object[]} lending - filtered Lending records
     * @param {Object[]} funding - filtered Funding records
     * @param {Object[]} channel - filtered Channel records
     * @returns {{
     *   smeContributionRatio: number,
     *   smeScore: number,
     *   casaRetentionScore: number,
     *   ecosystemScore: number,
     *   alignmentScore: number,
     *   alignmentGrade: 'A'|'B'|'C'|'D',
     *   loanWithoutCasaUnits: string[],
     *   unitAlignments: Array,
     *   keyFindings: string[]
     * }}
     */
    function analyze(lending, funding, channel) {
        if (!lending.length && !funding.length) {
            return _emptyResult();
        }

        const totalLending = lending.reduce((s, i) => s + i.nominal, 0);
        const totalCasa    = funding
            .filter(f => !f.produk.toLowerCase().includes('deposito'))
            .reduce((s, i) => s + i.nominal, 0);
        const totalDpk     = funding.reduce((s, i) => s + i.nominal, 0);

        // ── 1. SME / Commercial Contribution ──────────────────────────────────
        const smeLending = lending
            .filter(l => l.segmen === 'SME' || l.segmen === 'Ritel')
            .reduce((s, i) => s + i.nominal, 0);
        const smeRatio = totalLending > 0 ? smeLending / totalLending : 0;
        const smeScore = ratioScore(smeRatio, SME_TARGET_RATIO);

        // ── 2. CASA Retention — per unit cross-reference ─────────────────────
        const units = [...new Set([
            ...lending.map(l => l.unit),
            ...funding.map(f => f.unit)
        ])].sort();

        const loanWithoutCasaUnits = [];
        const unitAlignments = units.map(unit => {
            const uLending = lending.filter(l => l.unit === unit).reduce((s, i) => s + i.nominal, 0);
            const uCasa    = funding
                .filter(f => f.unit === unit && !f.produk.toLowerCase().includes('deposito'))
                .reduce((s, i) => s + i.nominal, 0);

            const lendingShare = totalLending > 0 ? uLending / totalLending : 0;
            const casaShare    = totalCasa    > 0 ? uCasa    / totalCasa    : 0;

            // Hard rule: lending share disproportionately larger than CASA share
            const hasLoanWithoutCasa = casaShare > 0
                ? lendingShare > casaShare * LOAN_WITHOUT_CASA_FACTOR
                : uLending > 0;

            if (hasLoanWithoutCasa) loanWithoutCasaUnits.push(unit);

            // Unit SME lending
            const uSme = lending
                .filter(l => l.unit === unit && (l.segmen === 'SME' || l.segmen === 'Ritel'))
                .reduce((s, i) => s + i.nominal, 0);
            const uSmeRatio = uLending > 0 ? uSme / uLending : 0;

            return {
                unit,
                lendingTotal:  uLending,
                casaTotal:     uCasa,
                lendingShare:  parseFloat((lendingShare * 100).toFixed(1)),
                casaShare:     parseFloat((casaShare * 100).toFixed(1)),
                smeRatio:      parseFloat((uSmeRatio * 100).toFixed(1)),
                hasLoanWithoutCasa,
                alignmentFlag: hasLoanWithoutCasa ? 'LOAN_WITHOUT_CASA' : 'ALIGNED'
            };
        });

        // Overall CASA retention score — penalize for every LOAN_WITHOUT_CASA unit
        const alignedUnits  = unitAlignments.filter(u => !u.hasLoanWithoutCasa).length;
        const casaRetentionScore = units.length > 0
            ? clamp100((alignedUnits / units.length) * 100)
            : 100;

        // ── 3. Ecosystem Usage (QRIS + Qlola) vs DPK ─────────────────────────
        const ecosystemVolume = channel
            .filter(c => ['QRIS', 'Qlola'].includes(c.produk))
            .reduce((s, i) => s + i.nominal, 0);
        const ecosystemRatio = totalDpk > 0 ? ecosystemVolume / totalDpk : 0;
        const ecosystemScore = ratioScore(ecosystemRatio, ECOSYSTEM_TARGET_RATIO);

        // ── Composite Alignment Score ─────────────────────────────────────────
        const alignmentScore = clamp100(
            smeScore       * WEIGHTS.smeContribution +
            casaRetentionScore * WEIGHTS.casaRetention +
            ecosystemScore * WEIGHTS.ecosystemUsage
        );

        const alignmentGrade =
            alignmentScore >= 80 ? 'A' :
            alignmentScore >= 60 ? 'B' :
            alignmentScore >= 40 ? 'C' : 'D';

        // ── Key Findings (human-readable strings) ─────────────────────────────
        const keyFindings = [];

        if (smeRatio < SME_TARGET_RATIO) {
            keyFindings.push(
                `Kontribusi SME/Ritel ${(smeRatio * 100).toFixed(1)}% — di bawah target ${(SME_TARGET_RATIO * 100).toFixed(0)}%`
            );
        } else {
            keyFindings.push(
                `Kontribusi SME/Ritel ${(smeRatio * 100).toFixed(1)}% — sesuai target`
            );
        }

        if (loanWithoutCasaUnits.length > 0) {
            keyFindings.push(
                `⚠️ LOAN WITHOUT CASA terdeteksi di: ${loanWithoutCasaUnits.join(', ')}`
            );
        }

        if (ecosystemRatio < ECOSYSTEM_TARGET_RATIO) {
            keyFindings.push(
                `Ecosystem usage (QRIS+Qlola) ${(ecosystemRatio * 100).toFixed(1)}% dari DPK — di bawah target ${(ECOSYSTEM_TARGET_RATIO * 100).toFixed(0)}%`
            );
        }

        return {
            smeContributionRatio: parseFloat((smeRatio * 100).toFixed(1)),
            smeScore:             Math.round(smeScore),
            casaRetentionScore:   Math.round(casaRetentionScore),
            ecosystemScore:       Math.round(ecosystemScore),
            ecosystemRatio:       parseFloat((ecosystemRatio * 100).toFixed(1)),
            alignmentScore:       Math.round(alignmentScore),
            alignmentGrade,
            loanWithoutCasaUnits,
            hasLoanWithoutCasa:   loanWithoutCasaUnits.length > 0,
            unitAlignments,
            keyFindings,
            totals: { totalLending, totalCasa, totalDpk, ecosystemVolume }
        };
    }

    function _emptyResult() {
        return {
            smeContributionRatio: 0, smeScore: 0, casaRetentionScore: 0,
            ecosystemScore: 0, ecosystemRatio: 0, alignmentScore: 0,
            alignmentGrade: 'D', loanWithoutCasaUnits: [], hasLoanWithoutCasa: false,
            unitAlignments: [], keyFindings: [], totals: {}
        };
    }

    return { analyze, WEIGHTS };
})();
