/**
 * decisionEngine.js — Master Decision Synthesis Engine
 * BRInsight SDSS | Phase 2 / Phase 3
 *
 * Goal: Combine all engine outputs → structured, root-cause-driven daily action plan.
 *
 * Output format:
 * {
 *   priority,       — Primary focus area for the day
 *   summary,        — One-line executive summary
 *   rootCause,      — Data-driven root cause narrative
 *   issues,         — Tagged issue list (from all engines)
 *   actions,        — Specific, unit-named, numeric-targeted action items
 *   expectedImpact, — Estimated outcome if actions are executed
 *   urgency,        — "SEGERA" | "MINGGU INI" | "BULAN INI"
 *   score,          — Branch health score (0–100)
 *   grade,          — A / B / C / D
 *   context         — Seasonal or environmental context
 * }
 */

window.decisionEngine = (function () {

    // ── Formatters ─────────────────────────────────────────────────────────────
    function fRp(n) {
        if (n >= 1e12) return 'Rp ' + (n / 1e12).toFixed(2) + ' T';
        if (n >= 1e9)  return 'Rp ' + (n / 1e9).toFixed(1) + ' M';
        if (n >= 1e6)  return 'Rp ' + (n / 1e6).toFixed(0) + ' Jt';
        return 'Rp ' + Math.round(n).toLocaleString('id-ID');
    }
    function fPct(n) { return (+n).toFixed(1) + '%'; }

    // ── Priority Scoring Matrix ────────────────────────────────────────────────
    /**
     * Compute a numeric issue score for each category.
     * The highest score determines the primary priority.
     */
    function computePriorityScores({ casaRadar, vintage, seasonal, strategy, scoring, funding, lending }) {
        const scores = {
            casaIssueScore:   0,
            nplIssueScore:    0,
            growthIssueScore: 0,
            strategyScore:    0
        };

        // ── CASA issue scoring ─────────────────────────────────────────────
        if (casaRadar) {
            if (casaRadar.fundShiftingUnits.length > 0)   scores.casaIssueScore += 40;
            if (casaRadar.declineUnits.length > 0)        scores.casaIssueScore += 25;
            if (strategy && strategy.hasLoanWithoutCasa)  scores.casaIssueScore += 20;
            if (casaRadar.totalCasaGrowthMoM !== null && casaRadar.totalCasaGrowthMoM < -2)
                scores.casaIssueScore += 15;
        }
        // CASA ratio check
        const totalDpk  = funding.reduce((s, i) => s + i.nominal, 0);
        const totalCasa = funding
            .filter(f => !f.produk.toLowerCase().includes('deposito'))
            .reduce((s, i) => s + i.nominal, 0);
        const casaRatio = totalDpk > 0 ? totalCasa / totalDpk : 0;
        if (casaRatio < 0.55) scores.casaIssueScore += 20;

        // ── NPL issue scoring ──────────────────────────────────────────────
        if (vintage) {
            if (vintage.totalWeightedNpl > 3)  scores.nplIssueScore += 40;
            if (vintage.totalWeightedNpl > 2.5) scores.nplIssueScore += 20;
            if (vintage.riskiestCohort && vintage.riskiestCohort.riskLevel === 'CRITICAL')
                scores.nplIssueScore += 15;
        }
        // Check per-unit NPL from scoring
        if (scoring && scoring.breakdown.nplRisk < 50) scores.nplIssueScore += 20;

        // ── Growth issue scoring ───────────────────────────────────────────
        if (casaRadar && casaRadar.totalCasaGrowthMoM !== null &&
            casaRadar.totalCasaGrowthMoM < 0) scores.growthIssueScore += 30;
        if (strategy && strategy.smeContributionRatio < 10) scores.growthIssueScore += 20;
        if (seasonal && seasonal.anomalyCount > 2)         scores.growthIssueScore += 15;
        if (scoring && scoring.breakdown.growthMomentum < 50) scores.growthIssueScore += 15;

        // ── Strategy issue scoring ─────────────────────────────────────────
        if (strategy) {
            if (strategy.alignmentGrade === 'D') scores.strategyScore += 25;
            if (strategy.alignmentGrade === 'C') scores.strategyScore += 15;
            if (strategy.hasLoanWithoutCasa)     scores.strategyScore += 20;
            if (strategy.smeContributionRatio < 10) scores.strategyScore += 10;
        }

        return scores;
    }

    /**
     * Pick the priority label from scores.
     */
    function resolvePriority(scores) {
        const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const topScore = entries[0][1];

        // If all scores are low → branch is healthy
        if (topScore < 15) return 'GROWTH_OPTIMIZATION';

        const map = {
            casaIssueScore:   'CASA_RECOVERY',
            nplIssueScore:    'NPL_RECOVERY',
            growthIssueScore: 'GROWTH_RECOVERY',
            strategyScore:    'STRATEGY_ALIGNMENT'
        };
        return map[entries[0][0]];
    }

    // ── Issue Collector ────────────────────────────────────────────────────────
    /**
     * Collect all detected issues as tagged strings.
     */
    function collectIssues({ casaRadar, vintage, seasonal, strategy, scoring, funding, lending }) {
        const issues = [];

        // CASA issues
        if (casaRadar) {
            casaRadar.fundShiftingUnits.forEach(u => {
                const s = casaRadar.unitStatuses.find(x => x.unit === u);
                issues.push(
                    `[CASA] Fund shifting terdeteksi di ${u} ` +
                    `(CASA ${s ? fPct(s.casaGrowthMoM) + ' MoM' : 'menurun'}, ` +
                    `channel digital masih aktif)`
                );
            });
            casaRadar.declineUnits.forEach(u => {
                issues.push(`[CASA] Penurunan bisnis di ${u} — DPK dan transaksi sama-sama turun`);
            });
        }
        const totalDpk  = funding.reduce((s, i) => s + i.nominal, 0);
        const totalCasa = funding
            .filter(f => !f.produk.toLowerCase().includes('deposito'))
            .reduce((s, i) => s + i.nominal, 0);
        const casaRatio = totalDpk > 0 ? (totalCasa / totalDpk) * 100 : 0;
        if (casaRatio < 55) {
            issues.push(`[CASA] CASA Ratio cabang ${fPct(casaRatio)} — di bawah target 60%`);
        }

        // NPL issues
        if (vintage) {
            if (vintage.totalWeightedNpl > 2) {
                issues.push(
                    `[NPL] Weighted NPL portofolio ${fPct(vintage.totalWeightedNpl)} ` +
                    `(threshold: 3%)`
                );
            }
            if (vintage.riskiestCohort && vintage.riskiestCohort.riskLevel !== 'LOW') {
                issues.push(
                    `[NPL] Cohort ${vintage.riskiestCohort.year} paling berisiko — ` +
                    `NPL ${fPct(vintage.riskiestCohort.weightedNpl)}, ` +
                    `eksposur ${fRp(vintage.riskiestCohort.nplExposure)}`
                );
            }
        }

        // Strategy misalignment issues  
        if (strategy) {
            strategy.loanWithoutCasaUnits.forEach(u => {
                const ua = strategy.unitAlignments.find(x => x.unit === u);
                issues.push(
                    `[STRATEGI] LOAN WITHOUT CASA di ${u} — ` +
                    `porsi kredit ${ua ? fPct(ua.lendingShare) : '?'} vs ` +
                    `CASA ${ua ? fPct(ua.casaShare) : '?'} dari total`
                );
            });
            if (strategy.smeContributionRatio < 15) {
                issues.push(
                    `[STRATEGI] SME/Ritel hanya ${fPct(strategy.smeContributionRatio)} dari total kredit ` +
                    `— belum menjadi growth engine`
                );
            }
        }

        // Seasonal anomalies
        if (seasonal && seasonal.anomalies.length > 0) {
            const worst = seasonal.anomalies[0];
            issues.push(
                `[SEASONAL] Anomali ${worst.type} ${worst.month}: ` +
                `${worst.momGrowth !== null ? fPct(worst.momGrowth) + ' MoM' : ''}` +
                `${worst.specialPeriod ? '' : ' (bukan periode musiman)'}`
            );
        }

        return issues.length > 0 ? issues : ['[INFO] Tidak ada isu kritis terdeteksi saat ini'];
    }

    // ── Action Generator ───────────────────────────────────────────────────────
    /**
     * Generate specific, unit-named, numeric-targeted actions.
     */
    function generateActions(priority, { casaRadar, vintage, seasonal, strategy, funding, lending, channel }) {
        const actions = [];

        // Helper: get top N units by CASA volume
        function topCasaUnits(n) {
            if (!casaRadar || !casaRadar.unitStatuses) return [];
            return [...casaRadar.unitStatuses]
                .sort((a, b) => b.casaTotal - a.casaTotal)
                .slice(0, n)
                .map(u => u.unit);
        }

        // Helper: get unit with worst NPL from vintage cohorts
        function worstNplUnitFromLending() {
            const byUnit = {};
            lending.forEach(l => {
                if (l.npl === null) return;
                if (!byUnit[l.unit]) byUnit[l.unit] = { nplSum: 0, nomSum: 0 };
                byUnit[l.unit].nplSum += l.nominal * (l.npl / 100);
                byUnit[l.unit].nomSum += l.nominal;
            });
            let worst = null, worstNpl = 0;
            Object.entries(byUnit).forEach(([unit, d]) => {
                const avg = d.nomSum > 0 ? (d.nplSum / d.nomSum) * 100 : 0;
                if (avg > worstNpl) { worstNpl = avg; worst = unit; }
            });
            return { unit: worst, npl: worstNpl };
        }

        // Helper: estimate recovery target (5% of NPL exposure)
        function recoveryTarget() {
            if (!vintage || !vintage.riskiestCohort) return '';
            const target = vintage.riskiestCohort.nplExposure * 0.05;
            return target > 0 ? ` — target recovery ${fRp(target)} bulan ini` : '';
        }

        if (priority === 'CASA_RECOVERY') {
            // Action 1: Contact top depositors in fund-shifting units
            if (casaRadar && casaRadar.fundShiftingUnits.length > 0) {
                const unit = casaRadar.fundShiftingUnits[0];
                const unitData = casaRadar.unitStatuses.find(u => u.unit === unit);
                const threshold = unitData ? fRp(unitData.casaTotal * 0.10) : 'Rp 100Jt';
                actions.push(
                    `Hubungi 5 deposan terbesar ${unit} (>${threshold}) — konfirmasi retensi & investigasi tujuan dana keluar`
                );
            }
            // Action 2: Push payroll accounts in LOAN_WITHOUT_CASA units
            if (strategy && strategy.loanWithoutCasaUnits.length > 0) {
                const unit = strategy.loanWithoutCasaUnits[0];
                actions.push(
                    `Dorong cross-sell rekening gaji (Qlola) ke debitur aktif ${unit} — target +20 rekening minggu ini`
                );
            }
            // Action 3: Track fund beneficiaries
            if (casaRadar && casaRadar.fundShiftingUnits.length > 0) {
                actions.push(
                    `Lacak tujuan dana keluar ${casaRadar.fundShiftingUnits.join(' & ')} — identifikasi bank tujuan dan ajukan penawaran deposito kompetitif`
                );
            }
            // Action 4: Boost QRIS merchant at low-CASA units
            const lowCasaUnit = strategy && strategy.loanWithoutCasaUnits.length > 0
                ? strategy.loanWithoutCasaUnits[strategy.loanWithoutCasaUnits.length - 1]
                : (casaRadar ? casaRadar.highestRiskUnit : null);
            if (lowCasaUnit) {
                actions.push(
                    `Aktivasi QRIS merchant baru di ${lowCasaUnit} — target +10 merchant, tingkatkan stickiness nasabah`
                );
            }
            // Action 5: Retention call for top CASA volume units
            const top = topCasaUnits(1)[0];
            if (top) {
                actions.push(
                    `Jadwalkan kunjungan relationship manager ke nasabah korporat ${top} minggu ini untuk program loyalitas`
                );
            }
        }

        else if (priority === 'NPL_RECOVERY') {
            const { unit: worstUnit, npl: worstNpl } = worstNplUnitFromLending();
            const recovery = recoveryTarget();

            if (worstUnit) {
                actions.push(
                    `Review 5 debitur NPL kategori D/E terbesar di ${worstUnit} (NPL ${fPct(worstNpl)})${recovery}`
                );
            }
            if (vintage && vintage.riskiestCohort) {
                actions.push(
                    `Prioritaskan restrukturisasi kredit cohort ${vintage.riskiestCohort.year} ` +
                    `(NPL ${fPct(vintage.riskiestCohort.weightedNpl)}, eksposur ${fRp(vintage.riskiestCohort.nplExposure)})`
                );
            }
            actions.push(
                `Koordinasi dengan Tim Remedial — kirim daftar debitur macet ${worstUnit || 'prioritas'} untuk penanganan minggu ini`
            );
            actions.push(
                `Pasang hold marketing kredit baru di ${worstUnit || 'unit kritis'} hingga NPL turun ke bawah 3%`
            );
            if (strategy && strategy.loanWithoutCasaUnits.length > 0) {
                actions.push(
                    `Audit kredit tanpa CASA di ${strategy.loanWithoutCasaUnits[0]} — validasi tujuan penggunaan dana dan kapasitas bayar`
                );
            }
        }

        else if (priority === 'STRATEGY_ALIGNMENT') {
            if (strategy && strategy.loanWithoutCasaUnits.length > 0) {
                const u = strategy.loanWithoutCasaUnits[0];
                actions.push(
                    `Wajibkan pembukaan rekening CASA bagi setiap debitur baru di ${u} — implementasi mulai pekan ini`
                );
            }
            if (strategy && strategy.smeContributionRatio < 15) {
                actions.push(
                    `Tambah 3 prospect SME baru dari database industri lokal — fokus sektor ${_topSmeIndustry(lending)}`
                );
            }
            if (strategy && strategy.ecosystemRatio < 8) {
                const units = (strategy.unitAlignments || [])
                    .filter(u => u.smeRatio < 10)
                    .map(u => u.unit).slice(0, 2).join(' & ');
                actions.push(
                    `Dorong adopsi Qlola di ${units || 'unit SME'} — target payroll 5 perusahaan baru bulan ini`
                );
            }
            actions.push(
                `Buat laporan pipeline SME/Commercial minggu ini untuk dilaporkan ke Area Manager`
            );
            actions.push(
                `Review kontribusi setiap unit terhadap CASA dan kredit — pastikan loan-follow-transaction berjalan`
            );
        }

        else if (priority === 'GROWTH_RECOVERY') {
            if (casaRadar && casaRadar.totalCasaGrowthMoM !== null &&
                casaRadar.totalCasaGrowthMoM < 0) {
                actions.push(
                    `Akselerasi penghimpunan DPK — target tumbuh ${fPct(Math.abs(casaRadar.totalCasaGrowthMoM) + 1.5)} MoM di seluruh unit`
                );
            }
            if (seasonal && seasonal.anomalies.length > 0) {
                const a = seasonal.anomalies[0];
                actions.push(
                    `Investigasi anomali ${a.type} bulan ${a.month} — cek apakah ada perubahan nasabah besar atau kompetitor`
                );
            }
            actions.push(
                `Percepat penyaluran KUR Mikro — review pipeline kredit yang pending approval di semua unit`
            );
            actions.push(
                `Koordinasi dengan marketing untuk program bundling tabungan + asuransi untuk menambah DPK baru`
            );
            actions.push(
                `Pantau posisi LDR cabang — pastikan DPK tumbuh proporsional terhadap kredit yang disalurkan`
            );
        }

        else { // GROWTH_OPTIMIZATION — branch is healthy
            actions.push(
                `Pertahankan momentum — review target kuartalan dan pastikan semua unit on-track`
            );
            actions.push(
                `Eksplorasi SME baru di sektor yang belum terpenetrasi — gunakan data QRIS merchant sebagai lead`
            );
            actions.push(
                `Tingkatkan cross-sell produk digital (BRImo) ke debitur eksisting untuk meningkatkan wallet share`
            );
            actions.push(
                `Siapkan laporan kinerja bulanan untuk Area Manager — highlight unit dengan pertumbuhan terbaik`
            );
        }

        return actions.slice(0, 5); // max 5 actions
    }

    /**
     * Helper: guess top SME industry from product names.
     */
    function _topSmeIndustry(lending) {
        const sme = lending.filter(l => l.segmen === 'SME');
        if (!sme.length) return 'perdagangan & jasa';
        const prodFreq = {};
        sme.forEach(l => { prodFreq[l.produk] = (prodFreq[l.produk] || 0) + l.nominal; });
        const top = Object.entries(prodFreq).sort((a, b) => b[1] - a[1])[0];
        return top ? top[0] : 'perdagangan';
    }

    // ── Root Cause Builder ─────────────────────────────────────────────────────
    /**
     * Build a root cause narrative from the top priority and engine signals.
     */
    function buildRootCause(priority, { casaRadar, vintage, seasonal, strategy, scoring }) {
        const causes = {
            CASA_RECOVERY: () => {
                const shifting = casaRadar && casaRadar.fundShiftingUnits.length > 0;
                const lwc      = strategy && strategy.hasLoanWithoutCasa;
                if (shifting && lwc) {
                    return `Dana DPK keluar dari unit ${casaRadar.fundShiftingUnits.join(', ')} sementara transaksi digital tetap aktif — indikasi kuat nasabah memindahkan simpanan ke bank lain. Diperkuat oleh pola LOAN WITHOUT CASA: kredit disalurkan tanpa membangun CASA nasabah sebagai basis retensi.`;
                }
                if (shifting) {
                    return `Deteksi CASA outflow di ${casaRadar.fundShiftingUnits.join(', ')}: DPK turun signifikan namun QRIS/BRImo masih aktif — pola klasik fund shifting. Nasabah masih bertransaksi tetapi menyimpan dana di bank kompetitor.`;
                }
                if (lwc) {
                    return `Portofolio kredit tumbuh tanpa diimbangi pertumbuhan CASA di unit yang sama. Ini melanggar prinsip "loan follow transaction" — debitur tidak memperkuat hubungan ekosistem dengan bank.`;
                }
                return `CASA Ratio cabang di bawah target 60%. Komposisi DPK terlalu berat ke Deposito yang mahal, menekan Cost of Fund dan melemahkan ketahanan pendanaan jangka panjang.`;
            },
            NPL_RECOVERY: () => {
                const cohort = vintage && vintage.riskiestCohort;
                if (cohort && cohort.riskLevel !== 'LOW') {
                    return `Konsentrasi risiko kredit teridentifikasi di cohort ${cohort.year} dengan NPL ${fPct(cohort.weightedNpl)} dan eksposur ${fRp(cohort.nplExposure)}. NPL tinggi mengindikasikan underwriting yang kurang selektif atau pemburukan kondisi debitur di segmen tersebut.`;
                }
                return `Weighted NPL portofolio ${vintage ? fPct(vintage.totalWeightedNpl) : '?'} mendekati atau melampaui threshold 3%. Tanpa intervensi segera, potensi kerugian kredit akan mempengaruhi profitabilitas cabang.`;
            },
            STRATEGY_ALIGNMENT: () => {
                const lwcList = strategy ? strategy.loanWithoutCasaUnits : [];
                const smePct  = strategy ? strategy.smeContributionRatio : 0;
                return `Eksekusi cabang belum sepenuhnya selaras dengan strategi bank. Kontribusi SME/Commercial ${fPct(smePct)} di bawah target${lwcList.length > 0 ? `, dan unit ${lwcList.join(', ')} menyalurkan kredit tanpa membangun ekosistem CASA` : ''}. Ecosystem digital (QRIS, Qlola) belum dimanfaatkan optimal sebagai instrumen retention.`;
            },
            GROWTH_RECOVERY: () => {
                const mom = casaRadar ? casaRadar.totalCasaGrowthMoM : null;
                const seasonal_ctx = seasonal && seasonal.latestMonthContext && seasonal.latestMonthContext.special
                    ? ` Namun perlu dicatat: bulan ${seasonal.latestMonthContext.month} adalah periode ${seasonal.latestMonthContext.special.name}.`
                    : '';
                return `Momentum pertumbuhan melambat${mom !== null ? ` — DPK mengalami perubahan ${fPct(mom)} MoM` : ''}.${seasonal_ctx} Diperlukan akselerasi penghimpunan dan penyaluran kredit produktif untuk kembali ke jalur target.`;
            },
            GROWTH_OPTIMIZATION: () =>
                `Cabang dalam kondisi baik secara keseluruhan. Fokus dapat diarahkan pada penetrasi segmen baru dan peningkatan wallet share nasabah eksisting untuk pertumbuhan berkelanjutan.`
        };

        return (causes[priority] || causes.GROWTH_OPTIMIZATION)();
    }

    // ── Expected Impact Builder ────────────────────────────────────────────────
    function buildExpectedImpact(priority, { casaRadar, vintage, funding }) {
        const totalDpk = funding.reduce((s, i) => s + i.nominal, 0);

        const impacts = {
            CASA_RECOVERY: () => {
                const recoverable = casaRadar && casaRadar.unitStatuses
                    ? casaRadar.unitStatuses
                        .filter(u => u.isCritical)
                        .reduce((s, u) => s + u.casaTotal * 0.05, 0)
                    : totalDpk * 0.02;
                return `Estimasi pemulihan CASA ${fRp(recoverable)} dalam 30 hari jika 5 deposan terbesar dikontak. Improvement CASA Ratio +${fPct(totalDpk > 0 ? (recoverable / totalDpk) * 100 : 0)}.`;
            },
            NPL_RECOVERY: () => {
                const exp = vintage && vintage.riskiestCohort
                    ? vintage.riskiestCohort.nplExposure * 0.08
                    : 0;
                return `Target recovery kredit bermasalah ${fRp(exp)} dalam 60 hari melalui restrukturisasi terstruktur. NPL diproyeksikan turun 0.3–0.5 percentage point.`;
            },
            STRATEGY_ALIGNMENT: () =>
                `Alignment grade diproyeksikan naik dari ${vintage ? 'C' : 'D'} ke B dalam 2 bulan jika eksekusi LOAN_WITHOUT_CASA dan cross-sell Qlola berjalan sesuai rencana.`,
            GROWTH_RECOVERY: () => {
                const target = totalDpk * 0.015;
                return `Akselerasi penghimpunan ${fRp(target)} dalam 30 hari dapat mengembalikan DPK ke jalur pertumbuhan positif.`;
            },
            GROWTH_OPTIMIZATION: () =>
                `Potensi pertumbuhan tambahan +5–8% DPK dalam semester berikutnya melalui penetrasi segmen SME dan ecosystem digital.`
        };

        return (impacts[priority] || impacts.GROWTH_OPTIMIZATION)();
    }

    // ── Urgency Resolver ──────────────────────────────────────────────────────
    function resolveUrgency(priority, scoring) {
        if (priority === 'CASA_RECOVERY' || priority === 'NPL_RECOVERY') {
            return scoring && scoring.score < 50 ? 'SEGERA' : 'MINGGU INI';
        }
        if (priority === 'GROWTH_RECOVERY') return 'MINGGU INI';
        if (priority === 'STRATEGY_ALIGNMENT') return 'BULAN INI';
        return 'BULAN INI';
    }

    // ── Summary Builder ───────────────────────────────────────────────────────
    function buildSummary(priority, scoring, { casaRadar, vintage, strategy }) {
        const grade = scoring ? scoring.grade : '?';
        const score = scoring ? scoring.score : 0;

        const templates = {
            CASA_RECOVERY: () => {
                const units = casaRadar ? casaRadar.fundShiftingUnits : [];
                return `⚠️ Grade ${grade} (${score}/100) — CASA outflow terdeteksi${units.length ? ' di ' + units[0] : ''}. Prioritas: amankan dana nasabah hari ini.`;
            },
            NPL_RECOVERY: () =>
                `🔴 Grade ${grade} (${score}/100) — NPL ${vintage ? fPct(vintage.totalWeightedNpl) : '?'} membutuhkan intervensi segera. Fokus recovery dan restrukturisasi.`,
            STRATEGY_ALIGNMENT: () =>
                `🟡 Grade ${grade} (${score}/100) — Eksekusi cabang belum optimal. ${strategy && strategy.hasLoanWithoutCasa ? 'LOAN WITHOUT CASA terdeteksi. ' : ''}Selaraskan dengan strategi bank.`,
            GROWTH_RECOVERY: () =>
                `🟠 Grade ${grade} (${score}/100) — Momentum pertumbuhan melambat. Diperlukan akselerasi penghimpunan dan penyaluran.`,
            GROWTH_OPTIMIZATION: () =>
                `✅ Grade ${grade} (${score}/100) — Cabang dalam kondisi sehat. Fokus pada ekspansi SME dan ecosystem digital.`
        };

        return (templates[priority] || templates.GROWTH_OPTIMIZATION)();
    }

    // ── Context Builder ───────────────────────────────────────────────────────
    function buildContext(seasonal) {
        if (!seasonal || !seasonal.latestMonthContext) return '';
        const ctx = seasonal.latestMonthContext;
        if (ctx.special) {
            return `Konteks periode: ${ctx.special.name} (${ctx.month}) — pertimbangkan normalitas seasonal dalam evaluasi anomali.`;
        }
        return `Periode reguler ${ctx.month} — tidak ada faktor musiman khusus yang mempengaruhi performa.`;
    }

    // ── MAIN ENTRY POINT ───────────────────────────────────────────────────────
    /**
     * Generate the complete decision object.
     *
     * @param {Object} engines - { vintage, casaRadar, seasonal, strategy, scoring, funding, lending, channel }
     * @returns {Object} decision
     */
    function generate({ vintage, casaRadar, seasonal, strategy, scoring, funding, lending, channel }) {
        // Inputs safety
        const safeFunding = funding  || [];
        const safeLending = lending  || [];
        const safeChannel = channel  || [];

        // Step 1: Compute priority scores
        const priorityScores = computePriorityScores({
            casaRadar, vintage, seasonal, strategy, scoring,
            funding: safeFunding, lending: safeLending
        });

        // Step 2: Determine primary priority
        const priority = resolvePriority(priorityScores);

        // Step 3: Collect all issues
        const issues = collectIssues({
            casaRadar, vintage, seasonal, strategy, scoring,
            funding: safeFunding, lending: safeLending
        });

        // Step 4: Generate dynamic, specific actions
        const actions = generateActions(priority, {
            casaRadar, vintage, seasonal, strategy,
            funding: safeFunding, lending: safeLending, channel: safeChannel
        });

        // Step 5: Build narrative fields
        const rootCause      = buildRootCause(priority, { casaRadar, vintage, seasonal, strategy, scoring });
        const expectedImpact = buildExpectedImpact(priority, { casaRadar, vintage, funding: safeFunding });
        const urgency        = resolveUrgency(priority, scoring);
        const summary        = buildSummary(priority, scoring, { casaRadar, vintage, strategy });
        const context        = buildContext(seasonal);

        return {
            priority,
            summary,
            rootCause,
            issues,
            actions,
            expectedImpact,
            urgency,
            score:         scoring ? scoring.score : 0,
            grade:         scoring ? scoring.grade : 'D',
            scoreBreakdown: scoring ? scoring.breakdown : {},
            context,
            priorityScores  // expose for debugging
        };
    }

    return { generate };
})();
