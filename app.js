/**
 * app.js — BRInsight Application Logic
 * Redesigned: proper chart selection, complete views, no overflow
 */

// ══════════════════════════════════════════════════
// AUTH — Login / Logout / Session
// ══════════════════════════════════════════════════

(function initAuth() {
    const AUTH_KEY   = 'brinsight_user';
    const VALID_USER = { username: 'admin', password: 'bri123' };

    /** Check localStorage and show/hide the overlay accordingly */
    window.checkAuth = function () {
        const overlay   = document.getElementById('login-overlay');
        const appContainer = document.getElementById('app-container');
        const isLoggedIn = !!localStorage.getItem(AUTH_KEY);
        if (overlay) overlay.style.display = isLoggedIn ? 'none' : 'flex';
        if (appContainer) appContainer.style.display = isLoggedIn ? 'flex' : 'none';
    };

    /** Validate credentials and grant access */
    window.login = function () {
        const uEl  = document.getElementById('login-username');
        const pEl  = document.getElementById('login-password');
        const err  = document.getElementById('login-err');
        const u    = uEl ? uEl.value.trim() : '';
        const p    = pEl ? pEl.value : '';

        if (u === VALID_USER.username && p === VALID_USER.password) {
            localStorage.setItem(AUTH_KEY, JSON.stringify({ username: u }));
            const overlay = document.getElementById('login-overlay');
            const appContainer = document.getElementById('app-container');
            if (overlay) overlay.style.display = 'none';
            if (appContainer) appContainer.style.display = 'flex';
            if (err) err.style.display = 'none';
        } else {
            if (err) {
                err.textContent = 'Username atau password salah';
                err.style.display = 'block';
            }
            // Shake the username/password fields gently
            [uEl, pEl].forEach(el => {
                if (!el) return;
                el.animate([
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-6px)' },
                    { transform: 'translateX(6px)' },
                    { transform: 'translateX(-4px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300, easing: 'ease-out' });
            });
        }
    };

    /** Clear session and reload to show login again */
    window.logout = function () {
        localStorage.removeItem(AUTH_KEY);
        location.reload();
    };

    // Run the auth check immediately (before DOM content loaded fires for charts)
    document.addEventListener('DOMContentLoaded', () => {
        window.checkAuth();

        // Enter key on password field triggers login
        const pwdEl = document.getElementById('login-password');
        if (pwdEl) pwdEl.addEventListener('keydown', e => { if (e.key === 'Enter') window.login(); });
        const userEl = document.getElementById('login-username');
        if (userEl) userEl.addEventListener('keydown', e => { if (e.key === 'Enter') window.login(); });

        // Logout popup toggle on user-chip click
        const chip   = document.getElementById('user-chip-btn');
        const popup  = document.getElementById('logout-popup');
        if (chip && popup) {
            chip.addEventListener('click', e => {
                e.stopPropagation();
                popup.style.display = popup.style.display === 'none' || !popup.style.display
                    ? 'block' : 'none';
            });
            // Close popup when clicking anywhere else
            document.addEventListener('click', () => {
                if (popup) popup.style.display = 'none';
            });
        }
    });
})();

// ══════════════════════════════════════════════════
// APP STATE
// ══════════════════════════════════════════════════

window.appState = {
    filters: { startDate: null, endDate: null, units: [] },
    charts: {}
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
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.view-section');
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
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    document.getElementById('filter-start').valueAsDate = sixMonthsAgo;
    document.getElementById('filter-end').valueAsDate = today;

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const preset = btn.dataset.preset;
            let start = new Date();
            if (preset === '1M')  start.setMonth(today.getMonth() - 1);
            else if (preset === '3M')  start.setMonth(today.getMonth() - 3);
            else if (preset === 'QTD') start = new Date(today.getFullYear(), Math.floor(today.getMonth()/3)*3, 1);
            else if (preset === 'YTD') start = new Date(today.getFullYear(), 0, 1);
            document.getElementById('filter-start').valueAsDate = start;
            document.getElementById('filter-end').valueAsDate = today;
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
}

function applyFilters(data) {
    const { startDate, endDate, units } = window.appState.filters;
    const fmt = (d) => d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    const label = startDate && endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : 'Semua Waktu';

    const filtered = data.filter(item => {
        const d = new Date(item.tanggal);
        if (startDate && d < startDate) return false;
        if (endDate) { const e = new Date(endDate); e.setHours(23,59,59,999); if (d > e) return false; }
        if (units.length && !units.includes(item.unit)) return false;
        return true;
    });

    return { filtered, label };
}

// ══════════════════════════════════════════════════
// REFRESH
// ══════════════════════════════════════════════════
async function refreshAll() {
    const raw = await window.dbManager.getAllData();
    const { filtered, label } = applyFilters(raw);

    document.getElementById('current-date-filter').textContent = 'Periode: ' + label;

    // Populate unit dropdown
    const allUnits = [...new Set(raw.map(d => d.unit))].sort();
    const unitSel = document.getElementById('filter-units');
    if (unitSel) {
        const cur = unitSel.value;
        unitSel.innerHTML = '<option value="ALL">Semua Unit</option>' +
            allUnits.map(u => `<option value="${u}"${cur===u?' selected':''}>${u}</option>`).join('');
    }

    const funding  = filtered.filter(d => d.jenis_produk === 'Funding');
    const lending  = filtered.filter(d => d.jenis_produk === 'Lending');
    const channel  = filtered.filter(d => d.jenis_produk === 'Channel');

    renderExecView(funding, lending);
    renderFundingView(funding, channel);
    renderLendingView(lending);
    renderUnitView(funding, lending);
    renderRiskView(funding, lending);
    renderInputTable(raw);

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ══════════════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════════════
function fRp(n) {
    if (n >= 1e12) return 'Rp ' + (n/1e12).toFixed(2) + ' T';
    if (n >= 1e9)  return 'Rp ' + (n/1e9).toFixed(1) + ' M';
    if (n >= 1e6)  return 'Rp ' + (n/1e6).toFixed(0) + ' Jt';
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function fRpFull(n) {
    return new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(n);
}

function fPct(n) { return (+n).toFixed(2) + '%'; }

function isDeposito(p) { return p.toLowerCase().includes('deposito'); }
function isGiro(p)     { return p.toLowerCase().includes('giro'); }

function groupByMonth(arr) {
    return arr.reduce((acc, item) => {
        const d = new Date(item.tanggal);
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        acc[k] = (acc[k] || 0) + item.nominal;
        return acc;
    }, {});
}

function getMonthLabel(k) {
    const [y, m] = k.split('-');
    return new Date(y, m-1, 1).toLocaleDateString('id-ID', { month:'short', year:'2-digit' });
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

const UNIT_COLORS = ['#0857C3','#307FE2','#0EA5E9','#10B981','#F59E0B','#8B5CF6'];

// Chart.js defaults
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size   = 11;
    Chart.defaults.color       = '#94A3B8';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.padding  = 12;
}

const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
            backgroundColor: '#1E3A5F',
            titleColor: '#fff',
            bodyColor: 'rgba(255,255,255,.85)',
            padding: 12,
            cornerRadius: 10,
            boxPadding: 4,
        }
    }
};

// ══════════════════════════════════════════════════
// EXECUTIVE VIEW
// ══════════════════════════════════════════════════
function renderExecView(funding, lending) {
    const tFunding = funding.reduce((s,i) => s+i.nominal, 0);
    const tLending = lending.reduce((s,i) => s+i.nominal, 0);
    const tCasa    = funding.filter(f => !isDeposito(f.produk)).reduce((s,i) => s+i.nominal, 0);
    const tDepo    = funding.filter(f => isDeposito(f.produk)).reduce((s,i) => s+i.nominal, 0);
    const casaR    = tFunding > 0 ? tCasa/tFunding*100 : 0;
    const ldr      = tFunding > 0 ? tLending/tFunding*100 : 0;

    const lendWithNpl = lending.filter(i => i.npl !== null);
    const avgNpl = lendWithNpl.length
        ? lendWithNpl.reduce((s,i) => s + i.nominal * (i.npl/100), 0)
          / lendWithNpl.reduce((s,i) => s + i.nominal, 0) * 100
        : 0;

    setText('kpi-total-funding', fRp(tFunding));
    setText('kpi-total-lending', fRp(tLending));
    setText('kpi-casa-ratio',    fPct(casaR));
    setText('kpi-avg-npl',       fPct(avgNpl));
    setText('kpi-ldr',           fPct(ldr));

    // NPL card color
    const nplCard = document.getElementById('kpi-npl-card');
    if (nplCard) {
        nplCard.className = 'kpi-card ' + (avgNpl > 3 ? 'kpi-danger' : avgNpl > 2 ? 'kpi-warn' : 'kpi-green');
    }

    // Insight
    let insight = '';
    if (avgNpl > 3) insight = `⚠️ NPL ${fPct(avgNpl)} melampaui threshold 3%. Segera review portofolio kredit berisiko.`;
    else if (casaR < 60) insight = `📉 CASA Ratio ${fPct(casaR)} di bawah target 60%. Intensifkan penghimpunan giro & tabungan.`;
    else if (ldr > 92) insight = `📈 LDR ${fPct(ldr)} mendekati batas atas 92%. Pertimbangkan akselerasi DPK.`;
    else insight = `✅ Kinerja cabang dalam kondisi baik. DPK ${fRp(tFunding)}, Kredit ${fRp(tLending)}, NPL ${fPct(avgNpl)} (aman).`;
    setText('insight-text', insight);

    // Trend Chart — Line dual axis
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
                    {
                        label: 'DPK',
                        data: months.map(m => (dFunding[m]||0)/1e12),
                        borderColor: CHART_COLORS.blue,
                        backgroundColor: 'rgba(8,87,195,.08)',
                        borderWidth: 2.5,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: CHART_COLORS.blue,
                    },
                    {
                        label: 'Kredit',
                        data: months.map(m => (dLending[m]||0)/1e12),
                        borderColor: CHART_COLORS.blue2,
                        backgroundColor: 'rgba(48,127,226,.08)',
                        borderWidth: 2.5,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: CHART_COLORS.blue2,
                    }
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
                        funding.filter(f => isGiro(f.produk)).reduce((s,i)=>s+i.nominal,0)/1e12,
                        funding.filter(f => !isDeposito(f.produk) && !isGiro(f.produk)).reduce((s,i)=>s+i.nominal,0)/1e12,
                        tDepo/1e12
                    ],
                    backgroundColor: [CHART_COLORS.blue, CHART_COLORS.blue2, CHART_COLORS.orange],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: { legend: { display: false }, tooltip: commonOptions.plugins.tooltip }
            }
        });
        setText('donut-center-label', fPct(casaR));
        const legend = document.getElementById('donut-legend');
        if (legend) {
            const colors = [CHART_COLORS.blue, CHART_COLORS.blue2, CHART_COLORS.orange];
            const labels = ['Giro', 'Tabungan', 'Deposito'];
            legend.innerHTML = labels.map((l,i) => `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div>${l}</div>`).join('');
        }
    }

    // Executive Unit Performance Table
    const perfBody = document.getElementById('exec-unit-perf-body');
    if (perfBody) {
        const units = [...new Set([...funding.map(f=>f.unit), ...lending.map(l=>l.unit)])].sort();
        perfBody.innerHTML = units.map(u => {
            const uf = funding.filter(f=>f.unit===u).reduce((s,i)=>s+i.nominal,0);
            const ul = lending.filter(l=>l.unit===u).reduce((s,i)=>s+i.nominal,0);
            const lUnit = lending.filter(l=>l.unit===u&&l.npl!==null);
            const npl = lUnit.length ? lUnit.reduce((s,i)=>s+i.nominal*(i.npl/100),0)/lUnit.reduce((s,i)=>s+i.nominal,0)*100 : 0;
            const ldr = uf > 0 ? ul/uf*100 : 0;
            const nplCls = npl>3?'badge-danger':npl>2?'badge-warn':'badge-success';
            const ldrCls = ldr>92?'badge-danger':ldr>85?'badge-warn':'badge-success';
            const stCls  = (npl>3||ldr>92)?'badge-danger':(npl>2||ldr>85)?'badge-warn':'badge-success';
            const stTxt  = (npl>3||ldr>92)?'Kritis':(npl>2||ldr>85)?'Perhatian':'Sehat';
            const uShort = u.replace('KCP ','').replace('KC ','KC ');
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

    // Unit Bar (hidden canvas — kept for JS compatibility)
    const units = [...new Set([...funding.map(f=>f.unit), ...lending.map(l=>l.unit)])].sort();
    const uFund = units.map(u => funding.filter(f=>f.unit===u).reduce((s,i)=>s+i.nominal,0)/1e9);
    const uLend = units.map(u => lending.filter(l=>l.unit===u).reduce((s,i)=>s+i.nominal,0)/1e9);
    const shortUnit = u => u.replace('KCP ','').replace('KC ','KC ');

    destroyChart('unit');
    const ctxU = document.getElementById('unit-chart');
    if (ctxU) {
        window.appState.charts.unit = new Chart(ctxU, {
            type: 'bar',
            data: {
                labels: units.map(shortUnit),
                datasets: [
                    { label: 'DPK',    data: uFund, backgroundColor: CHART_COLORS.blue,  borderRadius: 4, borderSkipped: false },
                    { label: 'Kredit', data: uLend, backgroundColor: CHART_COLORS.blue2, borderRadius: 4, borderSkipped: false }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { ticks: { callback: v => 'Rp '+v.toFixed(0)+' M' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Rankings
    const byUnit = lending.reduce((acc,i) => { acc[i.unit]=(acc[i.unit]||0)+i.nominal; return acc; }, {});
    const sorted = Object.entries(byUnit).sort((a,b)=>b[1]-a[1]);
    const rankColors = ['gold','silver','bronze'];
    const rl = document.getElementById('rank-top-3');
    if (rl) {
        rl.innerHTML = sorted.length
            ? sorted.slice(0,5).map((item,i) => `
                <li>
                    <div class="rank-unit"><div class="rank-num ${rankColors[i]||''}">${i+1}</div>${item[0]}</div>
                    <div class="rank-val">${fRp(item[1])}</div>
                </li>`).join('')
            : '<li class="empty-info">Tidak ada data</li>';
    }

    // Alerts
    const alerts = document.getElementById('dashboard-alerts');
    if (alerts) {
        const critical = lending.filter(d => d.npl !== null && d.npl > 3);
        const byUnitNpl = critical.reduce((acc,i) => { if(!acc[i.unit] || acc[i.unit] < i.npl) acc[i.unit]=i.npl; return acc; }, {});
        const alertHtml = Object.entries(byUnitNpl).slice(0,4).map(([unit, npl]) => `
            <div class="alert-item a-danger">
                <div class="alert-icon"><i data-lucide="alert-octagon"></i></div>
                <div><div class="at">NPL Kritis — ${unit}</div><div class="as">Rata-rata NPL ${fPct(npl)} (threshold 3%)</div></div>
            </div>`).join('');
        alerts.innerHTML = alertHtml || '<div class="empty-info">✅ Tidak ada alert risiko saat ini.</div>';

        const badge = document.getElementById('risk-badge');
        if (badge) badge.textContent = Object.keys(byUnitNpl).length;
    }
}

// ══════════════════════════════════════════════════
// FUNDING VIEW
// ══════════════════════════════════════════════════
function renderFundingView(funding, channel) {
    const tFund = funding.reduce((s,i)=>s+i.nominal,0);
    const tGiro = funding.filter(f=>isGiro(f.produk)).reduce((s,i)=>s+i.nominal,0);
    const tTab  = funding.filter(f=>!isDeposito(f.produk)&&!isGiro(f.produk)).reduce((s,i)=>s+i.nominal,0);
    const tDepo = funding.filter(f=>isDeposito(f.produk)).reduce((s,i)=>s+i.nominal,0);
    const casaR = tFund > 0 ? (tGiro+tTab)/tFund*100 : 0;
    // Weighted CoF: deposito 5.5%, giro 0.5%, tabungan 1%
    const cof   = tFund > 0 ? (tDepo*5.5 + tGiro*0.5 + tTab*1.0) / tFund : 0;

    setText('f-total',    fRp(tFund));
    setText('f-giro',     fRp(tGiro));
    setText('f-tabungan', fRp(tTab));
    setText('f-deposito', fRp(tDepo));
    setText('f-casa',     fPct(casaR));
    setText('f-cof',      fPct(cof));
    if(tFund>0) {
        setText('f-giro-pct',  fPct(tGiro/tFund*100) + ' dari total');
        setText('f-tab-pct',   fPct(tTab/tFund*100) + ' dari total');
        setText('f-dep-pct',   fPct(tDepo/tFund*100) + ' dari total');
    }

    // Funding insight
    if (casaR >= 60) setText('funding-insight', `CASA Ratio ${fPct(casaR)} — posisi baik. Cost of Fund terkelola di ${fPct(cof)}.`);
    else setText('funding-insight', `CASA Ratio ${fPct(casaR)} di bawah target 60%. Intensifkan penghimpunan giro & tabungan payroll.`);

    // Stacked Area Chart — DPK breakdown per bulan
    const months = [...new Set(funding.map(f => { const d=new Date(f.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }))].sort();
    const mLabels = months.map(getMonthLabel);

    const giroByM  = months.map(m => funding.filter(f=>isGiro(f.produk)).filter(f=>{ const d=new Date(f.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===m; }).reduce((s,i)=>s+i.nominal,0)/1e9);
    const tabByM   = months.map(m => funding.filter(f=>!isDeposito(f.produk)&&!isGiro(f.produk)).filter(f=>{ const d=new Date(f.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===m; }).reduce((s,i)=>s+i.nominal,0)/1e9);
    const depoByM  = months.map(m => funding.filter(f=>isDeposito(f.produk)).filter(f=>{ const d=new Date(f.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===m; }).reduce((s,i)=>s+i.nominal,0)/1e9);

    destroyChart('fStacked');
    const ctxFS = document.getElementById('funding-stacked-chart');
    if (ctxFS) {
        window.appState.charts.fStacked = new Chart(ctxFS, {
            type: 'line',
            data: {
                labels: mLabels,
                datasets: [
                    { label: 'Giro', data: giroByM, borderColor: CHART_COLORS.blue, backgroundColor: 'rgba(59,130,246,.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3 },
                    { label: 'Tabungan', data: tabByM, borderColor: CHART_COLORS.purple, backgroundColor: 'rgba(139,92,246,.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3 },
                    { label: 'Deposito', data: depoByM, borderColor: CHART_COLORS.orange, backgroundColor: 'rgba(245,158,11,.15)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3 }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { ticks: { callback: v => 'Rp '+v.toFixed(0)+' M' }, stacked: false, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Donut
    destroyChart('fDonut');
    const ctxFD = document.getElementById('funding-donut-chart');
    if (ctxFD) {
        window.appState.charts.fDonut = new Chart(ctxFD, {
            type: 'doughnut',
            data: {
                labels: ['Giro', 'Tabungan', 'Deposito'],
                datasets: [{ data: [tGiro/1e9, tTab/1e9, tDepo/1e9], backgroundColor: [CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.orange], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false } } }
        });
        setText('funding-donut-center', fPct(casaR));
        const leg = document.getElementById('funding-donut-legend');
        if(leg) leg.innerHTML = ['Giro','Tabungan','Deposito'].map((l,i) => `<div class="legend-item"><div class="legend-dot" style="background:${[CHART_COLORS.blue,CHART_COLORS.purple,CHART_COLORS.orange][i]}"></div>${l}</div>`).join('');
    }

    // Unit horizontal bar
    const units = [...new Set(funding.map(f=>f.unit))].sort();
    const uVals = units.map(u => funding.filter(f=>f.unit===u).reduce((s,i)=>s+i.nominal,0)/1e9);
    const sorted = units.map((u,i) => ({u, v: uVals[i]})).sort((a,b)=>a.v-b.v);

    destroyChart('fUnit');
    const ctxFU = document.getElementById('funding-unit-chart');
    if (ctxFU) {
        window.appState.charts.fUnit = new Chart(ctxFU, {
            type: 'bar',
            data: {
                labels: sorted.map(x=>x.u.replace('KCP ','').replace('KC ','')),
                datasets: [{ label: 'DPK (Miliar Rp)', data: sorted.map(x=>x.v), backgroundColor: sorted.map((x,i) => `rgba(59,130,246,${0.4+i/sorted.length*0.6})`), borderRadius: 4, borderSkipped: false }]
            },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { callback: v => 'Rp '+v.toFixed(0)+' M' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    // Channel bar chart
    const chanProducts = ['QRIS','EDC','BRImo','Qlola'];
    const chanColors = [CHART_COLORS.blue, CHART_COLORS.teal, CHART_COLORS.purple, CHART_COLORS.orange];
    const chanVals = chanProducts.map(p => channel.filter(c=>c.produk===p).reduce((s,i)=>s+i.nominal,0)/1e9);

    // Channel trend by month
    const chanMonths = [...new Set(channel.map(c => { const d=new Date(c.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }))].sort();

    destroyChart('channel');
    const ctxCH = document.getElementById('channel-chart');
    if (ctxCH && chanMonths.length) {
        window.appState.charts.channel = new Chart(ctxCH, {
            type: 'bar',
            data: {
                labels: chanMonths.map(getMonthLabel),
                datasets: chanProducts.map((p,i) => ({
                    label: p,
                    data: chanMonths.map(m => channel.filter(c=>c.produk===p).filter(c=>{ const d=new Date(c.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===m; }).reduce((s,x)=>s+x.nominal,0)/1e9),
                    backgroundColor: chanColors[i],
                    borderRadius: 3,
                    borderSkipped: false
                }))
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { stacked: false, ticks: { callback: v => v.toFixed(0)+' M' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

// ══════════════════════════════════════════════════
// LENDING VIEW
// ══════════════════════════════════════════════════
function renderLendingView(lending) {
    const tLend   = lending.reduce((s,i)=>s+i.nominal,0);
    const tCons   = lending.filter(l=>l.segmen==='Konsumer').reduce((s,i)=>s+i.nominal,0);
    const tMikro  = lending.filter(l=>l.segmen==='Mikro').reduce((s,i)=>s+i.nominal,0);
    const tSme    = lending.filter(l=>l.segmen==='SME').reduce((s,i)=>s+i.nominal,0);
    const tRitel  = lending.filter(l=>l.segmen==='Ritel').reduce((s,i)=>s+i.nominal,0);

    const withNpl = lending.filter(i=>i.npl!==null);
    const avgNpl  = withNpl.length ? withNpl.reduce((s,i)=>s+i.nominal*(i.npl/100),0) / withNpl.reduce((s,i)=>s+i.nominal,0) * 100 : 0;
    const sml     = avgNpl * 1.8; // SML biasanya ~1.5–2x NPL

    setText('l-total',    fRp(tLend));
    setText('l-consumer', fRp(tCons));
    setText('l-mikro',    fRp(tMikro));
    setText('l-sme',      fRp(tSme));
    setText('l-npl',      fPct(avgNpl));
    setText('l-sml',      fPct(sml));

    if(tLend>0) {
        setText('l-consumer-pct', fPct(tCons/tLend*100));
        setText('l-mikro-pct',    fPct(tMikro/tLend*100));
        setText('l-sme-pct',      fPct(tSme/tLend*100));
    }

    const nplCard = document.getElementById('kpi-npl-lending');
    if(nplCard) nplCard.className = 'kpi-card ' + (avgNpl>3?'kpi-danger':avgNpl>2?'kpi-warn':'kpi-green');

    // Lending insight
    if (avgNpl > 3) setText('lending-insight', `⚠️ NPL ${fPct(avgNpl)} melewati threshold 3%. Fokus recovery & restrukturisasi segera.`);
    else setText('lending-insight', `✅ NPL ${fPct(avgNpl)} terjaga. Pertumbuhan kredit on-track. Total outstanding ${fRp(tLend)}.`);

    // Stacked Bar — kredit per segmen per bulan
    const months = [...new Set(lending.map(l=>{ const d=new Date(l.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }))].sort();
    const mLabels = months.map(getMonthLabel);
    const segs = ['Konsumer','Mikro','SME','Ritel'];
    const segColors = [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.orange, CHART_COLORS.purple];

    destroyChart('lTrend');
    const ctxLT = document.getElementById('lending-trend-chart');
    if(ctxLT) {
        window.appState.charts.lTrend = new Chart(ctxLT, {
            type: 'bar',
            data: {
                labels: mLabels,
                datasets: segs.map((seg,i) => ({
                    label: seg,
                    data: months.map(m => lending.filter(l=>l.segmen===seg).filter(l=>{ const d=new Date(l.tanggal); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===m; }).reduce((s,x)=>s+x.nominal,0)/1e9),
                    backgroundColor: segColors[i],
                    borderRadius: 3,
                    borderSkipped: false
                }))
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { stacked: true, ticks: { callback: v => v.toFixed(0)+' M' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { stacked: true, grid: { display: false } }
                }
            }
        });
    }

    // Segmen donut
    destroyChart('lSeg');
    const ctxLS = document.getElementById('lending-seg-chart');
    if(ctxLS) {
        const segVals = segs.map(seg => lending.filter(l=>l.segmen===seg).reduce((s,i)=>s+i.nominal,0)/1e9);
        window.appState.charts.lSeg = new Chart(ctxLS, {
            type: 'doughnut',
            data: {
                labels: segs,
                datasets: [{ data: segVals, backgroundColor: segColors, borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
        });
        if(tLend>0) setText('lending-donut-center', fPct(tCons/tLend*100));
        const leg = document.getElementById('lending-donut-legend');
        if(leg) leg.innerHTML = segs.map((l,i)=>`<div class="legend-item"><div class="legend-dot" style="background:${segColors[i]}"></div>${l}</div>`).join('');
    }

    // NPL per product — Horizontal bar vs threshold line
    const products = [...new Set(lending.filter(l=>l.npl!==null).map(l=>l.produk))].sort();
    const prodNpl = products.map(p => {
        const items = lending.filter(l=>l.produk===p&&l.npl!==null);
        return items.length ? items.reduce((s,i)=>s+i.nominal*(i.npl/100),0)/items.reduce((s,i)=>s+i.nominal,0)*100 : 0;
    });

    destroyChart('nplProd');
    const ctxNP = document.getElementById('npl-product-chart');
    if(ctxNP) {
        window.appState.charts.nplProd = new Chart(ctxNP, {
            type: 'bar',
            data: {
                labels: products,
                datasets: [
                    {
                        label: 'NPL Ratio (%)',
                        data: prodNpl,
                        backgroundColor: prodNpl.map(v => v>3?'rgba(239,68,68,.8)':v>2?'rgba(245,158,11,.8)':'rgba(16,185,129,.8)'),
                        borderRadius: 4,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    annotation: {}
                },
                scales: {
                    x: {
                        max: Math.max(...prodNpl, 5) + 1,
                        ticks: { callback: v => v+'%' },
                        grid: { color: 'rgba(0,0,0,.04)' }
                    },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    // NPL per unit — bar
    const units = [...new Set(lending.map(l=>l.unit))].sort();
    const unitNpl = units.map(u => {
        const items = lending.filter(l=>l.unit===u&&l.npl!==null);
        return items.length ? items.reduce((s,i)=>s+i.nominal*(i.npl/100),0)/items.reduce((s,i)=>s+i.nominal,0)*100 : 0;
    });

    destroyChart('nplUnit');
    const ctxNU = document.getElementById('npl-unit-chart');
    if(ctxNU) {
        window.appState.charts.nplUnit = new Chart(ctxNU, {
            type: 'bar',
            data: {
                labels: units.map(u=>u.replace('KCP ','').replace('KC ','')),
                datasets: [{
                    label: 'NPL Ratio (%)',
                    data: unitNpl,
                    backgroundColor: unitNpl.map(v => v>3?'rgba(239,68,68,.7)':v>2?'rgba(245,158,11,.7)':'rgba(16,185,129,.7)'),
                    borderColor:     unitNpl.map(v => v>3?CHART_COLORS.red:v>2?CHART_COLORS.orange:CHART_COLORS.green),
                    borderWidth: 1.5,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                ...commonOptions,
                plugins: { legend: { display: false } },
                scales: {
                    y: { max: Math.max(...unitNpl, 4) + 1, ticks: { callback: v => v+'%' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

// ══════════════════════════════════════════════════
// UNIT PERFORMANCE VIEW
// ══════════════════════════════════════════════════
function renderUnitView(funding, lending) {
    const units = [...new Set([...funding.map(f=>f.unit), ...lending.map(l=>l.unit)])].sort();
    const shortU = u => u.replace('KCP ','').replace('KC ','KC ');

    const uFund = units.map(u=>funding.filter(f=>f.unit===u).reduce((s,i)=>s+i.nominal,0)/1e9);
    const uLend = units.map(u=>lending.filter(l=>l.unit===u).reduce((s,i)=>s+i.nominal,0)/1e9);

    // Grouped bar
    destroyChart('uCompare');
    const ctxUC = document.getElementById('unit-compare-chart');
    if(ctxUC) {
        window.appState.charts.uCompare = new Chart(ctxUC, {
            type: 'bar',
            data: {
                labels: units.map(shortU),
                datasets: [
                    { label: 'DPK', data: uFund, backgroundColor: CHART_COLORS.blue, borderRadius: 5, borderSkipped: false },
                    { label: 'Kredit', data: uLend, backgroundColor: CHART_COLORS.green, borderRadius: 5, borderSkipped: false }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    y: { ticks: { callback: v => 'Rp '+v.toFixed(0)+' M' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Share donut / stacked 100 — DPK share
    destroyChart('uShare');
    const ctxUS = document.getElementById('unit-share-chart');
    if(ctxUS) {
        const tF = uFund.reduce((s,v)=>s+v,0);
        window.appState.charts.uShare = new Chart(ctxUS, {
            type: 'bar',
            data: {
                labels: ['DPK'],
                datasets: units.map((u,i)=>({
                    label: shortU(u),
                    data: [uFund[i]/tF*100],
                    backgroundColor: UNIT_COLORS[i%UNIT_COLORS.length],
                    borderWidth: 0
                }))
            },
            options: {
                ...commonOptions,
                indexAxis: 'y',
                plugins: {
                    legend: { position: 'right' },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}%` } }
                },
                scales: {
                    x: { stacked: true, max: 100, ticks: { callback: v=>v+'%' }, grid: { display: false } },
                    y: { stacked: true, grid: { display: false } }
                }
            }
        });
    }

    // Scatter: DPK total vs NPL rata-rata
    const scatterData = units.map(u => {
        const lUnit = lending.filter(l=>l.unit===u&&l.npl!==null);
        const npl = lUnit.length ? lUnit.reduce((s,i)=>s+i.nominal*(i.npl/100),0)/lUnit.reduce((s,i)=>s+i.nominal,0)*100 : 0;
        const dpk = funding.filter(f=>f.unit===u).reduce((s,i)=>s+i.nominal,0)/1e9;
        return { x: dpk, y: npl, label: shortU(u) };
    });

    destroyChart('uScatter');
    const ctxSc = document.getElementById('unit-scatter-chart');
    if(ctxSc) {
        window.appState.charts.uScatter = new Chart(ctxSc, {
            type: 'scatter',
            data: {
                datasets: scatterData.map((d,i) => ({
                    label: d.label,
                    data: [{ x: d.x, y: d.y }],
                    backgroundColor: UNIT_COLORS[i%UNIT_COLORS.length],
                    pointRadius: 10,
                    pointHoverRadius: 13
                }))
            },
            options: {
                ...commonOptions,
                interaction: { mode: 'point' },
                plugins: { legend: { position: 'right' } },
                scales: {
                    x: { title: { display: true, text: 'DPK (Miliar Rp)' }, grid: { color: 'rgba(0,0,0,.04)' } },
                    y: { title: { display: true, text: 'NPL Ratio (%)' }, ticks: { callback: v=>v+'%' }, grid: { color: 'rgba(0,0,0,.04)' } }
                }
            }
        });
    }

    // Scorecard
    const sc = document.getElementById('unit-scorecard');
    if(sc) {
        const tFund = funding.reduce((s,i)=>s+i.nominal,0);
        const tLend = lending.reduce((s,i)=>s+i.nominal,0);
        sc.innerHTML = units.map(u => {
            const uf = funding.filter(f=>f.unit===u).reduce((s,i)=>s+i.nominal,0);
            const ul = lending.filter(l=>l.unit===u).reduce((s,i)=>s+i.nominal,0);
            const lUnit = lending.filter(l=>l.unit===u&&l.npl!==null);
            const npl = lUnit.length ? lUnit.reduce((s,i)=>s+i.nominal*(i.npl/100),0)/lUnit.reduce((s,i)=>s+i.nominal,0)*100 : 0;
            const casaU = funding.filter(f=>f.unit===u&&!isDeposito(f.produk)).reduce((s,i)=>s+i.nominal,0);
            const casaR = uf>0 ? casaU/uf*100 : 0;
            const nplClass = npl>3?'sc-bad':npl>2?'sc-warn':'sc-good';
            const casaClass = casaR>=60?'sc-good':casaR>=50?'sc-warn':'sc-bad';
            return `
            <div class="scorecard-row">
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
// RISK & ALERTS VIEW
// ══════════════════════════════════════════════════
function renderRiskView(funding, lending) {
    const units = [...new Set([...funding.map(f=>f.unit), ...lending.map(l=>l.unit)])];

    let cNpl=0, cCasa=0, cGrowth=0, cChannel=0;

    units.forEach(u => {
        const lUnit = lending.filter(l=>l.unit===u&&l.npl!==null);
        if(lUnit.length) {
            const avg = lUnit.reduce((s,i)=>s+i.nominal*(i.npl/100),0)/lUnit.reduce((s,i)=>s+i.nominal,0)*100;
            if(avg>3) cNpl++;
            const avgG = lUnit.reduce((s,i)=>s+i.growth,0)/lUnit.length;
            if(avgG<0) cGrowth++;
        }
        const fUnit = funding.filter(f=>f.unit===u&&!isDeposito(f.produk));
        if(fUnit.length) {
            const casaG = fUnit.reduce((s,i)=>s+i.growth,0)/fUnit.length;
            if(casaG<0) cCasa++;
        }
        const chUnit = funding.filter(f=>f.unit===u);
        if(chUnit.length) {
            const fG = chUnit.reduce((s,i)=>s+i.growth,0)/chUnit.length;
            if(fG<2) cChannel++;
        }
    });

    setText('r-npl-count',     cNpl    + ' Unit');
    setText('r-casa-count',    cCasa   + ' Unit');
    setText('r-growth-count',  cGrowth + ' Unit');
    setText('r-channel-count', cChannel+ ' Unit');

    // Heatmap
    const thead = document.querySelector('#risk-heatmap-table thead');
    const tbody = document.querySelector('#risk-heatmap-table tbody');
    if(!thead||!tbody) return;

    const allProds = [...new Set([
        ...funding.map(f=>f.produk),
        ...lending.map(l=>l.produk)
    ])].sort();

    thead.innerHTML = `<tr><th>Unit Kerja</th>${allProds.map(p=>`<th>${p}</th>`).join('')}</tr>`;

    tbody.innerHTML = units.sort().map(u => {
        const cells = allProds.map(p => {
            const items = [...funding,...lending].filter(d=>d.unit===u&&d.produk===p);
            if(!items.length) return `<td class="hm-empty">–</td>`;
            const type = items[0].jenis_produk;
            let cls, txt;
            if(type==='Lending') {
                const nItems = items.filter(i=>i.npl!==null);
                const npl = nItems.length ? nItems.reduce((s,i)=>s+i.nominal*(i.npl/100),0)/nItems.reduce((s,i)=>s+i.nominal,0)*100 : 0;
                txt = fPct(npl);
                cls = npl>3?'hm-red':npl>2?'hm-yellow':'hm-green';
            } else {
                const g = items.reduce((s,i)=>s+i.growth,0)/items.length;
                txt = (g>0?'+':'') + fPct(g);
                cls = g<-1?'hm-red':g<2?'hm-yellow':'hm-green';
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
        const tr = document.createElement('tr');
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
        if(typeof lucide!=='undefined') lucide.createIcons();
    });

    document.getElementById('btn-save-table')?.addEventListener('click', async () => {
        const rows = document.querySelectorAll('#editable-data-table tbody tr.tr-modified');
        if(!rows.length) { alert('Tidak ada perubahan untuk disimpan.'); return; }
        let count = 0;
        for(const tr of rows) {
            const id = tr.getAttribute('data-id');
            const obj = {};
            tr.querySelectorAll('.ec').forEach(inp => { obj[inp.dataset.f] = inp.value; });
            if(!obj.tanggal||!obj.unit||!obj.jenis_produk||!obj.segmen||!obj.produk) {
                alert('Kolom Tanggal, Unit, Jenis, Segmen, dan Produk wajib diisi.'); return;
            }
            if(id) { obj.id = id; await window.dbManager.updateData(obj); }
            else await window.dbManager.addData(obj);
            count++;
        }
        alert(`✅ ${count} baris berhasil disimpan.`);
        await refreshAll();
    });

    document.getElementById('btn-reset-db')?.addEventListener('click', async () => {
        if(confirm('Reset database ke data simulasi? Semua perubahan akan hilang.')) {
            await window.dbManager.clearAllData();
            await window.dbManager.initDummyData();
            alert('Database berhasil di-reset.');
            await refreshAll();
        }
    });
}

function renderInputTable(data) {
    const tbody = document.querySelector('#editable-data-table tbody');
    if(!tbody) return;

    const display = [...data].sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal)).slice(0,150);
    tbody.innerHTML = '';

    if(!display.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#94A3B8">Belum ada data. Klik Tambah atau Reset untuk data simulasi.</td></tr>`;
        return;
    }

    display.forEach(item => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', item.id);
        tr.innerHTML = `
            <td><input type="date" class="ec" data-f="tanggal" value="${item.tanggal||''}"></td>
            <td><select class="ec" data-f="unit">${unitOpts(item.unit)}</select></td>
            <td><select class="ec" data-f="jenis_produk">${jenisOpts(item.jenis_produk)}</select></td>
            <td><select class="ec" data-f="segmen">${segmenOpts(item.segmen)}</select></td>
            <td><input type="text" class="ec" data-f="produk" value="${item.produk||''}"></td>
            <td><input type="number" class="ec" data-f="nominal" value="${item.nominal||0}"></td>
            <td><input type="number" step="0.01" class="ec" data-f="npl" value="${item.npl!==null&&item.npl!==undefined?item.npl:''}"></td>
            <td><input type="number" step="0.01" class="ec" data-f="growth" value="${item.growth||0}"></td>
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
    if(confirm('Hapus baris ini secara permanen?')) {
        await window.dbManager.deleteData(id);
        await refreshAll();
    }
};

// Options helpers
function unitOpts(sel) {
    return ['KC Veteran','KCP Taspen','KCP Pertamina','KCP Lemhanas','KCP Abdul Muis','KCP Depkeu']
        .map(o=>`<option value="${o}"${sel===o?' selected':''}>${o}</option>`).join('');
}

function jenisOpts(sel) {
    return ['Funding','Lending','Channel']
        .map(o=>`<option value="${o}"${sel===o?' selected':''}>${o}</option>`).join('');
}

function segmenOpts(sel) {
    return ['Mikro','Ritel','Konsumer','SME']
        .map(o=>`<option value="${o}"${sel===o?' selected':''}>${o}</option>`).join('');
}


// MOBILE SIDEBAR TOGGLE
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        sidebar.classList.toggle('active');
      }
    });
  }
});
