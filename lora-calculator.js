/**
 * LoRa Link Budget Calculator
 * Calculates sensitivity, data rate, path loss, and link budget
 */

class LoRaCalculator {
    constructor() {
        // LoRa sensitivity table (dBm) - SF vs BW
        this.sensitivityTable = {
            '125': {
                7: -123,
                8: -126,
                9: -129,
                10: -132,
                11: -134.5,
                12: -137
            },
            '250': {
                7: -120,
                8: -123,
                9: -125,
                10: -128,
                11: -131,
                12: -133
            },
            '500': {
                7: -117,
                8: -120,
                9: -122,
                10: -125,
                11: -128,
                12: -130
            }
        };
    }

    /**
     * Get receiver sensitivity based on SF and BW
     */
    getSensitivity(sf, bw) {
        return this.sensitivityTable[bw][sf];
    }

    /**
     * Calculate LoRa data rate (bps)
     * Formula: DR = SF * (BW / 2^SF) * CR
     */
    calculateDataRate(sf, bw, cr) {
        const bandwidth = bw * 1000; // Convert to Hz
        const codingRate = 4 / cr; // CR is denominator (5,6,7,8)
        
        const symbolRate = bandwidth / Math.pow(2, sf);
        const dataRate = symbolRate * sf * codingRate;
        
        return Math.round(dataRate);
    }

    /**
     * Calculate Time on Air (ms)
     */
    calculateTimeOnAir(payloadBytes, sf, bw, cr) {
        const bandwidth = bw * 1000;
        const symbolDuration = Math.pow(2, sf) / bandwidth;
        
        // Preamble symbols (8 default)
        const preambleDuration = (8 + 4.25) * symbolDuration;
        
        // Payload symbols
        const payloadSymbolNb = 8 + Math.max(
            Math.ceil(
                (8 * payloadBytes - 4 * sf + 28) / (4 * sf)
            ) * cr,
            0
        );
        
        const payloadDuration = payloadSymbolNb * symbolDuration;
        
        return (preambleDuration + payloadDuration) * 1000; // ms
    }

    /**
     * Calculate Free Space Path Loss (FSPL)
     * Formula: FSPL = 20*log10(d) + 20*log10(f) + 32.45
     * d in km, f in MHz
     */
    calculateFSPL(distanceKm, frequencyMHz) {
        if (distanceKm <= 0) return 0;
        
        const fspl = 20 * Math.log10(distanceKm) + 
                     20 * Math.log10(frequencyMHz) + 
                     32.45;
        
        return fspl;
    }

    /**
     * Calculate Fresnel Zone radius at a point
     * d1, d2 in km, frequency in MHz
     * Returns radius in meters
     */
    calculateFresnelRadius(d1, d2, frequencyMHz) {
        const totalDistance = d1 + d2;
        if (totalDistance === 0) return 0;
        
        const radius = 17.3 * Math.sqrt((d1 * d2) / (frequencyMHz * totalDistance));
        return radius;
    }

    /**
     * Calculate maximum Fresnel zone radius along the path
     */
    calculateMaxFresnelRadius(distanceKm, frequencyMHz) {
        // Maximum occurs at midpoint
        const d1 = distanceKm / 2;
        const d2 = distanceKm / 2;
        return this.calculateFresnelRadius(d1, d2, frequencyMHz);
    }

    /**
     * Calculate link budget
     * Returns object with detailed link analysis
     */
    calculateLinkBudget(params) {
        const {
            txPower,      // dBm
            txGain,       // dBi
            rxGain,       // dBi
            frequency,    // MHz
            distance,     // km
            sf,           // 7-12
            bw,           // 125, 250, 500
            cr,           // 5, 6, 7, 8
            fadeMargin = 10  // dB (default)
        } = params;

        // Get sensitivity
        const sensitivity = this.getSensitivity(sf, bw);

        // Calculate path loss
        const pathLoss = this.calculateFSPL(distance, frequency);

        // Additional losses (cable, connector, etc.)
        const miscLosses = 2; // dB

        // Received power
        const rxPower = txPower + txGain + rxGain - pathLoss - miscLosses;

        // Link margin
        const linkMargin = rxPower - sensitivity;

        // Required margin (including fade margin)
        const requiredMargin = fadeMargin;

        // Link budget
        const linkBudget = linkMargin - fadeMargin;

        // Data rate
        const dataRate = this.calculateDataRate(sf, bw, cr);

        // Fresnel zone
        const fresnelRadius = this.calculateMaxFresnelRadius(distance, frequency);

        // Link status
        let status = 'excellent';
        if (linkMargin < requiredMargin) {
            status = 'poor';
        } else if (linkMargin < requiredMargin + 10) {
            status = 'marginal';
        } else if (linkMargin < requiredMargin + 20) {
            status = 'good';
        }

        return {
            sensitivity,
            pathLoss,
            rxPower,
            linkMargin,
            linkBudget,
            dataRate,
            fresnelRadius,
            status,
            details: {
                txPower,
                txGain,
                rxGain,
                miscLosses,
                fadeMargin,
                requiredMargin
            }
        };
    }

    /**
     * Calculate maximum theoretical range
     * Based on link budget with standard assumptions
     */
    calculateMaxRange(params) {
        const {
            txPower,
            txGain,
            rxGain,
            frequency,
            sf,
            bw,
            fadeMargin = 10
        } = params;

        const sensitivity = this.getSensitivity(sf, bw);
        const miscLosses = 2;

        // Available path loss budget
        const pathLossBudget = txPower + txGain + rxGain - sensitivity - miscLosses - fadeMargin;

        // Solve FSPL equation for distance
        // FSPL = 20*log10(d) + 20*log10(f) + 32.45
        // d = 10^((FSPL - 20*log10(f) - 32.45) / 20)
        
        const distance = Math.pow(10, (pathLossBudget - 20 * Math.log10(frequency) - 32.45) / 20);

        return distance; // km
    }

    /**
     * Get link quality color based on status
     */
    getStatusColor(status) {
        const colors = {
            'excellent': '#00ff88',
            'good': '#00cc66',
            'marginal': '#ffaa00',
            'poor': '#ff4466'
        };
        return colors[status] || '#6c7a9b';
    }

    /**
     * Format number with unit
     */
    formatValue(value, decimals = 1, unit = '') {
        return `${value.toFixed(decimals)} ${unit}`.trim();
    }

    /**
     * Get recommended settings for a given distance
     */
    getRecommendedSettings(distanceKm, frequency) {
        const recommendations = [];

        // Test different configurations
        const sfOptions = [7, 8, 9, 10, 11, 12];
        const bwOptions = [125, 250, 500];

        for (const sf of sfOptions) {
            for (const bw of bwOptions) {
                const result = this.calculateLinkBudget({
                    txPower: 14,
                    txGain: 2,
                    rxGain: 2,
                    frequency,
                    distance: distanceKm,
                    sf,
                    bw,
                    cr: 5,
                    fadeMargin: 10
                });

                if (result.linkMargin >= 10) {
                    recommendations.push({
                        sf,
                        bw,
                        dataRate: result.dataRate,
                        linkMargin: result.linkMargin,
                        score: result.dataRate * (result.linkMargin / 10) // Favor higher data rate with good margin
                    });
                }
            }
        }

        // Sort by score (best combination of data rate and margin)
        recommendations.sort((a, b) => b.score - a.score);

        return recommendations.slice(0, 3); // Top 3 recommendations
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoRaCalculator;
}
