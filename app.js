/**
 * app.js — BRInsight Application Logic
 *
 * PHASE 1 CHANGES:
 *  - EXCLUDED_PRODUCTS filter applied EARLY in refreshAll() (single pass, perf-safe)
 *  - Lending further restricted to ALLOWED_LENDING_PRODUCTS at split point
 *  - KCP BUMN added to unitOpts() dropdown helper
 *  - Unit dropdown in HTML filter now includes KCP BUMN
 */

// ══════════════════════════════════════════════════
// AUTH — Login / Logout / Session
// ══════════════════════════════════════════════════

(function initAuth() {
    const AUTH_KEY   = 'brinsight_user';
    const VALID_USER = { username: 'admin', password: 'bri123' };

    window.checkAuth = function () {
        const overlay      = document.getElementById('login-overlay');
        const appContainer = document.getElementById('app-container');
        const isLoggedIn   = !!localStorage.getItem(AUTH_KEY);
        if (overlay)      overlay.style.display      = isLoggedIn ? 'none' : 'flex';
        if (appContainer) appContainer.style.display = isLoggedIn ? 'flex' : 'none';
    };

    window.login = function () {
        const uEl = document.getElementById('login-username');
        const pEl = document.getElementById('login-password');
        const err = document.getElementById('login-err');
        const u   = uEl ? uEl.value.trim() : '';
        const p   = pEl ? pEl.value : '';

        if (u === VALID_USER.username && p === VALID_USER.password) {
            localStorage.setItem(AUTH_KEY, JSON.stringify({ username: u }));
            const overlay      = document.getElementById('login-overlay');
            const appContainer = document.getElementById('app-container');
            if (overlay)      overlay.style.display      = 'none';
            if (appContainer) appContainer.style.display = 'flex';
            if (err)          err.style.display          = 'none';
        } else {
            if (err) { err.textContent = 'Username atau password salah'; err.style.display = 'block'; }
            [uEl, pEl].forEach(el => {
                if (!el) return;
                el.animate([
                    { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
                    { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300, easing: 'ease-out' });
            });
        }
    };

    window.logout = function () {
        localStorage.removeItem(AUTH_KEY);
        location.reload();
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.checkAuth();

        const pwdEl  = document.getElementById('login-password');
        if (pwdEl)  pwdEl.addEventListener('keydown',  e => { if (e.key === 'Enter') window.login(); });
        const userEl = document.getElementById('login-username');
        if (userEl) userEl.addEventListener('keydown', e => { if (e.key === 'Enter') window.login(); });

        const chip  = document.getElementById('user-chip-btn');
        const popup = document.getElementById('logout-popup');
        if (chip && popup) {
            chip.addEventListener('click', e => {
                e.stopPropagation();
                popup.style.display = popup.style.display === 'none' || !popup.style.display ? 'block' : 'none';
            });
            document.addEventListener('click', () => { if (popup) popup.style.display = 'none'; });
        }
    });
})();

// ══════════════════════════════════════════════════
// APP STATE
// ══════════════════════════════════════════════════

window.appState = {
    filters: { startDate: null, endDate: null, units: [] },
    mode:    'monthly',   // 'monthly' | 'daily'
    charts:  {}
};

// ══════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupFilters();
    setupInputListeners();

    try {
        await window.dbManager.initDB();
        await refreshAll();
    } catch (err) {
        console.error('Init error:', err);
    }
});

// ══════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════
function setupNavigation() {
    const navItems  = document.querySelectorAll('.nav-item');
    const sections  = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            const target = document.getElementById(item.dataset.target);
            if (target) target.classList.add('active');
            if (pageTitle) pageTitle.textContent = item.querySelector('span').textContent;
        });
    });
}

// ══════════════════════════════════════════════════
// FILTERS
// ══════════════════════════════════════════════════
function setupFilters() {
    const today       = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    document.getElementById('filter-start').valueAsDate = sixMonthsAgo;
    document.getElementById('filter-end').valueAsDate   = today;

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const preset = btn.dataset.preset;
            let start = new Date();
            if      (preset === '1M')  start.setMonth(today.getMonth() - 1);
            else if (preset === '3M')  start.setMonth(today.getMonth() - 3);
            else if (preset === 'QTD') start = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
            else if (preset === 'YTD') start = new Date(today.getFullYear(), 0, 1);
            document.getElementById('filter-start').valueAsDate = start;
            document.getElementById('filter-end').valueAsDate   = today;
        });
    });

    document.getElementById('btn-apply-filter').addEventListener('click', async () => {
        const startVal = document.getElementById('filter-start').value;
        const endVal   = document.getElementById('filter-end').value;
        window.appState.filters.startDate = startVal ? new Date(startVal) : null;
        window.appState.filters.endDate   = endVal   ? new Date(endVal)   : null;
        const selected = Array.from(document.getElementById('filter-units').selectedOptions).map(o => o.value);
        window.appState.filters.units = selected.includes('ALL') ? [] : selected;
        await refreshAll();
    });

    // ── Harian button ───────────────────────────────────────────────────
    const harianBtn = document.getElementById('btn-preset-harian');
    if (harianBtn) {
        harianBtn.addEventListener('click', () => {
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            harianBtn.classList.add('active');
            window.appState.mode = 'daily';
            // Switch date pickers to day-level
            const sEl = document.getElementById('filter-start');
            const eEl = document.getElementById('filter-end');
            if (sEl) sEl.type = 'date';
            if (eEl) eEl.type = 'date';
            // Default: last 30 days of available daily data
            const endD   = new Date('2026-04-07');
            const startD = new Date('2026-03-08');
            if (sEl) sEl.value = startD.toISOString().slice(0, 10);
            if (eEl) eEl.value = endD.toISOString().slice(0, 10);
            window.appState.filters.startDate = startD;
            window.appState.filters.endDate   = endD;
        });
    }

    // Monthly presets reset daily mode and restore month pickers
    document.querySelectorAll('.btn-preset:not(#btn-preset-harian)').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.appState.mode === 'daily') {
                window.appState.mode = 'monthly';
                const sEl = document.getElementById('filter-start');
                const eEl = document.getElementById('filter-end');
                if (sEl && sEl.type === 'date') sEl.type = 'month';
                if (eEl && eEl.type === 'date') eEl.type = 'month';
                if (harianBtn) harianBtn.classList.remove('active');
            }
        });
    });
}

function applyFilters(data) {
    const { startDate, endDate, units } = window.appState.filters;
    const fmt = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const label = startDate && endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : 'Semua Waktu';

    const filtered = data.filter(item => {
        const d = new Date(item.tanggal);
        if (startDate && d < startDate) return false;
        if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); if (d > e) return false; }
        if (units.length && !units.includes(item.unit)) return false;
        return true;
    });

    return { filtered, label };
}

// ══════════════════════════════════════════════════
// REFRESH — PHASE 1: early filtering, single pass
// ══════════════════════════════════════════════════
async function refreshAll() {
    // ── Daily mode: delegate to dedicated renderer ─────────────────────────────
    if (window.appState.mode === 'daily') {
        _setDailyMode(true);
        await refreshDailyMode();
        return;
    }
    _setDailyMode(false);

    const rawAll = await window.dbManager.getAllData();

    // ── PHASE 1: Strip excluded products in ONE pass before anything else ─────
    // EXCLUDED_PRODUCTS = ['KUR Mikro', 'Kupedes', 'Kredit Ritel']
    const excludedSet = new Set(window.EXCLUDED_PRODUCTS || []);
    const raw = excludedSet.size > 0
        ? rawAll.filter(d => !excludedSet.has(d.produk))
        : rawAll;
    // ──────────────────────────────────────────────────────────────────────────

    const { filtered, label } = applyFilters(raw);

    document.getElementById('current-date-filter').textContent = 'Periode: ' + label;

    // Populate unit dropdown
    const allUnits = [...new Set(raw.map(d => d.unit))].sort();
    const unitSel  = document.getElementById('filter-units');
    if (unitSel) {
        const cur = unitSel.value;
        unitSel.innerHTML = '<option value="ALL">Semua Unit</option>' +
            allUnits.map(u => `<option value="${u}"${cur === u ? ' selected' : ''}>${u}</option>`).join('');
    }

    // ── PHASE 1: Split by jenis_produk; lending restricted to allowed products ─
    const allowedLending = new Set(window.ALLOWED_LENDING_PRODUCTS || []);

    const funding = filtered.filter(d => d.jenis_produk === 'Funding');
    const channel = filtered.filter(d => d.jenis_produk === 'Channel');
    // Lending: only ALLOWED_LENDING_PRODUCTS pass through
    const lending = filtered.filter(d =>
        d.jenis_produk === 'Lending' &&
        (allowedLending.size === 0 || allowedLending.has(d.produk))
    );
    // ──────────────────────────────────────────────────────────────────────────

    // ── SDSS Engine Pipeline ────────────────────────────────────────────────
    let decision = null;
    try {
        const vintage   = window.vintageEngine   ? window.vintageEngine.analyze(lending)                    : null;
        const casaRadar = window.casaRadarEngine ? window.casaRadarEngine.analyze(funding, channel)         : null;
        const seasonal  = window.seasonalEngine  ? window.seasonalEngine.analyze(funding, lending)          : null;
        const strategy  = window.strategyEngine  ? window.strategyEngine.analyze(lending, funding, channel) : null;
        const scoring   = window.scoringEngine   ? window.scoringEngine.compute({ casaRadar, vintage, seasonal, strategy, funding }) : null;
        decision = window.decisionEngine
            ? window.decisionEngine.generate({ vintage, casaRadar, seasonal, strategy, scoring, funding, lending, channel })
            : null;

        window.appState.lastDecision = decision;
    } catch (engineErr) {
        console.warn('[SDSS] Engine error (non-fatal):', engineErr);
    }

    // ── Analytics + Unit Decision Pipeline ──────────────────────────────
    let globalDecision = null, analyticsRiskMatrix = null, analyticsGrowthMatrix = null;
    try {
        if (window.analyticsEngine && window.unitDecisionEngine) {
            const analytics       = window.analyticsEngine.run(filtered);
            analyticsRiskMatrix   = analytics.riskMatrix;
            analyticsGrowthMatrix = analytics.growthMatrix;

            // Merge risk + growth per unit so decisions have all fields
            const riskByUnit = {};
            analytics.riskMatrix.forEach(r => { riskByUnit[r.unit] = r; });
            const enriched = analytics.growthMatrix.map(g => ({
                ...g,
                npl:      riskByUnit[g.unit]?.npl      ?? 0,
                sml:      riskByUnit[g.unit]?.sml      ?? 0,
                category: riskByUnit[g.unit]?.category ?? 'Sedang',
            }));

            const decisions = enriched.map(u => window.unitDecisionEngine.generateDecision(u));
            globalDecision  = window.unitDecisionEngine.generateGlobalDecision(decisions);
            window.appState.lastGlobalDecision = globalDecision;
            // Store all decisions (with priority labels assigned by generateGlobalDecision)
            window.appState.lastAllDecisions = globalDecision ? globalDecision.allDecisions : decisions;
        }
    } catch (aErr) {
        console.warn('[Analytics DSS] Non-fatal:', aErr);
    }
    // ──────────────────────────────────────────────────────────────────────

    // Expose decisions for risk section renderers
    const allDecisions = window.appState.lastAllDecisions || [];

    renderExecView(funding, lending, decision);
    renderDecisionPanel(globalDecision || decision);
    renderRiskDecisionPanel(globalDecision);
    renderFundingView(funding, channel);
    renderLendingView(lending);
    renderUnitView(funding, lending);
    renderRiskView(funding, lending);
    renderRiskMatrix(analyticsRiskMatrix);
    renderGrowthMatrix(analyticsGrowthMatrix);
    renderUnitDecisionsGrid(allDecisions);
    renderInputTable(raw);   // Input table shows all clean data (excludes EXCLUDED_PRODUCTS)

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ══════════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════════
function fRp(n) {
    if (n >= 1e12) return 'Rp ' + (n / 1e12).toFixed(2) + ' T';
    if (n >= 1e9)  return 'Rp ' + (n / 1e9).toFixed(1)  + ' M';
    if (n >= 1e6)  return 'Rp ' + (n / 1e6).toFixed(0)  + ' Jt';
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function fRpFull(n) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function fPct(n) { return (+n).toFixed(2) + '%'; }

function isDeposito(p) { return p.toLowerCase().includes('deposito'); }
function isGiro(p)     { return p.toLowerCase().includes('giro'); }

function groupByMonth(arr) {
    return arr.reduce((acc, item) => {
        const d = new Date(item.tanggal);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        acc[k] = (acc[k] || 0) + item.nominal;
        return acc;
    }, {});
}

function getMonthLabel(k) {
    const [y, m] = k.split('-');
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
}

function destroyChart(key) {
    if (window.appState.charts[key]) {
        window.appState.charts[key].destroy();
        window.appState.charts[key] = null;
    }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

const CHART_COLORS = {
    blue:   '#0857C3',
    blue2:  '#307FE2',
    cyan:   '#0EA5E9',
    green:  '#10B981',
    purple: '#8B5CF6',
    orange: '#F59E0B',
    red:    '#EF4444',
    teal:   '#14B8A6',
    pink:   '#EC4899',
    indigo: '#6366F1',
};

const UNIT_COLORS = ['#0857C3', '#307FE2', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size   = 11;
    Chart.defaults.color       = '#94A3B8';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.padding  = 12;
}

const commonOptions = {
    responsive:          true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
        legend:  { display: true, position: 'top' },
        tooltip: {
            backgroundColor: '#1E3A5F',
            titleColor:      '#fff',
            bodyColor:       'rgba(255,255,255,.85)',
            padding:         12,
            cornerRadius:    10,
            boxPadding:      4,
        }
    }
};

// ══════════════════════════════════════════════════
// EXECUTIVE VIEW
// ══════════════════════════════════════════════════
function renderExecView(funding, lending, decision) {
    const tFunding = funding.reduce((s, i) => s + i.nominal, 0);
    const tLending = lending.reduce((s, i) => s + i.nominal, 0);
    const tCasa    = funding.filter(f => !isDeposito(f.produk)).reduce((s, i) => s + i.nominal, 0);
    const tDepo    = funding.filter(f => isDeposito(f.produk)).reduce((s, i) => s + i.nominal, 0);
    const casaR    = tFunding > 0 ? tCasa / tFunding * 100 : 0;
    const ldr      = tFunding > 0 ? tLending / tFunding * 100 : 0;

    const lendWithNpl = lending.filter(i => i.npl !== null);
    const avgNpl = lendWithNpl.length
        ? lendWithNpl.reduce((s, i) => s + i.nominal * (i.npl / 100), 0)
          / lendWithNpl.reduce((s, i) => s + i.nominal, 0) * 100
        : 0;

    setText('kpi-total-funding', fRp(tFunding));
    setText('kpi-total-lending', fRp(tLending));
    setText('kpi-casa-ratio',    fPct(casaR));
    setText('kpi-avg-npl',       fPct(avgNpl));
    setText('kpi-ldr',           fPct(ldr));

    const nplCard = document.getElementById('kpi-npl-card');
    if (nplCard) {
        nplCard.className = 'kpi-card ' + (avgNpl >= 3 ? 'kpi-danger' : avgNpl >= 2.5 ? 'kpi-warn' : 'kpi-green');
    }
    // LDR KPI card colour  (formula: Total Kredit / Total DPK × 100)
    const ldrCard = document.getElementById('kpi-ldr-card');
    if (ldrCard) {
        ldrCard.className = 'kpi-card ' + (ldr > 100 ? 'kpi-danger' : ldr > 90 ? 'kpi-warn' : ldr >= 80 ? 'kpi-green' : ldr >= 75 ? 'kpi-warn' : 'kpi-danger');
    }

    let insight = '';
    if (decision && decision.summary) {
        insight = decision.summary;
    } else if (avgNpl > 3) {
        insight = `⚠️ NPL ${fPct(avgNpl)} melampaui threshold 3%. Segera review portofolio kredit berisiko.`;
    } else if (casaR < 60) {
        insight = `📉 CASA Ratio ${fPct(casaR)} di bawah target 60%. Intensifkan penghimpunan giro & tabungan.`;
    } else if (ldr > 92) {
        insight = `📈 LDR ${fPct(ldr)} mendekati batas atas 92%. Pertimbangkan akselerasi DPK.`;
    } else {
        insight = `✅ Kinerja cabang dalam kondisi baik. DPK ${fRp(tFunding)}, Kredit ${fRp(tLending)}, NPL ${fPct(avgNpl)} (aman).`;
    }
    setText('insight-text', insight);

    // Trend Chart
    const dFunding = groupByMonth(funding);
    const dLending = groupByMonth(lending);
    const months   = Array.from(new Set([...Object.keys(dFunding), ...Object.keys(dLending)])).sort();
    const mLabels  = months.map(getMonthLabel);

    destroyChart('trend');
    const ctxT = document.getElementById('trend-chart');
    if (ctxT) {
        window.appState.charts.trend = new Chart(ctxT, {
            type: 'line',
            data: {
                labels: mLabels,
                datasets: [
                    { label: 'DPK',    data: months.map(m => (dFunding[m] || 0) / 1e12), borderColor: CHART_COLORS.blue,  backgroundColor: 'rgba(8,87,195,.08)',  borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: CHART_COLORS.blue  },
                    { label: 'Kredit', data: months.map(m => (dLending[m] || 0) / 1e12), borderColor: CHART_COLORS.blue2, backgroundColor: 'rgba(48,127,226,.08)', borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: CHART_COLORS.blue2 }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { ticks: { callback: v => 'Rp ' + v.toFixed(1) + ' T' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // CASA Donut
    destroyChart('casa');
    const ctxC = document.getElementById('casa-chart');
    if (ctxC) {
        window.appState.charts.casa = new Chart(ctxC, {
            type: 'doughnut',
            data: {
                labels: ['Giro', 'Tabungan', 'Deposito'],
                datasets: [{
                    data: [
                        funding.filter(f => isGiro(f.produk)).reduce((s, i) => s + i.nominal, 0) / 1e12,
                        funding.filter(f => !isDeposito(f.produk) && !isGiro(f.produk)).reduce((s, i) => s + i.nominal, 0) / 1e12,
                        tDepo / 1e12
                    ],
                    backgroundColor: [CHART_COLORS.blue, CHART_COLORS.blue2, CHART_COLORS.orange],
                    borderWidth: 2, borderColor: '#fff', hoverOffset: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '72%',
                plugins: { legend: { display: false }, tooltip: commonOptions.plugins.tooltip }
            }
        });
        setText('donut-center-label', fPct(casaR));
        const legend = document.getElementById('donut-legend');
        if (legend) {
            const colors = [CHART_COLORS.blue, CHART_COLORS.blue2, CHART_COLORS.orange];
            const labels = ['Giro', 'Tabungan', 'Deposito'];
            legend.innerHTML = labels.map((l, i) => `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div>${l}</div>`).join('');
        }
    }

    // Executive Unit Performance Table
    const perfBody = document.getElementById('exec-unit-perf-body');
    if (perfBody) {
        const units = [...new Set([...funding.map(f => f.unit), ...lending.map(l => l.unit)])].sort();
        perfBody.innerHTML = units.map(u => {
            const uf    = funding.filter(f => f.unit === u).reduce((s, i) => s + i.nominal, 0);
            const ul    = lending.filter(l => l.unit === u).reduce((s, i) => s + i.nominal, 0);
            const lUnit = lending.filter(l => l.unit === u && l.npl !== null);
            const npl   = lUnit.length ? lUnit.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / lUnit.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
            const ldr   = uf > 0 ? ul / uf * 100 : 0;
            const nplCls = npl >= 3 ? 'badge-danger' : npl >= 2.5 ? 'badge-warn' : 'badge-success';
            const ldrCls = ldr > 100 ? 'badge-danger' : ldr > 90 ? 'badge-warn' : ldr >= 80 ? 'badge-success' : ldr >= 75 ? 'badge-warn' : 'badge-danger';
            const hasRed  = nplCls === 'badge-danger' || ldrCls === 'badge-danger';
            const hasYell = nplCls === 'badge-warn'   || ldrCls === 'badge-warn';
            const stCls   = hasRed ? 'badge-danger' : hasYell ? 'badge-warn' : 'badge-success';
            const stTxt   = hasRed ? 'Kritis'       : hasYell ? 'Perhatian'  : 'Sehat';
            const uShort = u.replace('KCP ', '').replace('KC ', 'KC ');
            return `<tr>
                <td class="unit-cell">${uShort}</td>
                <td>${fRp(uf)}</td>
                <td>${fRp(ul)}</td>
                <td><span class="badge ${nplCls}">${fPct(npl)}</span></td>
                <td><span class="badge ${ldrCls}">${fPct(ldr)}</span></td>
                <td><span class="badge ${stCls}">${stTxt}</span></td>
            </tr>`;
        }).join('');
    }

    // Hidden unit bar chart (kept for JS compat)
    const units  = [...new Set([...funding.map(f => f.unit), ...lending.map(l => l.unit)])].sort();
    const uFund  = units.map(u => funding.filter(f => f.unit === u).reduce((s, i) => s + i.nominal, 0) / 1e9);
    const uLend  = units.map(u => lending.filter(l => l.unit === u).reduce((s, i) => s + i.nominal, 0) / 1e9);
    const shortU = u => u.replace('KCP ', '').replace('KC ', 'KC ');

    destroyChart('unit');
    const ctxU = document.getElementById('unit-chart');
    if (ctxU) {
        window.appState.charts.unit = new Chart(ctxU, {
            type: 'bar',
            data: {
                labels: units.map(shortU),
                datasets: [
                    { label: 'DPK',    data: uFund, backgroundColor: CHART_COLORS.blue,  borderRadius: 4, borderSkipped: false },
                    { label: 'Kredit', data: uLend, backgroundColor: CHART_COLORS.blue2, borderRadius: 4, borderSkipped: false }
                ]
            },
            options: { ...commonOptions, scales: { y: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + ' M' }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } }
        });
    }

    // Rankings
    const byUnit = lending.reduce((acc, i) => { acc[i.unit] = (acc[i.unit] || 0) + i.nominal; return acc; }, {});
    const sorted = Object.entries(byUnit).sort((a, b) => b[1] - a[1]);
    const rankColors = ['gold', 'silver', 'bronze'];
    const rl = document.getElementById('rank-top-3');
    if (rl) {
        rl.innerHTML = sorted.length
            ? sorted.slice(0, 5).map((item, i) => `
                <li>
                    <div class="rank-unit"><div class="rank-num ${rankColors[i] || ''}">${i + 1}</div>${item[0]}</div>
                    <div class="rank-val">${fRp(item[1])}</div>
                </li>`).join('')
            : '<li class="empty-info">Tidak ada data</li>';
    }

    const alerts = document.getElementById('dashboard-alerts');
    if (alerts) {
        const critical = lending.filter(d => d.npl !== null && d.npl > 3);
        const byUnitNpl = critical.reduce((acc, i) => { if (!acc[i.unit] || acc[i.unit] < i.npl) acc[i.unit] = i.npl; return acc; }, {});
        const badge = document.getElementById('risk-badge');
        if (badge) {
            badge.textContent  = Object.keys(byUnitNpl).length;
            badge.style.display = Object.keys(byUnitNpl).length > 0 ? 'inline-block' : 'none';
        }
    }
}

// ══════════════════════════════════════════════════
// DECISION PANEL — Analytics Command Center + Legacy SDSS fallback
// ══════════════════════════════════════════════════
function renderDecisionPanel(decision) {
    const panel = document.getElementById('decision-panel');
    if (!panel) return;
    if (!decision) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    // ── Analytics Command Center format (globalDecision from unitDecisionEngine) ──
    if (decision.focusArea !== undefined) {
        _renderCommandCenter(panel, decision);
        return;
    }

    // ── Legacy SDSS format (from decisionEngine) ────────────────────────────────
    const gradeColors   = { A: '#10B981', B: '#F59E0B', C: '#F97316', D: '#EF4444' };
    const urgencyColors = { 'SEGERA': '#EF4444', 'MINGGU INI': '#F59E0B', 'BULAN INI': '#3B82F6' };
    const priorityIcons  = { CASA_RECOVERY: '🏦', NPL_RECOVERY: '🔴', STRATEGY_ALIGNMENT: '🎯', GROWTH_RECOVERY: '📈', GROWTH_OPTIMIZATION: '✅' };
    const priorityLabels = { CASA_RECOVERY: 'CASA RECOVERY', NPL_RECOVERY: 'NPL RECOVERY', STRATEGY_ALIGNMENT: 'STRATEGY ALIGNMENT', GROWTH_RECOVERY: 'GROWTH RECOVERY', GROWTH_OPTIMIZATION: 'GROWTH OPTIMIZATION' };
    const gradeColor   = gradeColors[decision.grade]     || '#64748B';
    const urgencyColor = urgencyColors[decision.urgency] || '#64748B';
    const priorityIcon = priorityIcons[decision.priority]  || '📊';
    const priorityLbl  = priorityLabels[decision.priority] || decision.priority;
    const breakdownHtml = decision.scoreBreakdown
        ? Object.entries({ 'CASA': decision.scoreBreakdown.casaHealth, 'NPL': decision.scoreBreakdown.nplRisk, 'Growth': decision.scoreBreakdown.growthMomentum, 'Strategi': decision.scoreBreakdown.strategyAlignment, 'Seasonal': decision.scoreBreakdown.seasonalStability })
            .map(([label, val]) => { const color = val >= 70 ? '#10B981' : val >= 50 ? '#F59E0B' : '#EF4444'; return `<div class="dp-bar-row"><span class="dp-bar-label">${label}</span><div class="dp-bar-track"><div class="dp-bar-fill" style="width:${val}%;background:${color}"></div></div><span class="dp-bar-val" style="color:${color}">${val}</span></div>`; }).join('')
        : '';
    const issuesHtml   = (decision.issues || []).map(issue => { const tag = issue.match(/^\[([A-Z]+)\]/); const tagLbl = tag ? tag[1] : 'INFO'; const text = issue.replace(/^\[[A-Z]+\]\s*/, ''); const tagColor = { CASA: '#0EA5E9', NPL: '#EF4444', STRATEGI: '#8B5CF6', SEASONAL: '#F59E0B', INFO: '#10B981' }[tagLbl] || '#64748B'; return `<div class="dp-issue"><span class="dp-issue-tag" style="background:${tagColor}20;color:${tagColor};border:1px solid ${tagColor}40">${tagLbl}</span><span class="dp-issue-text">${text}</span></div>`; }).join('');
    const actionsHtml  = (decision.actions || []).map((a, i) => `<div class="dp-action"><div class="dp-action-num">${i + 1}</div><div class="dp-action-text">${a}</div></div>`).join('');
    panel.innerHTML = `
        <div class="dp-header">
            <div class="dp-header-left">
                <div class="dp-priority-badge"><span class="dp-priority-icon">${priorityIcon}</span><span class="dp-priority-label">PRIORITAS: ${priorityLbl}</span></div>
                <div class="dp-urgency" style="background:${urgencyColor}20;color:${urgencyColor};border:1px solid ${urgencyColor}40">⏱ ${decision.urgency}</div>
            </div>
            <div class="dp-header-right"><div class="dp-score-circle" style="border-color:${gradeColor}"><div class="dp-score-num" style="color:${gradeColor}">${decision.score}</div><div class="dp-score-grade" style="color:${gradeColor}">Grade ${decision.grade}</div></div></div>
        </div>
        <div class="dp-body">
            <div class="dp-col dp-col-left">
                <div class="dp-section"><div class="dp-section-title">📋 Root Cause</div><div class="dp-root-cause">${decision.rootCause}</div></div>
                <div class="dp-section"><div class="dp-section-title">⚠️ Isu Terdeteksi</div><div class="dp-issues">${issuesHtml || '<div class="dp-empty">Tidak ada isu kritis</div>'}</div></div>
                ${decision.context ? `<div class="dp-context">💡 ${decision.context}</div>` : ''}
            </div>
            <div class="dp-col dp-col-right">
                <div class="dp-section"><div class="dp-section-title">🎯 Aksi Harian (${(decision.actions||[]).length} Prioritas)</div><div class="dp-actions">${actionsHtml}</div></div>
                <div class="dp-section"><div class="dp-section-title">📊 Branch Health Score</div><div class="dp-breakdown">${breakdownHtml}</div></div>
                <div class="dp-impact"><div class="dp-impact-label">💰 Expected Impact</div><div class="dp-impact-text">${decision.expectedImpact || '—'}</div></div>
            </div>
        </div>`;
}

// Analytics Command Center renderer
function _renderCommandCenter(panel, gd) {
    const pColor = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#10B981' };
    const tIcon  = d => d === 'improving' ? '↓' : d === 'deteriorating' ? '↑' : '→';
    const tCls   = d => d === 'improving' ? 'cmd-ok' : d === 'deteriorating' ? 'cmd-danger' : 'cmd-neutral';
    const rCls   = v => v > 50 ? 'cmd-danger' : v > 35 ? 'cmd-warn' : 'cmd-ok';
    const nCls   = v => v > 3  ? 'cmd-danger' : v > 2  ? 'cmd-warn'  : 'cmd-ok';

    const topUnitsHtml = (gd.topUnits || []).map(u => {
        const pCls = `cmd-pri-${(u.priority || 'medium').toLowerCase()}`;
        const tDir = u.trends?.nplTrend?.direction || 'stable';
        const delta = u.trends?.nplTrend?.delta ?? 0;
        return `<div class="cmd-unit-card ${pCls}">
            <div class="cmd-unit-hd">
                <span class="cmd-unit-name">${u.unit}</span>
                <span class="cmd-pill ${pCls}">${u.priority}</span>
            </div>
            <div class="cmd-unit-metrics">
                <div class="cmd-um"><span class="cmd-um-lbl">NPL</span><span class="cmd-um-val ${nCls(u.npl)}">${u.npl.toFixed(2)}%</span></div>
                <div class="cmd-um"><span class="cmd-um-lbl">Risk↑</span><span class="cmd-um-val ${rCls(u.riskIndex)}">${u.riskIndex.toFixed(1)}</span></div>
                <div class="cmd-um"><span class="cmd-um-lbl">NPL Trend</span><span class="cmd-um-val ${tCls(tDir)}">${tIcon(tDir)} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}pp</span></div>
                <div class="cmd-um"><span class="cmd-um-lbl">Growth</span><span class="cmd-um-val">${u.growthScore.toFixed(1)}</span></div>
            </div>
            <div class="cmd-unit-cause">${(u.rootCause || '').substring(0, 140)}…</div>
        </div>`;
    }).join('');

    const actionsHtml = (gd.actions || []).map((a, i) =>
        `<div class="dp-action"><div class="dp-action-num">${i + 1}</div><div class="dp-action-text">${a}</div></div>`
    ).join('');

    const c = pColor[gd.priority] || '#64748B';
    panel.className = 'decision-panel mt-gap';
    panel.innerHTML = `
    <div class="cmd-hd">
        <div class="cmd-hd-left">
            <div class="cmd-badge-title">🧠 Branch Command Center</div>
            <div class="cmd-focus" style="background:${c}22;color:${c};border:1px solid ${c}44">🎯 ${gd.focusArea}</div>
        </div>
        <div class="cmd-hd-stats">
            <div class="cmd-stat-box">
                <div class="cmd-stat-val" style="color:#EF4444">${gd.criticalCount}</div>
                <div class="cmd-stat-lbl">Unit HIGH</div>
            </div>
            <div class="cmd-stat-box">
                <div class="cmd-stat-val" style="color:#F59E0B">${gd.avgRiskIndex}</div>
                <div class="cmd-stat-lbl">Avg Risk↑</div>
            </div>
            <div class="cmd-stat-box">
                <div class="cmd-stat-val" style="color:#10B981">${gd.avgGrowthScore}</div>
                <div class="cmd-stat-lbl">Avg Growth</div>
            </div>
            <div class="cmd-stat-box">
                <div class="cmd-stat-val">${gd.n}</div>
                <div class="cmd-stat-lbl">Total Unit</div>
            </div>
        </div>
    </div>
    <div class="cmd-body">
        <div class="cmd-left">
            <div class="dp-section-title">📊 Situasi Cabang</div>
            <div class="cmd-summary">${gd.summary}</div>
            <div class="dp-section-title" style="margin-top:14px">🎯 Aksi Konsolidasi Top-3 Unit</div>
            <div class="dp-actions">${actionsHtml || '<div class="dp-empty">Tidak ada aksi mendesak</div>'}</div>
        </div>
        <div class="cmd-right">
            <div class="dp-section-title">🔴 Unit Prioritas Tertinggi</div>
            ${topUnitsHtml}
        </div>
    </div>`;
}

// ══════════════════════════════════════════════════
// RISK SECTION — Command Center (mirrors exec panel)
// ══════════════════════════════════════════════════
function renderRiskDecisionPanel(globalDecision) {
    const panel = document.getElementById('risk-decision-panel');
    if (!panel) return;
    if (!globalDecision || !globalDecision.focusArea) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    _renderCommandCenter(panel, globalDecision);
}

// ══════════════════════════════════════════════════
// UNIT DECISIONS GRID — all-unit mini-cards
// ══════════════════════════════════════════════════
function renderUnitDecisionsGrid(decisions) {
    const panel = document.getElementById('unit-decisions-panel');
    const grid  = document.getElementById('unit-decisions-grid');
    if (!panel || !grid) return;
    if (!decisions || !decisions.length) { panel.style.display = 'none'; return; }

    const pColor = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#10B981' };
    const pCls   = { HIGH: 'cmd-pri-high', MEDIUM: 'cmd-pri-medium', LOW: 'cmd-pri-low' };

    grid.innerHTML = decisions.map(function(d) {
        const c   = pColor[d.priority] || '#64748B';
        const cls = pCls[d.priority]   || '';
        const npl = (d.npl   || 0).toFixed(2);
        const ri  = (d.riskIndex   || 0).toFixed(1);
        const gs  = (d.growthScore || 0).toFixed(1);
        const ps  = (d.priorityScore || 0).toFixed(1);
        const nplColor    = (d.npl   || 0) > 3 ? '#EF4444' : (d.npl || 0) > 2 ? '#F59E0B' : '#10B981';
        const riskColor   = (d.riskIndex || 0) > 50 ? '#EF4444' : (d.riskIndex || 0) > 35 ? '#F59E0B' : '#10B981';
        const causeText   = (d.rootCause     || '').substring(0, 120) + '…';
        const impactText  = (d.expectedImpact || '').substring(0, 100);
        const impactHtml  = impactText
            ? '<div class="cmd-dm-impact">\uD83D\uDCA1 ' + impactText + '</div>'
            : '';
        return '<div class="cmd-decision-mini ' + cls + '">'
            + '<div class="cmd-dm-hd">'
            +   '<span class="cmd-dm-unit">' + d.unit + '</span>'
            +   '<span class="cmd-pill ' + cls + '">' + (d.priority || '') + '</span>'
            + '</div>'
            + '<div class="cmd-unit-metrics">'
            +   '<div class="cmd-um"><span class="cmd-um-lbl">NPL</span>'
            +     '<span class="cmd-um-val" style="color:' + nplColor + '">' + npl + '%</span></div>'
            +   '<div class="cmd-um"><span class="cmd-um-lbl">Risk\u2191</span>'
            +     '<span class="cmd-um-val" style="color:' + riskColor + '">' + ri + '</span></div>'
            +   '<div class="cmd-um"><span class="cmd-um-lbl">Growth</span>'
            +     '<span class="cmd-um-val">' + gs + '</span></div>'
            +   '<div class="cmd-um"><span class="cmd-um-lbl">P-Score</span>'
            +     '<span class="cmd-um-val" style="color:' + c + '">' + ps + '</span></div>'
            + '</div>'
            + '<div class="cmd-dm-cause">' + causeText + '</div>'
            + impactHtml
            + '</div>';
    }).join('');

    panel.style.display = 'block';
}

// ══════════════════════════════════════════════════
// FUNDING VIEW
// ══════════════════════════════════════════════════
function renderFundingView(funding, channel) {
    const tFund = funding.reduce((s, i) => s + i.nominal, 0);
    const tGiro = funding.filter(f => isGiro(f.produk)).reduce((s, i) => s + i.nominal, 0);
    const tTab  = funding.filter(f => !isDeposito(f.produk) && !isGiro(f.produk)).reduce((s, i) => s + i.nominal, 0);
    const tDepo = funding.filter(f => isDeposito(f.produk)).reduce((s, i) => s + i.nominal, 0);
    const casaR = tFund > 0 ? (tGiro + tTab) / tFund * 100 : 0;
    const cof   = tFund > 0 ? (tDepo * 5.5 + tGiro * 0.5 + tTab * 1.0) / tFund : 0;

    setText('f-total',    fRp(tFund));
    setText('f-giro',     fRp(tGiro));
    setText('f-tabungan', fRp(tTab));
    setText('f-deposito', fRp(tDepo));
    setText('f-casa',     fPct(casaR));
    setText('f-cof',      fPct(cof));
    if (tFund > 0) {
        setText('f-giro-pct', fPct(tGiro / tFund * 100) + ' dari total');
        setText('f-tab-pct',  fPct(tTab  / tFund * 100) + ' dari total');
        setText('f-dep-pct',  fPct(tDepo / tFund * 100) + ' dari total');
    }

    if (casaR >= 60) setText('funding-insight', `CASA Ratio ${fPct(casaR)} — posisi baik. Cost of Fund terkelola di ${fPct(cof)}.`);
    else             setText('funding-insight', `CASA Ratio ${fPct(casaR)} di bawah target 60%. Intensifkan penghimpunan giro & tabungan payroll.`);

    const getKey = f => { const d = new Date(f.tanggal); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const months  = [...new Set(funding.map(getKey))].sort();
    const mLabels = months.map(getMonthLabel);

    const byProd = (pred, m) => funding.filter(f => pred(f.produk) && getKey(f) === m).reduce((s, i) => s + i.nominal, 0) / 1e9;

    destroyChart('fStacked');
    const ctxFS = document.getElementById('funding-stacked-chart');
    if (ctxFS) {
        window.appState.charts.fStacked = new Chart(ctxFS, {
            type: 'line',
            data: {
                labels: mLabels,
                datasets: [
                    { label: 'Giro',     data: months.map(m => byProd(isGiro, m)),                              borderColor: CHART_COLORS.blue,   backgroundColor: 'rgba(59,130,246,.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3 },
                    { label: 'Tabungan', data: months.map(m => byProd(p => !isDeposito(p) && !isGiro(p), m)), borderColor: CHART_COLORS.purple, backgroundColor: 'rgba(139,92,246,.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3 },
                    { label: 'Deposito', data: months.map(m => byProd(isDeposito, m)),                         borderColor: CHART_COLORS.orange, backgroundColor: 'rgba(245,158,11,.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3 }
                ]
            },
            options: { ...commonOptions, scales: { y: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + ' M' }, stacked: false, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } }
        });
    }

    destroyChart('fDonut');
    const ctxFD = document.getElementById('funding-donut-chart');
    if (ctxFD) {
        window.appState.charts.fDonut = new Chart(ctxFD, {
            type: 'doughnut',
            data: { labels: ['Giro', 'Tabungan', 'Deposito'], datasets: [{ data: [tGiro / 1e9, tTab / 1e9, tDepo / 1e9], backgroundColor: [CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.orange], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
        });
        setText('funding-donut-center', fPct(casaR));
        const leg = document.getElementById('funding-donut-legend');
        if (leg) leg.innerHTML = ['Giro', 'Tabungan', 'Deposito'].map((l, i) => `<div class="legend-item"><div class="legend-dot" style="background:${[CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.orange][i]}"></div>${l}</div>`).join('');
    }

    const fundUnits  = [...new Set(funding.map(f => f.unit))].sort();
    const sortedFU   = fundUnits.map(u => ({ u, v: funding.filter(f => f.unit === u).reduce((s, i) => s + i.nominal, 0) / 1e9 })).sort((a, b) => a.v - b.v);

    destroyChart('fUnit');
    const ctxFU = document.getElementById('funding-unit-chart');
    if (ctxFU) {
        window.appState.charts.fUnit = new Chart(ctxFU, {
            type: 'bar',
            data: { labels: sortedFU.map(x => x.u.replace('KCP ', '').replace('KC ', '')), datasets: [{ label: 'DPK (Miliar Rp)', data: sortedFU.map(x => x.v), backgroundColor: sortedFU.map((x, i) => `rgba(59,130,246,${0.4 + i / sortedFU.length * 0.6})`), borderRadius: 4, borderSkipped: false }] },
            options: { ...commonOptions, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + ' M' }, grid: { color: 'rgba(0,0,0,.04)' } }, y: { grid: { display: false } } } }
        });
    }

    const chanProducts = ['QRIS', 'EDC', 'BRImo', 'Qlola'];
    const chanColors   = [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.purple, CHART_COLORS.orange];
    const chanMonths   = [...new Set(channel.map(c => { const d = new Date(c.tanggal); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }))].sort();
    const chanKey      = c => { const d = new Date(c.tanggal); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

    destroyChart('channel');
    const ctxCH = document.getElementById('channel-chart');
    if (ctxCH && chanMonths.length) {
        window.appState.charts.channel = new Chart(ctxCH, {
            type: 'bar',
            data: {
                labels: chanMonths.map(getMonthLabel),
                datasets: chanProducts.map((p, i) => ({
                    label: p,
                    data:  chanMonths.map(m => channel.filter(c => c.produk === p && chanKey(c) === m).reduce((s, x) => s + x.nominal, 0) / 1e9),
                    backgroundColor: chanColors[i], borderRadius: 3, borderSkipped: false
                }))
            },
            options: { ...commonOptions, scales: { y: { stacked: false, ticks: { callback: v => v.toFixed(0) + ' M' }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } }
        });
    }

    // ── DPK vs RKA ──────────────────────────────────────────
    destroyChart('dpkRka');
    const ctxDR = document.getElementById('dpk-rka-chart');
    if (ctxDR && months.length) {
        const dpkVal = months.map(m => byProd(p => true, m));
        const dpkRka = dpkVal.map((v, i) => v * (1.02 + 0.005 * i));
        window.appState.charts.dpkRka = new Chart(ctxDR, {
            type: 'bar',
            data: { labels: mLabels, datasets: [
                { label: 'Realisasi DPK', data: dpkVal, backgroundColor: CHART_COLORS.blue, borderRadius: 3, order: 2 },
                { label: 'Target RKA', data: dpkRka, type: 'line', borderColor: CHART_COLORS.orange, borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false, order: 1 }
            ] },
            options: { ...commonOptions, scales: { y: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + ' M' }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } }
        });
    }

    // ── QRIS & EDC Produktif ────────────────────────────────
    const buildDonut = (id, data, labels, colors, pct) => {
        destroyChart(id);
        const ctx = document.getElementById(id + '-chart');
        if (ctx) {
            window.appState.charts[id] = new Chart(ctx, {
                type: 'doughnut',
                data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
            setText(id + '-center', fPct(pct));
            const leg = document.getElementById(id + '-legend');
            if (leg) leg.innerHTML = labels.map((l, i) => `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div>${l} (${fPct(data[i]/data.reduce((a,b)=>a+b)*100)})</div>`).join('');
        }
    };

    const tQ = channel.filter(c => c.produk === 'QRIS').reduce((s, x) => s + x.nominal, 0);
    const tE = channel.filter(c => c.produk === 'EDC').reduce((s, x) => s + x.nominal, 0);
    if (tQ > 0) buildDonut('qris-produktif', [tQ*0.72, tQ*0.28], ['Produktif','Non-Produktif'], [CHART_COLORS.blue, CHART_COLORS.blue+'40'], 72);
    if (tE > 0) buildDonut('edc-produktif', [tE*0.65, tE*0.35], ['Produktif','Non-Produktif'], [CHART_COLORS.teal, CHART_COLORS.teal+'40'], 65);
}

// ══════════════════════════════════════════════════
// LENDING VIEW
// ══════════════════════════════════════════════════
function renderLendingView(lending) {
    const tLend  = lending.reduce((s, i) => s + i.nominal, 0);
    const tCons  = lending.filter(l => l.segmen === 'Konsumer').reduce((s, i) => s + i.nominal, 0);
    const tMikro = lending.filter(l => l.segmen === 'Mikro').reduce((s, i) => s + i.nominal, 0);
    const tSme   = lending.filter(l => l.segmen === 'SME').reduce((s, i) => s + i.nominal, 0);
    const tRitel = lending.filter(l => l.segmen === 'Ritel').reduce((s, i) => s + i.nominal, 0);

    const withNpl = lending.filter(i => i.npl !== null);
    const avgNpl  = withNpl.length ? withNpl.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / withNpl.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
    const sml     = avgNpl * 1.8;

    setText('l-total',    fRp(tLend));
    setText('l-consumer', fRp(tCons));
    setText('l-mikro',    fRp(tMikro));
    setText('l-sme',      fRp(tSme));
    setText('l-npl',      fPct(avgNpl));
    setText('l-sml',      'SML: ' + fPct(sml));

    if (tLend > 0) {
        setText('l-consumer-pct', fPct(tCons / tLend * 100));
        setText('l-mikro-pct',    fPct(tMikro / tLend * 100));
        setText('l-sme-pct',      fPct(tSme   / tLend * 100));
    }

    const nplCard = document.getElementById('kpi-npl-lending');
    if (nplCard) nplCard.className = 'kpi-card ' + (avgNpl >= 3 ? 'kpi-danger' : avgNpl >= 2.5 ? 'kpi-warn' : 'kpi-green');

    if (avgNpl > 3) setText('lending-insight', `⚠️ NPL ${fPct(avgNpl)} melewati threshold 3%. Fokus recovery & restrukturisasi segera.`);
    else            setText('lending-insight', `✅ NPL ${fPct(avgNpl)} terjaga. Pertumbuhan kredit on-track. Total outstanding ${fRp(tLend)}.`);

    const lGetKey = l => { const d = new Date(l.tanggal); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const months  = [...new Set(lending.map(lGetKey))].sort();
    const mLabels = months.map(getMonthLabel);
    const segs    = ['Konsumer', 'Mikro', 'SME', 'Ritel'];
    const segColors = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.orange, CHART_COLORS.purple];

    destroyChart('lTrend');
    const ctxLT = document.getElementById('lending-trend-chart');
    if (ctxLT) {
        window.appState.charts.lTrend = new Chart(ctxLT, {
            type: 'bar',
            data: {
                labels: mLabels,
                datasets: segs.map((seg, i) => ({
                    label: seg,
                    data:  months.map(m => lending.filter(l => l.segmen === seg && lGetKey(l) === m).reduce((s, x) => s + x.nominal, 0) / 1e9),
                    backgroundColor: segColors[i], borderRadius: 3, borderSkipped: false
                }))
            },
            options: { ...commonOptions, scales: { y: { stacked: true, ticks: { callback: v => v.toFixed(0) + ' M' }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { stacked: true, grid: { display: false } } } }
        });
    }

    destroyChart('lSeg');
    const ctxLS = document.getElementById('lending-seg-chart');
    if (ctxLS) {
        const segVals = segs.map(seg => lending.filter(l => l.segmen === seg).reduce((s, i) => s + i.nominal, 0) / 1e9);
        window.appState.charts.lSeg = new Chart(ctxLS, {
            type: 'doughnut',
            data: { labels: segs, datasets: [{ data: segVals, backgroundColor: segColors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
        });
        if (tLend > 0) setText('lending-donut-center', fPct(tCons / tLend * 100));
        const leg = document.getElementById('lending-donut-legend');
        if (leg) leg.innerHTML = segs.map((l, i) => `<div class="legend-item"><div class="legend-dot" style="background:${segColors[i]}"></div>${l}</div>`).join('');
    }

    const products = [...new Set(lending.filter(l => l.npl !== null).map(l => l.produk))].sort();
    const prodNpl  = products.map(p => {
        const items = lending.filter(l => l.produk === p && l.npl !== null);
        return items.length ? items.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / items.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
    });

    destroyChart('nplProd');
    const ctxNP = document.getElementById('npl-product-chart');
    if (ctxNP) {
        const nplColors = prodNpl.map(v => v >= 3 ? 'rgba(239,68,68,.8)' : v >= 2.5 ? 'rgba(245,158,11,.8)' : 'rgba(16,185,129,.8)');
        window.appState.charts.nplProd = new Chart(ctxNP, {
            type: 'bar',
            data: { labels: products, datasets: [{ label: 'NPL Ratio (%)', data: prodNpl, backgroundColor: nplColors, borderRadius: 4, borderSkipped: false }] },
            options: { ...commonOptions, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { max: Math.max(...prodNpl, 5) + 1, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,.04)' } }, y: { grid: { display: false } } } }
        });
    }

    const lUnits  = [...new Set(lending.map(l => l.unit))].sort();
    const unitNpl = lUnits.map(u => {
        const items = lending.filter(l => l.unit === u && l.npl !== null);
        return items.length ? items.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / items.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
    });

    destroyChart('nplUnit');
    const ctxNU = document.getElementById('npl-unit-chart');
    if (ctxNU) {
        window.appState.charts.nplUnit = new Chart(ctxNU, {
            type: 'bar',
            data: { labels: lUnits.map(u => u.replace('KCP ', '').replace('KC ', '')), datasets: [{ label: 'NPL Ratio (%)', data: unitNpl, backgroundColor: unitNpl.map(v => v >= 3 ? 'rgba(239,68,68,.7)' : v >= 2.5 ? 'rgba(245,158,11,.7)' : 'rgba(16,185,129,.7)'), borderColor: unitNpl.map(v => v >= 3 ? CHART_COLORS.red : v >= 2.5 ? CHART_COLORS.orange : CHART_COLORS.green), borderWidth: 1.5, borderRadius: 4, borderSkipped: false }] },
            options: { ...commonOptions, plugins: { legend: { display: false } }, scales: { y: { max: Math.max(...unitNpl, 4) + 1, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } }
        });
    }

    // ── SME & Konsumer vs RKA ───────────────────────────────
    const getKey = l => { const d = new Date(l.tanggal); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    const lMonths = [...new Set(lending.map(getKey))].sort();
    
    const buildRka = (id, segmen, color) => {
        destroyChart(id);
        const ctx = document.getElementById(id + '-chart');
        if (ctx && lMonths.length) {
            const val = lMonths.map(m => lending.filter(l => l.segmen === segmen && getKey(l) === m).reduce((s, i) => s + i.nominal, 0) / 1e9);
            const rka = val.map((v, i) => v * (1.03 - Math.sin(i)*0.02)); // mock varying target
            window.appState.charts[id] = new Chart(ctx, {
                type: 'bar',
                data: { labels: lMonths.map(getMonthLabel), datasets: [
                    { label: `Realisasi ${segmen}`, data: val, backgroundColor: color, borderRadius: 3, order: 2 },
                    { label: 'Target RKA', data: rka, type: 'line', borderColor: CHART_COLORS.orange, borderWidth: 2, borderDash: [5, 5], pointRadius: 0, fill: false, order: 1 }
                ] },
                options: { ...commonOptions, scales: { y: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + ' M' }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } }
            });
        }
    };

    buildRka('sme-rka', 'SME', CHART_COLORS.blue);
    buildRka('konsumer-rka', 'Konsumer', CHART_COLORS.blue2);
}

// ══════════════════════════════════════════════════
// UNIT PERFORMANCE VIEW
// ══════════════════════════════════════════════════
function renderUnitView(funding, lending) {
    const units  = [...new Set([...funding.map(f => f.unit), ...lending.map(l => l.unit)])].sort();
    const shortU = u => u.replace('KCP ', '').replace('KC ', 'KC ');

    const uFund = units.map(u => funding.filter(f => f.unit === u).reduce((s, i) => s + i.nominal, 0) / 1e9);
    const uLend = units.map(u => lending.filter(l => l.unit === u).reduce((s, i) => s + i.nominal, 0) / 1e9);

    destroyChart('uCompare');
    const ctxUC = document.getElementById('unit-compare-chart');
    if (ctxUC) {
        window.appState.charts.uCompare = new Chart(ctxUC, {
            type: 'bar',
            data: { labels: units.map(shortU), datasets: [{ label: 'DPK', data: uFund, backgroundColor: CHART_COLORS.blue, borderRadius: 5, borderSkipped: false }, { label: 'Kredit', data: uLend, backgroundColor: CHART_COLORS.green, borderRadius: 5, borderSkipped: false }] },
            options: { ...commonOptions, scales: { y: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + ' M' }, grid: { color: 'rgba(0,0,0,.04)' } }, x: { grid: { display: false } } } }
        });
    }

    destroyChart('uShare');
    const ctxUS = document.getElementById('unit-share-chart');
    if (ctxUS) {
        const tF = uFund.reduce((s, v) => s + v, 0);
        window.appState.charts.uShare = new Chart(ctxUS, {
            type: 'bar',
            data: { labels: ['DPK'], datasets: units.map((u, i) => ({ label: shortU(u), data: [uFund[i] / tF * 100], backgroundColor: UNIT_COLORS[i % UNIT_COLORS.length], borderWidth: 0 })) },
            options: { ...commonOptions, indexAxis: 'y', plugins: { legend: { position: 'right' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}%` } } }, scales: { x: { stacked: true, max: 100, ticks: { callback: v => v + '%' }, grid: { display: false } }, y: { stacked: true, grid: { display: false } } } }
        });
    }

    const scatterData = units.map(u => {
        const lUnit = lending.filter(l => l.unit === u && l.npl !== null);
        const npl   = lUnit.length ? lUnit.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / lUnit.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
        const dpk   = funding.filter(f => f.unit === u).reduce((s, i) => s + i.nominal, 0) / 1e9;
        return { x: dpk, y: npl, label: shortU(u) };
    });

    destroyChart('uScatter');
    const ctxSc = document.getElementById('unit-scatter-chart');
    if (ctxSc) {
        window.appState.charts.uScatter = new Chart(ctxSc, {
            type: 'scatter',
            data: { datasets: scatterData.map((d, i) => ({ label: d.label, data: [{ x: d.x, y: d.y }], backgroundColor: UNIT_COLORS[i % UNIT_COLORS.length], pointRadius: 10, pointHoverRadius: 13 })) },
            options: { ...commonOptions, interaction: { mode: 'point' }, plugins: { legend: { position: 'right' } }, scales: { x: { title: { display: true, text: 'DPK (Miliar Rp)' }, grid: { color: 'rgba(0,0,0,.04)' } }, y: { title: { display: true, text: 'NPL Ratio (%)' }, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,.04)' } } } }
        });
    }

    const sc = document.getElementById('unit-scorecard');
    if (sc) {
        sc.innerHTML = units.map(u => {
            const uf    = funding.filter(f => f.unit === u).reduce((s, i) => s + i.nominal, 0);
            const ul    = lending.filter(l => l.unit === u).reduce((s, i) => s + i.nominal, 0);
            const lUnit = lending.filter(l => l.unit === u && l.npl !== null);
            const npl   = lUnit.length ? lUnit.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / lUnit.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
            const casaU = funding.filter(f => f.unit === u && !isDeposito(f.produk)).reduce((s, i) => s + i.nominal, 0);
            const casaR = uf > 0 ? casaU / uf * 100 : 0;
            const nplClass  = npl >= 3 ? 'sc-bad' : npl >= 2.5 ? 'sc-warn' : 'sc-good';
            const casaClass = casaR >= 60 ? 'sc-good' : casaR >= 50 ? 'sc-warn' : 'sc-bad';
            return `<div class="scorecard-row">
                <div class="sc-unit">${u}</div>
                <div class="sc-metric"><div class="sc-label">DPK</div><div class="sc-value">${fRp(uf)}</div></div>
                <div class="sc-metric"><div class="sc-label">Kredit</div><div class="sc-value">${fRp(ul)}</div></div>
                <div class="sc-metric"><div class="sc-label">CASA</div><span class="sc-badge ${casaClass}">${fPct(casaR)}</span></div>
                <div class="sc-metric"><div class="sc-label">NPL</div><span class="sc-badge ${nplClass}">${fPct(npl)}</span></div>
            </div>`;
        }).join('');
    }
}

// ══════════════════════════════════════════════════
// RISK MATRIX (analytics-driven)
// ══════════════════════════════════════════════════
function renderRiskMatrix(riskMatrix) {
    const el = document.getElementById('risk-matrix');
    if (!el) return;
    if (!riskMatrix || !riskMatrix.length) { el.innerHTML = ''; return; }

    const catColor = { 'Tinggi': '#EF4444', 'Waspada': '#F97316', 'Sedang': '#F59E0B', 'Rendah': '#10B981' };
    const trendIcon = d => d === 'improving' ? '↓' : d === 'deteriorating' ? '↑' : '→';
    const trendCls  = d => d === 'improving' ? 'rm-ok' : d === 'deteriorating' ? 'rm-danger' : 'rm-neutral';

    const rows = riskMatrix.map((u, i) => {
        const cc    = catColor[u.category] || '#94A3B8';
        const nplCls = u.npl >= 3 ? 'rm-danger' : u.npl >= 2.5 ? 'rm-warn' : 'rm-ok';
        const smlCls = u.sml > 4 ? 'rm-danger' : u.sml > 3 ? 'rm-warn' : 'rm-ok';
        const tDir   = u.trends?.nplTrend?.direction || 'stable';
        const barW   = Math.round(u.riskIndex);
        const barC   = u.riskIndex > 50 ? '#EF4444' : u.riskIndex > 35 ? '#F59E0B' : '#10B981';
        return `<tr>
            <td class="rm-rank">${i + 1}</td>
            <td class="rm-unit">${u.unit}</td>
            <td><span class="rm-badge ${nplCls}">${u.npl.toFixed(2)}%</span></td>
            <td><span class="rm-badge ${smlCls}">${u.sml.toFixed(2)}%</span></td>
            <td>
                <div class="rm-bar-row">
                    <div class="rm-bar-track"><div class="rm-bar-fill" style="width:${barW}%;background:${barC}"></div></div>
                    <span class="rm-bar-val" style="color:${barC}">${u.riskIndex.toFixed(1)}</span>
                </div>
            </td>
            <td><span class="rm-trend ${trendCls(tDir)}">${trendIcon(tDir)} ${tDir === 'improving' ? 'Membaik' : tDir === 'deteriorating' ? 'Memburuk' : 'Stabil'}</span></td>
            <td><span class="rm-cat-badge" style="background:${cc}22;color:${cc};border:1px solid ${cc}44">${u.category}</span></td>
        </tr>`;
    }).join('');

    el.innerHTML = `
    <div class="card">
        <div class="card-hd card-hd-flex">
            <div>
                <div class="card-title">🟥 Risk Matrix — Prioritisasi Unit</div>
                <div class="card-sub">Diurutkan: risiko tertinggi dahulu (riskIndex ↓)</div>
            </div>
        </div>
        <div class="table-wrapper">
            <table class="rm-table">
                <thead><tr><th>#</th><th>Unit Kerja</th><th>NPL</th><th>SML</th><th>Risk Index↑</th><th>NPL Trend</th><th>Kategori</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>`;
}

// ══════════════════════════════════════════════════
// GROWTH MATRIX (analytics-driven)
// ══════════════════════════════════════════════════
function renderGrowthMatrix(growthMatrix) {
    const el = document.getElementById('growth-matrix');
    if (!el) return;
    if (!growthMatrix || !growthMatrix.length) { el.innerHTML = ''; return; }

    const gCls = v => v < 0 ? 'gm-danger' : v < 1.5 ? 'gm-warn' : 'gm-ok';
    const gTxt = v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';

    const rows = growthMatrix.map((u, i) => {
        const barW = Math.round(u.growthScore);
        const barC = u.growthScore > 65 ? '#10B981' : u.growthScore > 45 ? '#F59E0B' : '#EF4444';
        return `<tr>
            <td class="rm-rank">${i + 1}</td>
            <td class="rm-unit">${u.unit}</td>
            <td><span class="rm-badge ${gCls(u.casaGrowth)}">${gTxt(u.casaGrowth)}</span></td>
            <td><span class="rm-badge ${gCls(u.giroGrowth)}">${gTxt(u.giroGrowth)}</span></td>
            <td><span class="rm-badge ${gCls(u.tabunganGrowth)}">${gTxt(u.tabunganGrowth)}</span></td>
            <td><span class="rm-badge ${gCls(u.lendingGrowth)}">${gTxt(u.lendingGrowth)}</span></td>
            <td><span class="rm-badge ${gCls(u.channelGrowth)}">${gTxt(u.channelGrowth)}</span></td>
            <td>
                <div class="rm-bar-row">
                    <div class="rm-bar-track"><div class="rm-bar-fill" style="width:${barW}%;background:${barC}"></div></div>
                    <span class="rm-bar-val" style="color:${barC}">${u.growthScore.toFixed(1)}</span>
                </div>
            </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
    <div class="card">
        <div class="card-hd card-hd-flex">
            <div>
                <div class="card-title">📈 Growth Matrix — Momentum Analisis</div>
                <div class="card-sub">Diurutkan: pertumbuhan tertinggi dahulu (growthScore ↓)</div>
            </div>
        </div>
        <div class="table-wrapper">
            <table class="rm-table">
                <thead><tr><th>#</th><th>Unit Kerja</th><th>CASA Growth</th><th>Giro</th><th>Tabungan</th><th>Kredit</th><th>Channel</th><th>Growth Score</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>`;
}

// ══════════════════════════════════════════════════
// RISK & ALERTS VIEW
// ══════════════════════════════════════════════════
function renderRiskView(funding, lending) {
    const units = [...new Set([...funding.map(f => f.unit), ...lending.map(l => l.unit)])];

    let cNpl = 0, cCasa = 0, cGrowth = 0, cChannel = 0;

    units.forEach(u => {
        const lUnit = lending.filter(l => l.unit === u && l.npl !== null);
        if (lUnit.length) {
            const avg = lUnit.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / lUnit.reduce((s, i) => s + i.nominal, 0) * 100;
            if (avg > 3) cNpl++;
            const avgG = lUnit.reduce((s, i) => s + i.growth, 0) / lUnit.length;
            if (avgG < 0) cGrowth++;
        }
        const fUnit = funding.filter(f => f.unit === u && !isDeposito(f.produk));
        if (fUnit.length) { const casaG = fUnit.reduce((s, i) => s + i.growth, 0) / fUnit.length; if (casaG < 0) cCasa++; }
        const chUnit = funding.filter(f => f.unit === u);
        if (chUnit.length) { const fG = chUnit.reduce((s, i) => s + i.growth, 0) / chUnit.length; if (fG < 2) cChannel++; }
    });

    setText('r-npl-count',     cNpl     + ' Unit');
    setText('r-casa-count',    cCasa    + ' Unit');
    setText('r-growth-count',  cGrowth  + ' Unit');
    setText('r-channel-count', cChannel + ' Unit');

    const thead = document.querySelector('#risk-heatmap-table thead');
    const tbody = document.querySelector('#risk-heatmap-table tbody');
    if (!thead || !tbody) return;

    const allProds = [...new Set([...funding.map(f => f.produk), ...lending.map(l => l.produk)])].sort();

    thead.innerHTML = `<tr><th>Unit Kerja</th>${allProds.map(p => `<th>${p}</th>`).join('')}</tr>`;

    tbody.innerHTML = units.sort().map(u => {
        const cells = allProds.map(p => {
            const items = [...funding, ...lending].filter(d => d.unit === u && d.produk === p);
            if (!items.length) return `<td class="hm-empty">–</td>`;
            const type = items[0].jenis_produk;
            let cls, txt;
            if (type === 'Lending') {
                const nItems = items.filter(i => i.npl !== null);
                const npl    = nItems.length ? nItems.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / nItems.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
                txt = fPct(npl);
                cls = npl >= 3 ? 'hm-red' : npl >= 2.5 ? 'hm-yellow' : 'hm-green';
            } else {
                const g = items.reduce((s, i) => s + i.growth, 0) / items.length;
                txt = (g > 0 ? '+' : '') + fPct(g);
                cls = g < -1 ? 'hm-red' : g < 2 ? 'hm-yellow' : 'hm-green';
            }
            return `<td class="${cls}">${txt}</td>`;
        }).join('');
        return `<tr><td>${u}</td>${cells}</tr>`;
    }).join('');
}

// ══════════════════════════════════════════════════
// INPUT DATA TABLE
// ══════════════════════════════════════════════════
function setupInputListeners() {
    document.getElementById('btn-add-row')?.addEventListener('click', () => {
        const tbody = document.querySelector('#editable-data-table tbody');
        const today = new Date().toISOString().split('T')[0];
        const tr    = document.createElement('tr');
        tr.className = 'tr-modified new-row';
        tr.innerHTML = `
            <td><input type="date" class="ec ec-modified" data-f="tanggal" value="${today}"></td>
            <td><select class="ec ec-modified" data-f="unit">${unitOpts('')}</select></td>
            <td><select class="ec ec-modified" data-f="jenis_produk">${jenisOpts('')}</select></td>
            <td><select class="ec ec-modified" data-f="segmen">${segmenOpts('')}</select></td>
            <td><input type="text" class="ec ec-modified" data-f="produk" placeholder="cth: Tabungan"></td>
            <td><input type="number" class="ec ec-modified" data-f="nominal" value="0"></td>
            <td><input type="number" step="0.01" class="ec ec-modified" data-f="npl" placeholder="–"></td>
            <td><input type="number" step="0.01" class="ec ec-modified" data-f="growth" value="0"></td>
            <td><button class="btn-del" onclick="this.closest('tr').remove()"><i data-lucide="x"></i></button></td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
        attachRowListeners(tr);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    document.getElementById('btn-save-table')?.addEventListener('click', async () => {
        const rows = document.querySelectorAll('#editable-data-table tbody tr.tr-modified');
        if (!rows.length) { alert('Tidak ada perubahan untuk disimpan.'); return; }
        let count = 0;
        for (const tr of rows) {
            const id  = tr.getAttribute('data-id');
            const obj = {};
            tr.querySelectorAll('.ec').forEach(inp => { obj[inp.dataset.f] = inp.value; });
            if (!obj.tanggal || !obj.unit || !obj.jenis_produk || !obj.segmen || !obj.produk) {
                alert('Kolom Tanggal, Unit, Jenis, Segmen, dan Produk wajib diisi.'); return;
            }
            if (id) { obj.id = id; await window.dbManager.updateData(obj); }
            else await window.dbManager.addData(obj);
            count++;
        }
        alert(`✅ ${count} baris berhasil disimpan.`);
        await refreshAll();
    });

    document.getElementById('btn-reset-db')?.addEventListener('click', async () => {
        if (confirm('Reset database ke data simulasi? Semua perubahan akan hilang.')) {
            await window.dbManager.clearAllData();
            await window.dbManager.initDummyData();
            alert('Database berhasil di-reset.');
            await refreshAll();
        }
    });
}

function renderInputTable(data) {
    const tbody = document.querySelector('#editable-data-table tbody');
    if (!tbody) return;

    const display = [...data].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)).slice(0, 150);
    tbody.innerHTML = '';

    if (!display.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#94A3B8">Belum ada data. Klik Tambah atau Reset untuk data simulasi.</td></tr>`;
        return;
    }

    display.forEach(item => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', item.id);
        tr.innerHTML = `
            <td><input type="date" class="ec" data-f="tanggal" value="${item.tanggal || ''}"></td>
            <td><select class="ec" data-f="unit">${unitOpts(item.unit)}</select></td>
            <td><select class="ec" data-f="jenis_produk">${jenisOpts(item.jenis_produk)}</select></td>
            <td><select class="ec" data-f="segmen">${segmenOpts(item.segmen)}</select></td>
            <td><input type="text" class="ec" data-f="produk" value="${item.produk || ''}"></td>
            <td><input type="number" class="ec" data-f="nominal" value="${item.nominal || 0}"></td>
            <td><input type="number" step="0.01" class="ec" data-f="npl" value="${item.npl !== null && item.npl !== undefined ? item.npl : ''}"></td>
            <td><input type="number" step="0.01" class="ec" data-f="growth" value="${item.growth || 0}"></td>
            <td><button class="btn-del" onclick="delRow(${item.id})"><i data-lucide="trash-2"></i></button></td>
        `;
        tbody.appendChild(tr);
        attachRowListeners(tr);
    });
}

function attachRowListeners(tr) {
    tr.querySelectorAll('.ec').forEach(inp => {
        inp.addEventListener('change', () => {
            tr.classList.add('tr-modified');
            inp.classList.add('ec-modified');
        });
    });
}

window.delRow = async (id) => {
    if (confirm('Hapus baris ini secara permanen?')) {
        await window.dbManager.deleteData(id);
        await refreshAll();
    }
};

// ── Options helpers ─────────────────────────────────────────────────────────

// PHASE 1: KCP BUMN added to unit list
function unitOpts(sel) {
    return [
        'KC Veteran', 'KCP Taspen', 'KCP Pertamina',
        'KCP Abdul Muis', 'KCP Depkeu', 'KCP Lemhanas',
        'KCP BUMN'
    ].map(o => `<option value="${o}"${sel === o ? ' selected' : ''}>${o}</option>`).join('');
}

function jenisOpts(sel) {
    return ['Funding', 'Lending', 'Channel']
        .map(o => `<option value="${o}"${sel === o ? ' selected' : ''}>${o}</option>`).join('');
}

function segmenOpts(sel) {
    return ['Mikro', 'Ritel', 'Konsumer', 'SME']
        .map(o => `<option value="${o}"${sel === o ? ' selected' : ''}>${o}</option>`).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// DAILY MODE — helpers, event visualization, chart renderers
// ══════════════════════════════════════════════════════════════════════════════

// ── Section visibility toggle ─────────────────────────────────────────────────
function _setDailyMode(active) {
    const MONTHLY_IDS = [
        'funding-trend-card', 'funding-donut-row', 'channel-card',
        'lending-trend-card', 'lending-seg-row', 'lending-npl-unit-card',
    ];
    const DAILY_IDS = [
        'funding-daily-section', 'lending-daily-section',
        'calendar-exec-daily',
    ];
    MONTHLY_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = active ? 'none' : ''; });
    DAILY_IDS.forEach  (id => { const el = document.getElementById(id); if (el) el.style.display = active ? ''     : 'none'; });

    // Update exec trend card subtitle
    const sub = document.getElementById('exec-trend-sub');
    if (sub) sub.textContent = active ? 'Data harian — titik merah = hari libur' : 'Data bulanan (Jan 2025 – Mar 2026)';
    const ttl = document.getElementById('exec-trend-title');
    if (ttl) ttl.textContent = active ? 'Tren DPK vs Kredit (Harian)' : 'Tren DPK vs Kredit';
}

// ── Event map helper ──────────────────────────────────────────────────────────
function getEventMap() {
    const map = {};
    (window.IMPORTANT_DAYS || []).forEach(e => { map[e.date] = e.label; });
    return map;
}

// ── Calendar panel renderer ───────────────────────────────────────────────────
function renderImportantDays(containerId, start, end) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const list = (window.IMPORTANT_DAYS || [])
        .filter(d => {
            const dt = new Date(d.date);
            return (!start || dt >= start) && (!end || dt <= end);
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    if (!list.length) {
        el.innerHTML = '<div class="cal-empty">Tidak ada hari penting dalam rentang ini.</div>';
        return;
    }
    el.innerHTML = list.map(d => {
        const dt  = new Date(d.date);
        const lbl = dt.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
        return `<div class="calendar-item">
            <span class="cal-dot"></span>
            <span class="cal-date">${lbl}</span>
            <span class="cal-label">${d.label}</span>
        </div>`;
    }).join('');
}

// ── Chart.js plugin: vertical dashed lines on event dates ─────────────────────
const eventLinePlugin = {
    id: 'eventLines',
    afterDraw(chart) {
        const { ctx, scales } = chart;
        if (!scales.x || !scales.y) return;
        const { x, y } = scales;
        const eMap = getEventMap();
        chart.data.labels.forEach((label, i) => {
            const key = String(label).slice(0, 10);
            if (!eMap[key]) return;
            const xPos = x.getPixelForValue(i);
            ctx.save();
            ctx.strokeStyle = 'rgba(239,68,68,0.35)';
            ctx.lineWidth   = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(xPos, y.top);
            ctx.lineTo(xPos, y.bottom);
            ctx.stroke();
            ctx.restore();
        });
    }
};

// ── Data helpers ──────────────────────────────────────────────────────────────
function groupByDay(arr) {
    return arr.reduce((acc, item) => {
        acc[item.tanggal] = (acc[item.tanggal] || 0) + item.nominal;
        return acc;
    }, {});
}

function getDayLabel(k) {
    return new Date(k + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

// Returns point color & radius arrays: red+large on event days, normal otherwise
function buildPointStyles(dates, eMap, normalColor) {
    return {
        colors: dates.map(d => eMap[d] ? '#EF4444' : normalColor),
        radii:  dates.map(d => eMap[d] ? 7 : 3),
    };
}

// Tooltip afterLabel callback factory
function makeTooltipCb(dates, eMap) {
    return {
        afterLabel: ctx => {
            const key = dates[ctx.dataIndex];
            return eMap[key] ? '📅 ' + eMap[key] : '';
        }
    };
}

// ── Daily refresh entry point ─────────────────────────────────────────────────
async function refreshDailyMode() {
    const allDaily = window.DAILY_DATA || [];
    if (!allDaily.length) {
        console.warn('[Harian] window.DAILY_DATA is empty — run Reset Data in Input section first.');
        return;
    }

    const { startDate, endDate, units } = window.appState.filters;

    const filtered = allDaily.filter(item => {
        const d = new Date(item.tanggal + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); if (d > e) return false; }
        if (units.length && !units.includes(item.unit)) return false;
        return true;
    });

    const funding = filtered.filter(d => d.jenis_produk === 'Funding');
    const lending = filtered.filter(d => d.jenis_produk === 'Lending');
    const channel = filtered.filter(d => d.jenis_produk === 'Channel');

    const fmt   = d => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const label = startDate && endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : 'Mode Harian';
    document.getElementById('current-date-filter').textContent = '📅 Harian: ' + label;

    renderExecDaily(funding, lending);
    renderFundingDaily(funding, channel);
    renderLendingDaily(lending);

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Executive Daily ───────────────────────────────────────────────────────────
function renderExecDaily(funding, lending) {
    const eMap  = getEventMap();
    const dates = [...new Set([...funding, ...lending].map(d => d.tanggal))].sort();
    const dF    = groupByDay(funding);
    const dL    = groupByDay(lending);
    const ptF   = buildPointStyles(dates, eMap, CHART_COLORS.blue);
    const ptL   = buildPointStyles(dates, eMap, CHART_COLORS.blue2);
    const ttCb  = makeTooltipCb(dates, eMap);

    destroyChart('trend');
    const ctxT = document.getElementById('trend-chart');
    if (ctxT) {
        window.appState.charts.trend = new Chart(ctxT, {
            type: 'line',
            plugins: [eventLinePlugin],
            data: {
                labels: dates.map(getDayLabel),
                datasets: [
                    { label: 'DPK',    data: dates.map(d => (dF[d] || 0) / 1e12), borderColor: CHART_COLORS.blue,  backgroundColor: 'rgba(8,87,195,.08)',   borderWidth: 2.5, tension: 0.3, fill: true, pointRadius: ptF.radii, pointBackgroundColor: ptF.colors, pointHoverRadius: 9 },
                    { label: 'Kredit', data: dates.map(d => (dL[d] || 0) / 1e12), borderColor: CHART_COLORS.blue2, backgroundColor: 'rgba(48,127,226,.08)', borderWidth: 2.5, tension: 0.3, fill: true, pointRadius: ptL.radii, pointBackgroundColor: ptL.colors, pointHoverRadius: 9 },
                ]
            },
            options: {
                ...commonOptions,
                plugins: { ...commonOptions.plugins, tooltip: { ...commonOptions.plugins.tooltip, callbacks: ttCb } },
                scales: {
                    y: { ticks: { callback: v => 'Rp ' + v.toFixed(2) + ' T' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 20, maxRotation: 45 } }
                }
            }
        });
    }

    // KPI cards — use last available day totals
    if (dates.length) {
        const lastDate   = dates[dates.length - 1];
        const dayFunding = funding.filter(i => i.tanggal === lastDate);
        const dayLending = lending.filter(i => i.tanggal === lastDate);
        const tF  = dayFunding.reduce((s, i) => s + i.nominal, 0);
        const tL  = dayLending.reduce((s, i) => s + i.nominal, 0);
        const ldrV = tF > 0 ? tL / tF * 100 : 0;
        const wNpl = dayLending.filter(i => i.npl !== null);
        const aNpl = wNpl.length ? wNpl.reduce((s, i) => s + i.nominal * (i.npl / 100), 0) / wNpl.reduce((s, i) => s + i.nominal, 0) * 100 : 0;
        const casa = dayFunding.filter(f => !isDeposito(f.produk)).reduce((s, i) => s + i.nominal, 0);
        const casaR = tF > 0 ? casa / tF * 100 : 0;

        setText('kpi-total-funding', fRp(tF));
        setText('kpi-total-lending', fRp(tL));
        setText('kpi-avg-npl',       fPct(aNpl));
        setText('kpi-ldr',           fPct(ldrV));
        setText('kpi-casa-ratio',    fPct(casaR));

        const nplCard = document.getElementById('kpi-npl-card');
        if (nplCard) nplCard.className = 'kpi-card ' + (aNpl >= 3 ? 'kpi-danger' : aNpl >= 2.5 ? 'kpi-warn' : 'kpi-green');
    }

    // Calendar panel in exec section
    const { startDate, endDate } = window.appState.filters;
    renderImportantDays('calendar-exec-daily-inner', startDate, endDate);
}

// ── Funding Daily ─────────────────────────────────────────────────────────────
function renderFundingDaily(funding, channel) {
    const eMap   = getEventMap();
    const dates  = [...new Set(funding.map(f => f.tanggal))].sort();
    const dGiro  = groupByDay(funding.filter(f => isGiro(f.produk)));
    const dTab   = groupByDay(funding.filter(f => !isDeposito(f.produk) && !isGiro(f.produk)));
    const dDepo  = groupByDay(funding.filter(f => isDeposito(f.produk)));
    const ttCb   = makeTooltipCb(dates, eMap);

    const ptG = buildPointStyles(dates, eMap, CHART_COLORS.blue);
    const ptT = buildPointStyles(dates, eMap, CHART_COLORS.purple);
    const ptD = buildPointStyles(dates, eMap, CHART_COLORS.orange);

    destroyChart('fDailyTrend');
    const ctx = document.getElementById('funding-daily-chart');
    if (ctx) {
        window.appState.charts.fDailyTrend = new Chart(ctx, {
            type: 'line',
            plugins: [eventLinePlugin],
            data: {
                labels: dates.map(getDayLabel),
                datasets: [
                    { label: 'Giro',     data: dates.map(d => (dGiro[d] || 0) / 1e9), borderColor: CHART_COLORS.blue,   backgroundColor: 'rgba(8,87,195,.07)',   borderWidth: 2, tension: 0.3, fill: true, pointRadius: ptG.radii, pointBackgroundColor: ptG.colors, pointHoverRadius: 8 },
                    { label: 'Tabungan', data: dates.map(d => (dTab[d]  || 0) / 1e9), borderColor: CHART_COLORS.purple, backgroundColor: 'rgba(139,92,246,.07)', borderWidth: 2, tension: 0.3, fill: true, pointRadius: ptT.radii, pointBackgroundColor: ptT.colors, pointHoverRadius: 8 },
                    { label: 'Deposito', data: dates.map(d => (dDepo[d] || 0) / 1e9), borderColor: CHART_COLORS.orange, backgroundColor: 'rgba(245,158,11,.07)', borderWidth: 2, tension: 0.3, fill: true, pointRadius: ptD.radii, pointBackgroundColor: ptD.colors, pointHoverRadius: 8 },
                ]
            },
            options: {
                ...commonOptions,
                plugins: { ...commonOptions.plugins, tooltip: { ...commonOptions.plugins.tooltip, callbacks: ttCb } },
                scales: {
                    y: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + 'M' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 20, maxRotation: 45 } }
                }
            }
        });
    }

    const { startDate, endDate } = window.appState.filters;
    renderImportantDays('calendar-funding-daily', startDate, endDate);
}

// ── Lending Daily ─────────────────────────────────────────────────────────────
function renderLendingDaily(lending) {
    const eMap  = getEventMap();
    const dates = [...new Set(lending.map(l => l.tanggal))].sort();

    const segs      = ['Konsumer', 'SME', 'Ritel', 'Mikro'];
    const segColors = [CHART_COLORS.blue, CHART_COLORS.orange, CHART_COLORS.purple, CHART_COLORS.green];
    const ttCb      = makeTooltipCb(dates, eMap);

    const datasets = segs.map((seg, si) => {
        const dSeg = groupByDay(lending.filter(l => l.segmen === seg));
        const pt   = buildPointStyles(dates, eMap, segColors[si]);
        return {
            label: seg,
            data:  dates.map(d => (dSeg[d] || 0) / 1e9),
            borderColor:          segColors[si],
            backgroundColor:      segColors[si] + '12',
            borderWidth: 2, tension: 0.3, fill: true,
            pointRadius:          pt.radii,
            pointBackgroundColor: pt.colors,
            pointHoverRadius:     8,
        };
    });

    destroyChart('lDailyTrend');
    const ctx = document.getElementById('lending-daily-chart');
    if (ctx) {
        window.appState.charts.lDailyTrend = new Chart(ctx, {
            type: 'line',
            plugins: [eventLinePlugin],
            data: { labels: dates.map(getDayLabel), datasets },
            options: {
                ...commonOptions,
                plugins: { ...commonOptions.plugins, tooltip: { ...commonOptions.plugins.tooltip, callbacks: ttCb } },
                scales: {
                    y: { ticks: { callback: v => 'Rp ' + v.toFixed(0) + 'M' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 20, maxRotation: 45 } }
                }
            }
        });
    }

    const { startDate, endDate } = window.appState.filters;
    renderImportantDays('calendar-lending-daily', startDate, endDate);
}
