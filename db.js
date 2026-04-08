/**
 * db.js — BRInsight IndexedDB Manager
 *
 * v10 CHANGES:
 *  - IMPORTANT_DAYS (2025 + 2026) exposed as window.IMPORTANT_DAYS
 *  - DAILY_DATA built deterministically (zero Math.random) — covers:
 *      Jan–Apr 2025 | Dec 2025 | Jan–Apr 2026
 *  - window.DAILY_DATA exposed globally for Harian mode in app.js
 *  - DB bumped to v10 to force fresh monthly seed
 */

// ─── Global product filter constants ───────────────────────────────────────────
window.EXCLUDED_PRODUCTS        = ['KUR Mikro', 'Kupedes', 'Kredit Ritel'];
window.ALLOWED_LENDING_PRODUCTS = ['BRIguna', 'KPR', 'SME CC', 'SME NCC'];

// ─── Indonesian Calendar Events (2025 & 2026) ──────────────────────────────────
window.IMPORTANT_DAYS = [
    // ── 2025 ──────────────────────────────────────────────────────────────
    { date: '2025-01-01', label: 'Tahun Baru 2025' },
    { date: '2025-01-27', label: 'Isra Miraj' },
    { date: '2025-01-29', label: 'Tahun Baru Imlek' },
    { date: '2025-03-28', label: 'Cuti Bersama Lebaran' },
    { date: '2025-03-29', label: 'Nyepi / Cuti Lebaran' },
    { date: '2025-03-30', label: 'Cuti Bersama Lebaran' },
    { date: '2025-03-31', label: 'Idul Fitri 1446H' },
    { date: '2025-04-01', label: 'Idul Fitri 1446H' },
    { date: '2025-04-02', label: 'Cuti Bersama Lebaran' },
    { date: '2025-04-03', label: 'Cuti Bersama Lebaran' },
    { date: '2025-12-25', label: 'Natal' },
    { date: '2025-12-26', label: 'Cuti Bersama Natal' },
    // ── 2026 ──────────────────────────────────────────────────────────────
    { date: '2026-01-01', label: 'Tahun Baru 2026' },
    { date: '2026-01-17', label: 'Isra Miraj' },
    { date: '2026-02-17', label: 'Tahun Baru Imlek' },
    { date: '2026-03-19', label: 'Nyepi' },
    { date: '2026-03-20', label: 'Cuti Bersama Nyepi' },
    { date: '2026-03-27', label: 'Cuti Bersama Lebaran' },
    { date: '2026-03-28', label: 'Cuti Bersama Lebaran' },
    { date: '2026-03-30', label: 'Cuti Bersama Lebaran' },
    { date: '2026-03-31', label: 'Cuti Bersama Lebaran' },
    { date: '2026-04-01', label: 'Idul Fitri 1447H' },
    { date: '2026-04-02', label: 'Idul Fitri 1447H' },
    { date: '2026-04-03', label: 'Cuti Bersama Lebaran' },
    { date: '2026-12-25', label: 'Natal' },
];

// ─── DAILY DATA BUILDER (deterministic, no Math.random) ───────────────────────
(function buildDailyData() {
    const UNITS = [
        { name: 'KC Veteran',     dpkShare: 0.310, lendShare: 0.345, nplBase: 2.10, type: 'all'     },
        { name: 'KCP Taspen',     dpkShare: 0.170, lendShare: 0.200, nplBase: 1.30, type: 'briguna' },
        { name: 'KCP Pertamina',  dpkShare: 0.140, lendShare: 0.155, nplBase: 3.80, type: 'sme'     },
        { name: 'KCP Abdul Muis', dpkShare: 0.130, lendShare: 0.115, nplBase: 2.40, type: 'all'     },
        { name: 'KCP Depkeu',     dpkShare: 0.100, lendShare: 0.065, nplBase: 1.60, type: 'briguna' },
        { name: 'KCP Lemhanas',   dpkShare: 0.078, lendShare: 0.045, nplBase: 2.90, type: 'sme'     },
        { name: 'KCP BUMN',       dpkShare: 0.072, lendShare: 0.075, nplBase: 2.20, type: 'all'     },
    ];

    // Monthly anchors – full year coverage for smooth interpolation
    // [date-of-month-start, total_branch_DPK (T), total_branch_Lending (T)]
    const RAW = [
        ['2025-01-01', 2.480, 1.720], ['2025-02-01', 2.535, 1.762],
        ['2025-03-01', 2.518, 1.798], ['2025-04-01', 2.598, 1.842],
        ['2025-05-01', 2.672, 1.898], ['2025-06-01', 2.806, 1.956],
        ['2025-07-01', 2.845, 1.992], ['2025-08-01', 2.892, 2.031],
        ['2025-09-01', 2.930, 2.068], ['2025-10-01', 2.972, 2.102],
        ['2025-11-01', 3.015, 2.142], ['2025-12-01', 3.088, 2.185],
        ['2026-01-01', 3.105, 2.198], ['2026-02-01', 3.122, 2.212],
        ['2026-03-01', 3.148, 2.232], ['2026-04-01', 3.160, 2.245],
        ['2026-05-01', 3.175, 2.260],
    ];

    const MS = 86400000; // ms per day
    const anchors = RAW.map(([d, dpk, lend]) => ({
        ts: new Date(d).getTime(), dpk: dpk * 1e12, lend: lend * 1e12
    }));

    // Linear interpolation between monthly anchors
    function getBase(ts) {
        for (let i = 0; i < anchors.length - 1; i++) {
            if (ts >= anchors[i].ts && ts < anchors[i + 1].ts) {
                const t = (ts - anchors[i].ts) / (anchors[i + 1].ts - anchors[i].ts);
                return {
                    dpk:  anchors[i].dpk  + t * (anchors[i + 1].dpk  - anchors[i].dpk),
                    lend: anchors[i].lend + t * (anchors[i + 1].lend - anchors[i].lend),
                };
            }
        }
        const z = anchors[anchors.length - 1];
        return { dpk: z.dpk, lend: z.lend };
    }

    // Event-based multiplier (deterministic, distance-based ramps)
    // Returns { dpk, lend } multiplier relative to 1.0 baseline
    function getEventEffect(ts) {
        let dpk = 0, lend = 0;

        for (const evt of window.IMPORTANT_DAYS) {
            const diff = Math.round((ts - new Date(evt.date).getTime()) / MS);
            const big  = evt.label.includes('Idul Fitri') || evt.label.includes('Lebaran');
            const med  = evt.label.includes('Natal');
            const sml  = evt.label.includes('Imlek') || evt.label.includes('Tahun Baru');
            const maxDpkPre  = big ? 0.12 : med ? 0.07 : sml ? 0.05 : 0.03;
            const maxDpkDrop = big ? 0.18 : med ? 0.10 : sml ? 0.07 : 0.04;
            const maxLend    = big ? 0.07 : med ? 0.04 : 0.02;

            // ── PRE-EVENT: DPK accumulates (H-14 → H-1) ────────────────────
            if (diff >= -14 && diff <= -1) {
                const pressure = (14 + diff) / 13; // 0→1 approaching event
                dpk += maxDpkPre * pressure;
            }

            // ── DURING: DPK outflow (H+0 → H+4) ───────────────────────────
            if (diff >= 0 && diff <= 4) {
                const decay = (4 - diff) / 4; // 1 on H+0, 0 on H+4
                dpk -= maxDpkDrop * decay;
            }

            // ── RECOVERY: DPK slowly returns (H+5 → H+18) ─────────────────
            if (diff >= 5 && diff <= 18) {
                const remaining = maxDpkDrop * 0.3; // residual dip
                dpk -= remaining * (18 - diff) / 13;
            }

            // ── LENDING SURGE: (H+7 → H+28, peak at H+14) ─────────────────
            if (diff >= 7 && diff <= 28) {
                const surge = 1 - Math.abs(diff - 14) / 14; // triangle, peak=1
                if (surge > 0) lend += maxLend * surge;
            }
        }

        return {
            dpk:  Math.max(0.80, Math.min(1.18, 1 + dpk)),
            lend: Math.max(0.98, Math.min(1.10, 1 + lend)),
        };
    }

    // Deterministic micro-variation: sine wave per unit (no random)
    function micro(dayIdx, unitIdx, amp, freq, phase) {
        return 1 + amp * Math.sin(dayIdx * freq + unitIdx * phase);
    }

    // NPL calculation: base + seasonal sine + post-event lag bump
    function calcNpl(nplBase, dayIdx, unitIdx) {
        const seasonal  = 0.10 * Math.sin(dayIdx * 0.017 + unitIdx * 0.9); // ~6-month cycle
        const weekly    = 0.03 * Math.sin(dayIdx * 0.90  + unitIdx * 0.5); // weekly ripple
        const raw = nplBase + seasonal + weekly;
        return +Math.min(5.0, Math.max(1.0, raw)).toFixed(2);
    }

    // Dates to generate (3 contiguous ranges)
    const RANGES = [
        { s: '2025-01-01', e: '2025-04-30' },
        { s: '2025-12-01', e: '2025-12-31' },
        { s: '2026-01-01', e: '2026-04-07' },
    ];

    const dailyData = [];
    let dayIdx = 0;

    for (const range of RANGES) {
        const cur = new Date(range.s);
        const end = new Date(range.e);

        while (cur <= end) {
            const ts      = cur.getTime();
            const dateStr = cur.toISOString().slice(0, 10);
            const base    = getBase(ts);
            const evt     = getEventEffect(ts);

            const branchDpk  = base.dpk  * evt.dpk;
            const branchLend = base.lend * evt.lend;

            UNITS.forEach((u, ui) => {
                // Per-unit micro-variation (deterministic sine, different phase each unit)
                const dpkM  = micro(dayIdx, ui, 0.008, 0.11, 0.90);
                const lendM = micro(dayIdx, ui, 0.005, 0.13, 0.85);

                const unitDpk  = branchDpk  * u.dpkShare * dpkM;
                const unitLend = branchLend * u.lendShare * lendM;

                // CASA split (deterministic)
                const casaR = 0.62 + 0.025 * Math.sin(dayIdx * 0.14 + ui * 1.1);
                const giroF = 0.37 + 0.015 * Math.sin(dayIdx * 0.19 + ui * 0.7);
                const giro  = Math.max(0, Math.round(unitDpk * casaR * giroF));
                const tab   = Math.max(0, Math.round(unitDpk * casaR * (1 - giroF)));
                const depo  = Math.max(0, Math.round(unitDpk - giro - tab));

                // Funding records
                dailyData.push({ tanggal: dateStr, unit: u.name, jenis_produk: 'Funding', segmen: 'Ritel',    produk: 'Giro',     nominal: giro, npl: null, sml: null, growth: 0, granularity: 'daily' });
                dailyData.push({ tanggal: dateStr, unit: u.name, jenis_produk: 'Funding', segmen: 'Konsumer', produk: 'Tabungan', nominal: tab,  npl: null, sml: null, growth: 0, granularity: 'daily' });
                dailyData.push({ tanggal: dateStr, unit: u.name, jenis_produk: 'Funding', segmen: 'Ritel',    produk: 'Deposito', nominal: depo, npl: null, sml: null, growth: 0, granularity: 'daily' });

                // Lending records (product split by unit type)
                const mkRecord = (seg, prod, frac, npl) => ({
                    tanggal: dateStr, unit: u.name, jenis_produk: 'Lending',
                    segmen: seg, produk: prod,
                    nominal: Math.round(unitLend * frac),
                    npl, sml: +(npl * 1.4).toFixed(2), growth: 0, granularity: 'daily',
                });

                const nB = calcNpl(u.nplBase, dayIdx, ui);

                if (u.type === 'briguna') {
                    dailyData.push(mkRecord('Konsumer', 'BRIguna', 0.85, Math.max(1.0, Math.min(5.0, nB - 0.2))));
                    dailyData.push(mkRecord('Konsumer', 'KPR',     0.15, Math.max(1.0, Math.min(5.0, nB + 0.3))));

                } else if (u.type === 'sme') {
                    dailyData.push(mkRecord('SME',      'SME CC',  0.45, Math.max(1.0, Math.min(5.0, nB + 0.8))));
                    dailyData.push(mkRecord('SME',      'SME NCC', 0.35, Math.max(1.0, Math.min(5.0, nB + 1.2))));
                    dailyData.push(mkRecord('Konsumer', 'KPR',     0.20, Math.max(1.0, Math.min(5.0, nB))));

                } else { // 'all'
                    dailyData.push(mkRecord('Konsumer', 'BRIguna', 0.38, Math.max(1.0, Math.min(5.0, nB - 0.4))));
                    dailyData.push(mkRecord('Konsumer', 'KPR',     0.27, Math.max(1.0, Math.min(5.0, nB))));
                    dailyData.push(mkRecord('SME',      'SME CC',  0.22, Math.max(1.0, Math.min(5.0, nB + 0.9))));
                    dailyData.push(mkRecord('SME',      'SME NCC', 0.13, Math.max(1.0, Math.min(5.0, nB + 1.3))));
                }
            });

            dayIdx++;
            cur.setDate(cur.getDate() + 1);
        }
    }

    window.DAILY_DATA = dailyData;
    console.log(`[BRInsight] DAILY_DATA built: ${dailyData.length} records across ${dayIdx} days.`);
})();

// ─── IndexedDB Manager ─────────────────────────────────────────────────────────
const DB_NAME    = 'BRInsightDB_v10'; // bumped → forces fresh monthly seed
const DB_VERSION = 1;
const STORE_NAME = 'financial_data';

window.dbManager = {
    db: null,

    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => reject('DB Error: ' + e.target.error);

            request.onsuccess = async (e) => {
                this.db = e.target.result;
                const count = await this.countData();
                if (count === 0) await this.initDummyData();
                resolve(this.db);
            };

            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                if (!this.db.objectStoreNames.contains(STORE_NAME)) {
                    const store = this.db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('tanggal',      'tanggal',      { unique: false });
                    store.createIndex('unit',         'unit',         { unique: false });
                    store.createIndex('jenis_produk', 'jenis_produk', { unique: false });
                }
            };
        });
    },

    countData() {
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction([STORE_NAME], 'readonly');
            const req = tx.objectStore(STORE_NAME).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
    },

    getAllData() {
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction([STORE_NAME], 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror   = (e) => reject(e.target.error);
        });
    },

    addData(data) {
        return new Promise((resolve, reject) => {
            const nplVal = (data.npl !== '' && data.npl !== null && data.npl !== undefined) ? Number(data.npl) : null;
            const tx  = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).add({
                ...data,
                nominal:   Number(data.nominal),
                npl:       nplVal,
                sml:       nplVal !== null ? +(nplVal * (1.2 + Math.random() * 0.6)).toFixed(2) : null,
                growth:    data.growth ? Number(data.growth) : 0,
                timestamp: Date.now(),
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror   = (e) => reject(e.target.error);
        });
    },

    updateData(data) {
        return new Promise((resolve, reject) => {
            const nplVal = (data.npl !== '' && data.npl !== null && data.npl !== undefined) ? Number(data.npl) : null;
            const smlVal = (data.sml !== undefined && data.sml !== null && data.sml !== '')
                ? Number(data.sml)
                : (nplVal !== null ? +(nplVal * (1.2 + Math.random() * 0.6)).toFixed(2) : null);
            const tx  = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).put({
                ...data,
                id:        Number(data.id),
                nominal:   Number(data.nominal),
                npl:       nplVal,
                sml:       smlVal,
                growth:    data.growth ? Number(data.growth) : 0,
                timestamp: Date.now(),
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror   = (e) => reject(e.target.error);
        });
    },

    deleteData(id) {
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(Number(id));
            req.onsuccess = () => resolve();
            req.onerror   = (e) => reject(e.target.error);
        });
    },

    clearAllData() {
        return new Promise((resolve, reject) => {
            const tx  = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror   = (e) => reject(e.target.error);
        });
    },

    // ── Monthly Seed (unchanged logic, updated units/products) ───────────────
    async initDummyData() {
        const units = [
            { name: 'KC Veteran',     dpkShare: 0.310, lendShare: 0.345, nplBase: 2.1, type: 'all'     },
            { name: 'KCP Taspen',     dpkShare: 0.170, lendShare: 0.200, nplBase: 1.3, type: 'briguna' },
            { name: 'KCP Pertamina',  dpkShare: 0.140, lendShare: 0.155, nplBase: 3.8, type: 'sme'     },
            { name: 'KCP Abdul Muis', dpkShare: 0.130, lendShare: 0.115, nplBase: 2.4, type: 'all'     },
            { name: 'KCP Depkeu',     dpkShare: 0.100, lendShare: 0.065, nplBase: 1.6, type: 'briguna' },
            { name: 'KCP Lemhanas',   dpkShare: 0.078, lendShare: 0.045, nplBase: 2.9, type: 'sme'     },
            { name: 'KCP BUMN',       dpkShare: 0.072, lendShare: 0.075, nplBase: 2.2, type: 'all'     },
        ];

        // 15 months: Jan 2025 – Mar 2026
        const months = [
            { date: '2025-01-31', dpkTotal: 2480000000000, lendTotal: 1720000000000 },
            { date: '2025-02-28', dpkTotal: 2535000000000, lendTotal: 1762000000000 },
            { date: '2025-03-31', dpkTotal: 2518000000000, lendTotal: 1798000000000 },
            { date: '2025-04-30', dpkTotal: 2598000000000, lendTotal: 1842000000000 },
            { date: '2025-05-31', dpkTotal: 2672000000000, lendTotal: 1898000000000 },
            { date: '2025-06-30', dpkTotal: 2806000000000, lendTotal: 1956000000000 },
            { date: '2025-07-31', dpkTotal: 2845000000000, lendTotal: 1992000000000 },
            { date: '2025-08-31', dpkTotal: 2892000000000, lendTotal: 2031000000000 },
            { date: '2025-09-30', dpkTotal: 2930000000000, lendTotal: 2068000000000 },
            { date: '2025-10-31', dpkTotal: 2972000000000, lendTotal: 2102000000000 },
            { date: '2025-11-30', dpkTotal: 3015000000000, lendTotal: 2142000000000 },
            { date: '2025-12-31', dpkTotal: 3088000000000, lendTotal: 2185000000000 },
            { date: '2026-01-31', dpkTotal: 3105000000000, lendTotal: 2198000000000 },
            { date: '2026-02-28', dpkTotal: 3122000000000, lendTotal: 2212000000000 },
            { date: '2026-03-31', dpkTotal: 3148000000000, lendTotal: 2232000000000 },
        ];

        const rnd = (min, max) => Math.random() * (max - min) + min;
        const r2  = (n) => +n.toFixed(2);

        const data = [];
        let id = 1;

        months.forEach((m, mi) => {
            units.forEach(u => {
                const unitDpk  = m.dpkTotal  * u.dpkShare;
                const unitLend = m.lendTotal * u.lendShare;
                const prevDpk  = mi > 0 ? months[mi - 1].dpkTotal  * u.dpkShare  : unitDpk;
                const prevLend = mi > 0 ? months[mi - 1].lendTotal * u.lendShare : unitLend;

                const dpkGrowth  = r2(((unitDpk  / prevDpk)  - 1) * 100);
                const lendGrowth = r2(((unitLend / prevLend) - 1) * 100);

                const casaR = rnd(0.60, 0.65);
                const giro  = Math.round(unitDpk * casaR * 0.36);
                const tab   = Math.round(unitDpk * casaR * 0.64);
                const depo  = Math.round(unitDpk - giro - tab);

                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Funding', segmen: 'Ritel',    produk: 'Giro',     nominal: giro, npl: null, sml: null, growth: r2(dpkGrowth + rnd(-0.3, 0.5)),  granularity: 'monthly' });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Funding', segmen: 'Konsumer', produk: 'Tabungan', nominal: tab,  npl: null, sml: null, growth: r2(dpkGrowth + rnd(-0.2, 0.4)),  granularity: 'monthly' });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Funding', segmen: 'Ritel',    produk: 'Deposito', nominal: depo, npl: null, sml: null, growth: r2(dpkGrowth + rnd(-0.5, 0.3)),  granularity: 'monthly' });

                const qrisBase  = unitDpk * 0.038 * (1 + mi * 0.085);
                const edcBase   = unitDpk * 0.030 * (1 + mi * 0.020);
                const brimoBase = unitDpk * 0.165 * (1 + mi * 0.055);
                const qlolaBase = (u.type !== 'briguna') ? unitDpk * 0.055 : unitDpk * 0.012;

                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'Ritel',    produk: 'QRIS',  nominal: Math.round(qrisBase),  npl: null, sml: null, growth: r2(mi * 3.5 + rnd(5, 10)), granularity: 'monthly' });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'Ritel',    produk: 'EDC',   nominal: Math.round(edcBase),   npl: null, sml: null, growth: r2(rnd(1.5, 3.5)),          granularity: 'monthly' });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'Konsumer', produk: 'BRImo', nominal: Math.round(brimoBase), npl: null, sml: null, growth: r2(mi * 2.0 + rnd(4, 8)),   granularity: 'monthly' });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'SME',      produk: 'Qlola', nominal: Math.round(qlolaBase), npl: null, sml: null, growth: r2(rnd(1.0, 3.0)),          granularity: 'monthly' });

                const mkSml = (v) => r2(v * (1.2 + rnd(0, 0.6)));
                const nplV  = rnd(-0.4, 0.6);

                if (u.type === 'briguna') {
                    const n1 = r2(u.nplBase + nplV),  n2 = r2(u.nplBase + 0.4 + nplV);
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'BRIguna', nominal: Math.round(unitLend * 0.85), npl: n1, sml: mkSml(n1), growth: r2(lendGrowth + rnd(0, 0.5)), granularity: 'monthly' });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'KPR',     nominal: Math.round(unitLend * 0.15), npl: n2, sml: mkSml(n2), growth: r2(lendGrowth),               granularity: 'monthly' });

                } else if (u.type === 'sme') {
                    const n1 = r2(u.nplBase + 0.9 + nplV), n2 = r2(u.nplBase + 1.3 + nplV), n3 = r2(u.nplBase + nplV);
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'SME',      produk: 'SME CC',  nominal: Math.round(unitLend * 0.45), npl: n1, sml: mkSml(n1), growth: r2(lendGrowth - 0.5), granularity: 'monthly' });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'SME',      produk: 'SME NCC', nominal: Math.round(unitLend * 0.35), npl: n2, sml: mkSml(n2), growth: r2(lendGrowth - 1.0), granularity: 'monthly' });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'KPR',     nominal: Math.round(unitLend * 0.20), npl: n3, sml: mkSml(n3), growth: r2(lendGrowth),      granularity: 'monthly' });

                } else {
                    const n1 = r2(u.nplBase - 0.4 + nplV), n2 = r2(u.nplBase + nplV), n3 = r2(u.nplBase + 1.0 + nplV), n4 = r2(u.nplBase + 1.3 + nplV);
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'BRIguna', nominal: Math.round(unitLend * 0.38), npl: n1, sml: mkSml(n1), growth: r2(lendGrowth + 0.8), granularity: 'monthly' });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'KPR',     nominal: Math.round(unitLend * 0.27), npl: n2, sml: mkSml(n2), growth: r2(lendGrowth),      granularity: 'monthly' });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'SME',      produk: 'SME CC',  nominal: Math.round(unitLend * 0.22), npl: n3, sml: mkSml(n3), growth: r2(lendGrowth - 0.4), granularity: 'monthly' });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'SME',      produk: 'SME NCC', nominal: Math.round(unitLend * 0.13), npl: n4, sml: mkSml(n4), growth: r2(lendGrowth - 0.8), granularity: 'monthly' });
                }
            });
        });

        return new Promise((resolve, reject) => {
            const tx    = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            data.forEach(item => store.add({ ...item, timestamp: Date.now() }));
            tx.oncomplete = () => resolve();
            tx.onerror    = (e) => reject(e);
        });
    },
};
