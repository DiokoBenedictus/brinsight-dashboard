/**
 * casaRadarEngine.js — CASA Outflow & Fund-Shifting Detection Engine
 * BRInsight SDSS | Phase 2
 *
 * Goal: Detect whether DPK decline is caused by fund-shifting vs. genuine business decline.
 *
 * Logic:
 *  - FUND_SHIFTING:    CASA drops significantly AND channel activity (QRIS/BRImo) stays active
 *  - BUSINESS_DECLINE: Both CASA AND channel activity drop together
 *  - CASA_AT_RISK:     CASA declining but channel signal is inconclusive
 *  - STABLE:           No meaningful decline detected
 */

window.casaRadarEngine = (function () {

    // Thresholds
    const CASA_DECLINE_THRESHOLD   = -2.0;  // % MoM growth below this = "significant drop"
    const CHANNEL_ACTIVE_THRESHOLD =  0.0;  // QRIS/BRImo growth above this = channel still active
    const MIN_MONTHS_FOR_TREND     =  2;    // Need at least 2 months of data to compute MoM

    /**
     * Extract YYYYMM key from a date string.
     */
    function toMonthKey(dateStr) {
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    /**
     * Compute month-over-month growth % between last two months for a set of records.
     * @param {Object[]} records - array of {tanggal, nominal}
     * @returns {number|null} - MoM growth %, or null if insufficient data
     */
    function computeMoMGrowth(records) {
        if (!records || records.length === 0) return null;

        // Group by month
        const byMonth = {};
        records.forEach(r => {
            const k = toMonthKey(r.tanggal);
            byMonth[k] = (byMonth[k] || 0) + r.nominal;
        });

        const months = Object.keys(byMonth).sort();
        if (months.length < MIN_MONTHS_FOR_TREND) return null;

        const latest  = byMonth[months[months.length - 1]];
        const previous = byMonth[months[months.length - 2]];

        if (previous === 0) return null;
        return ((latest - previous) / previous) * 100;
    }

    /**
     * Classify a single unit's funding vs. channel dynamics.
     */
    function classifyUnit(casaGrowth, channelGrowth) {
        if (casaGrowth === null) return 'INSUFFICIENT_DATA';

        const isDeclined  = casaGrowth < CASA_DECLINE_THRESHOLD;
        const isChannelActive = channelGrowth !== null && channelGrowth > CHANNEL_ACTIVE_THRESHOLD;
        const isChannelDeclining = channelGrowth !== null && channelGrowth <= CASA_DECLINE_THRESHOLD;

        if (isDeclined && isChannelActive)     return 'FUND_SHIFTING';
        if (isDeclined && isChannelDeclining)  return 'BUSINESS_DECLINE';
        if (isDeclined)                        return 'CASA_AT_RISK';
        return 'STABLE';
    }

    /**
     * Analyze CASA outflow across all units.
     *
     * @param {Object[]} funding - filtered Funding records
     * @param {Object[]} channel - filtered Channel records
     * @returns {{
     *   unitStatuses: Array,
     *   globalOutflowDetected: boolean,
     *   fundShiftingUnits: string[],
     *   declineUnits: string[],
     *   highestRiskUnit: string|null,
     *   totalCasaGrowthMoM: number|null
     * }}
     */
    function analyze(funding, channel) {
        if (!funding || funding.length === 0) {
            return {
                unitStatuses:         [],
                globalOutflowDetected: false,
                fundShiftingUnits:    [],
                declineUnits:         [],
                highestRiskUnit:      null,
                totalCasaGrowthMoM:   null
            };
        }

        // Isolate CASA (non-Deposito) records
        const casa = funding.filter(f => !f.produk.toLowerCase().includes('deposito'));

        // Get all units
        const units = [...new Set(funding.map(f => f.unit))].sort();

        const unitStatuses = units.map(unit => {
            // CASA growth for this unit
            const unitCasa = casa.filter(f => f.unit === unit);
            const casaGrowth = computeMoMGrowth(unitCasa);

            // Channel activity for this unit (QRIS + BRImo combined)
            const unitChannel = channel.filter(
                c => c.unit === unit && ['QRIS', 'BRImo'].includes(c.produk)
            );
            const channelGrowth = computeMoMGrowth(unitChannel);

            // CASA total (latest month)
            const byMonth = {};
            unitCasa.forEach(r => {
                const k = toMonthKey(r.tanggal);
                byMonth[k] = (byMonth[k] || 0) + r.nominal;
            });
            const months = Object.keys(byMonth).sort();
            const casaTotal = months.length > 0 ? byMonth[months[months.length - 1]] : 0;

            const status = classifyUnit(casaGrowth, channelGrowth);

            return {
                unit,
                status,
                casaGrowthMoM:   casaGrowth !== null ? parseFloat(casaGrowth.toFixed(2)) : null,
                channelGrowthMoM: channelGrowth !== null ? parseFloat(channelGrowth.toFixed(2)) : null,
                casaTotal,
                isCritical: status === 'FUND_SHIFTING' || status === 'BUSINESS_DECLINE'
            };
        });

        // Aggregate signals
        const fundShiftingUnits = unitStatuses
            .filter(u => u.status === 'FUND_SHIFTING')
            .map(u => u.unit);
        const declineUnits = unitStatuses
            .filter(u => u.status === 'BUSINESS_DECLINE')
            .map(u => u.unit);
        const globalOutflowDetected = fundShiftingUnits.length > 0 || declineUnits.length > 0;

        // Highest risk unit = largest CASA total among critical units
        const criticalUnits = unitStatuses.filter(u => u.isCritical);
        const highestRiskUnit = criticalUnits.length > 0
            ? criticalUnits.reduce((max, u) => u.casaTotal > max.casaTotal ? u : max, criticalUnits[0]).unit
            : (globalOutflowDetected ? fundShiftingUnits[0] || declineUnits[0] : null);

        // Global CASA total MoM
        const totalCasaGrowthMoM = computeMoMGrowth(casa);

        return {
            unitStatuses,
            globalOutflowDetected,
            fundShiftingUnits,
            declineUnits,
            highestRiskUnit,
            totalCasaGrowthMoM: totalCasaGrowthMoM !== null
                ? parseFloat(totalCasaGrowthMoM.toFixed(2))
                : null
        };
    }

    return { analyze };
})();
