/**
 * db.js — BRInsight IndexedDB Manager
 * Data realistis KC Veteran Jakarta — Jan 2025 s/d Mar 2026 (15 bulan)
 */

const DB_NAME = 'BRInsightDB_v7';
const DB_VERSION = 1;
const STORE_NAME = 'financial_data';

window.dbManager = {
    db: null,

    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => reject("DB Error: " + e.target.error);

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
                    store.createIndex('tanggal', 'tanggal', { unique: false });
                    store.createIndex('unit', 'unit', { unique: false });
                    store.createIndex('jenis_produk', 'jenis_produk', { unique: false });
                }
            };
        });
    },

    countData() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readonly');
            const req = tx.objectStore(STORE_NAME).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    getAllData() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    addData(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).add({
                ...data,
                nominal: Number(data.nominal),
                npl: (data.npl !== '' && data.npl !== null && data.npl !== undefined) ? Number(data.npl) : null,
                growth: data.growth ? Number(data.growth) : 0,
                timestamp: Date.now()
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    updateData(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).put({
                ...data,
                id: Number(data.id),
                nominal: Number(data.nominal),
                npl: (data.npl !== '' && data.npl !== null && data.npl !== undefined) ? Number(data.npl) : null,
                growth: data.growth ? Number(data.growth) : 0,
                timestamp: Date.now()
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    deleteData(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(Number(id));
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    },

    clearAllData() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async initDummyData() {
        /**
         * KC VETERAN JAKARTA — Jan 2025 – Mar 2026 (15 bulan)
         * DPK tumbuh Rp 2.48T → Rp 3.14T (+26.6% YoY)
         * Kredit tumbuh Rp 1.72T → Rp 2.23T (+29.7% YoY)
         * CASA Ratio 60–65%
         * NPL cabang 1.3–4.2% per unit
         * LDR 70–76%
         */

        const units = [
            { name: 'KC Veteran',       dpkShare: 0.340, lendShare: 0.375, nplBase: 2.1, type: 'all' },
            { name: 'KCP Taspen',       dpkShare: 0.180, lendShare: 0.220, nplBase: 1.3, type: 'briguna' },
            { name: 'KCP Pertamina',    dpkShare: 0.150, lendShare: 0.165, nplBase: 3.8, type: 'sme' },
            { name: 'KCP Abdul Muis',   dpkShare: 0.140, lendShare: 0.125, nplBase: 2.4, type: 'all' },
            { name: 'KCP Depkeu',       dpkShare: 0.108, lendShare: 0.068, nplBase: 1.6, type: 'briguna' },
            { name: 'KCP Lemhanas',     dpkShare: 0.082, lendShare: 0.047, nplBase: 2.9, type: 'sme' },
        ];

        // 15 bulan: Jan 2025 – Mar 2026 — tren naik bertahap
        const months = [
            { date: '2025-01-31', dpkTotal: 2480000000000, lendTotal: 1720000000000 },
            { date: '2025-02-28', dpkTotal: 2535000000000, lendTotal: 1762000000000 },
            { date: '2025-03-31', dpkTotal: 2518000000000, lendTotal: 1798000000000 }, // koreksi DPK Mar
            { date: '2025-04-30', dpkTotal: 2598000000000, lendTotal: 1842000000000 },
            { date: '2025-05-31', dpkTotal: 2672000000000, lendTotal: 1898000000000 },
            { date: '2025-06-30', dpkTotal: 2806000000000, lendTotal: 1956000000000 }, // semester tutup
            { date: '2025-07-31', dpkTotal: 2845000000000, lendTotal: 1992000000000 },
            { date: '2025-08-31', dpkTotal: 2892000000000, lendTotal: 2031000000000 },
            { date: '2025-09-30', dpkTotal: 2930000000000, lendTotal: 2068000000000 }, // kuartal 3
            { date: '2025-10-31', dpkTotal: 2972000000000, lendTotal: 2102000000000 },
            { date: '2025-11-30', dpkTotal: 3015000000000, lendTotal: 2142000000000 },
            { date: '2025-12-31', dpkTotal: 3088000000000, lendTotal: 2185000000000 }, // year-end
            { date: '2026-01-31', dpkTotal: 3105000000000, lendTotal: 2198000000000 },
            { date: '2026-02-28', dpkTotal: 3122000000000, lendTotal: 2212000000000 },
            { date: '2026-03-31', dpkTotal: 3148000000000, lendTotal: 2232000000000 }, // Q1 2026
        ];

        const rnd = (min, max) => Math.random() * (max - min) + min;
        const r2  = (n) => +n.toFixed(2);

        const data = [];
        let id = 1;

        months.forEach((m, mi) => {
            units.forEach(u => {
                const unitDpk  = m.dpkTotal  * u.dpkShare;
                const unitLend = m.lendTotal * u.lendShare;
                const prevDpk  = mi > 0 ? months[mi-1].dpkTotal  * u.dpkShare  : unitDpk;
                const prevLend = mi > 0 ? months[mi-1].lendTotal * u.lendShare : unitLend;

                const dpkGrowth  = r2(((unitDpk  / prevDpk)  - 1) * 100);
                const lendGrowth = r2(((unitLend / prevLend) - 1) * 100);

                // DPK breakdown — CASA ratio 60–65%
                const casaR = rnd(0.60, 0.65);
                const giro  = Math.round(unitDpk * casaR * 0.36);
                const tab   = Math.round(unitDpk * casaR * 0.64);
                const depo  = Math.round(unitDpk - giro - tab);

                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Funding', segmen: 'Ritel',    produk: 'Giro',     nominal: giro, npl: null, growth: r2(dpkGrowth + rnd(-0.3, 0.5)) });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Funding', segmen: 'Konsumer', produk: 'Tabungan', nominal: tab,  npl: null, growth: r2(dpkGrowth + rnd(-0.2, 0.4)) });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Funding', segmen: 'Ritel',    produk: 'Deposito', nominal: depo, npl: null, growth: r2(dpkGrowth + rnd(-0.5, 0.3)) });

                // Channel — tumbuh konsisten
                const qrisBase  = unitDpk * 0.038 * (1 + mi * 0.085);
                const edcBase   = unitDpk * 0.030 * (1 + mi * 0.020);
                const brimoBase = unitDpk * 0.165 * (1 + mi * 0.055);
                const qlolaBase = (u.type !== 'briguna') ? unitDpk * 0.055 : unitDpk * 0.012;

                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'Ritel',    produk: 'QRIS',  nominal: Math.round(qrisBase),  npl: null, growth: r2(mi * 3.5 + rnd(5, 10)) });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'Ritel',    produk: 'EDC',   nominal: Math.round(edcBase),   npl: null, growth: r2(rnd(1.5, 3.5)) });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'Konsumer', produk: 'BRImo', nominal: Math.round(brimoBase), npl: null, growth: r2(mi * 2.0 + rnd(4, 8)) });
                data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Channel', segmen: 'SME',      produk: 'Qlola', nominal: Math.round(qlolaBase), npl: null, growth: r2(rnd(1.0, 3.0)) });

                // Lending per tipe unit
                const nplV = rnd(-0.4, 0.6);

                if (u.type === 'briguna') {
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'BRIguna', nominal: Math.round(unitLend * 0.88), npl: r2(u.nplBase + nplV), growth: r2(lendGrowth + rnd(0, 0.5)) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'KPR',      nominal: Math.round(unitLend * 0.12), npl: r2(u.nplBase + 0.4 + nplV), growth: r2(lendGrowth) });

                } else if (u.type === 'sme') {
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Mikro',    produk: 'KUR Mikro', nominal: Math.round(unitLend * 0.42), npl: r2(u.nplBase - 0.6 + nplV), growth: r2(lendGrowth + 1.2) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Mikro',    produk: 'Kupedes',   nominal: Math.round(unitLend * 0.33), npl: r2(u.nplBase + nplV), growth: r2(lendGrowth) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'SME',      produk: 'SME CC',    nominal: Math.round(unitLend * 0.15), npl: r2(u.nplBase + 0.9 + nplV), growth: r2(lendGrowth - 0.5) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'SME',      produk: 'SME NCC',   nominal: Math.round(unitLend * 0.10), npl: r2(u.nplBase + 1.3 + nplV), growth: r2(lendGrowth - 1.0) });

                } else {
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'BRIguna',     nominal: Math.round(unitLend * 0.26), npl: r2(u.nplBase - 0.4 + nplV), growth: r2(lendGrowth + 0.8) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Konsumer', produk: 'KPR',          nominal: Math.round(unitLend * 0.20), npl: r2(u.nplBase + nplV), growth: r2(lendGrowth) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Mikro',    produk: 'KUR Mikro',    nominal: Math.round(unitLend * 0.22), npl: r2(u.nplBase + 0.1 + nplV), growth: r2(lendGrowth + 1.0) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Mikro',    produk: 'Kupedes',      nominal: Math.round(unitLend * 0.18), npl: r2(u.nplBase + nplV), growth: r2(lendGrowth) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'SME',      produk: 'SME CC',       nominal: Math.round(unitLend * 0.09), npl: r2(u.nplBase + 1.0 + nplV), growth: r2(lendGrowth - 0.4) });
                    data.push({ id: id++, tanggal: m.date, unit: u.name, jenis_produk: 'Lending', segmen: 'Ritel',    produk: 'Kredit Ritel', nominal: Math.round(unitLend * 0.05), npl: r2(u.nplBase + 0.6 + nplV), growth: r2(lendGrowth - 0.2) });
                }
            });
        });

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            data.forEach(item => store.add({ ...item, timestamp: Date.now() }));
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    }
};
