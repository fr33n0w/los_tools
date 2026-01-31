/**
 * Elevation Service
 * Fetches elevation data from Open-Elevation API
 * Handles terrain profile calculations and Fresnel zone analysis
 */

class ElevationService {
    constructor() {
        this.apiUrl = 'https://api.open-elevation.com/api/v1/lookup';
        this.cache = new Map();
        this.earthRadius = 6371; // km
    }

    /**
     * Fetch elevation for a single point
     */
    async getElevation(lat, lon) {
        const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
        
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        try {
            const response = await fetch(`${this.apiUrl}?locations=${lat},${lon}`);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const elevation = data.results[0].elevation;
                this.cache.set(key, elevation);
                return elevation;
            }
        } catch (error) {
            console.error('Error fetching elevation:', error);
        }
        
        return 0;
    }

    /**
     * Fetch elevations for multiple points
     */
    async getElevations(locations) {
        // Open-Elevation API accepts batch requests
        const locationString = locations
            .map(loc => `${loc.lat},${loc.lon}`)
            .join('|');

        try {
            const response = await fetch(`${this.apiUrl}?locations=${locationString}`);
            const data = await response.json();
            
            if (data.results) {
                return data.results.map(result => result.elevation);
            }
        } catch (error) {
            console.error('Error fetching elevations:', error);
        }
        
        return locations.map(() => 0);
    }

    /**
     * Calculate distance between two points (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return this.earthRadius * c; // km
    }

    /**
     * Interpolate points along a path
     */
    interpolatePath(lat1, lon1, lat2, lon2, numPoints = 50) {
        const points = [];
        
        for (let i = 0; i <= numPoints; i++) {
            const fraction = i / numPoints;
            
            const lat = lat1 + (lat2 - lat1) * fraction;
            const lon = lon1 + (lon2 - lon1) * fraction;
            
            points.push({ lat, lon });
        }
        
        return points;
    }

    /**
     * Get elevation profile between two points
     */
    async getElevationProfile(point1, point2, numSamples = 50) {
        const pathPoints = this.interpolatePath(
            point1.lat, point1.lon,
            point2.lat, point2.lon,
            numSamples
        );

        // Fetch elevations (in batches to respect API limits)
        const batchSize = 50;
        const elevations = [];
        
        for (let i = 0; i < pathPoints.length; i += batchSize) {
            const batch = pathPoints.slice(i, i + batchSize);
            const batchElevations = await this.getElevations(batch);
            elevations.push(...batchElevations);
        }

        // Calculate distances from start
        const totalDistance = this.calculateDistance(
            point1.lat, point1.lon,
            point2.lat, point2.lon
        );

        const profile = pathPoints.map((point, index) => {
            const distanceFromStart = (index / (pathPoints.length - 1)) * totalDistance;
            
            return {
                lat: point.lat,
                lon: point.lon,
                elevation: elevations[index] || 0,
                distance: distanceFromStart
            };
        });

        return {
            profile,
            totalDistance,
            startElevation: elevations[0] || 0,
            endElevation: elevations[elevations.length - 1] || 0
        };
    }

    /**
     * Calculate line of sight with Fresnel zone clearance
     */
    analyzeLineOfSight(elevationProfile, point1Height, point2Height, fresnelRadius, frequency) {
        const { profile, totalDistance } = elevationProfile;
        
        if (profile.length < 2) {
            return {
                hasLoS: false,
                obstructions: [],
                fresnelClearance: 0
            };
        }

        const startElevation = profile[0].elevation + point1Height;
        const endElevation = profile[profile.length - 1].elevation + point2Height;

        const obstructions = [];
        let minClearance = Infinity;

        // Check each point along the profile
        for (let i = 1; i < profile.length - 1; i++) {
            const point = profile[i];
            const d1 = point.distance;
            const d2 = totalDistance - d1;

            // Calculate expected height of direct line at this point
            const lineHeight = startElevation + 
                (endElevation - startElevation) * (d1 / totalDistance);

            // Earth curvature correction (important for long distances)
            const earthBulge = this.calculateEarthBulge(d1, d2);

            // Adjusted line height accounting for earth curvature
            const adjustedLineHeight = lineHeight - earthBulge;

            // Calculate Fresnel zone radius at this point
            const calculator = new LoRaCalculator();
            const localFresnelRadius = calculator.calculateFresnelRadius(d1, d2, frequency);

            // Required clearance height (60% of first Fresnel zone)
            const requiredHeight = adjustedLineHeight + (localFresnelRadius * 0.6);

            // Actual terrain height
            const terrainHeight = point.elevation;

            // Calculate clearance
            const clearance = adjustedLineHeight - terrainHeight;
            const fresnelClearancePercent = (clearance / localFresnelRadius) * 100;

            minClearance = Math.min(minClearance, fresnelClearancePercent);

            // Check if obstructed
            if (terrainHeight > requiredHeight) {
                obstructions.push({
                    distance: d1,
                    elevation: terrainHeight,
                    requiredHeight: requiredHeight,
                    obstruction: terrainHeight - requiredHeight,
                    lat: point.lat,
                    lon: point.lon
                });
            }
        }

        const hasLoS = obstructions.length === 0;
        const fresnelClearance = minClearance;

        // Determine quality
        let quality = 'excellent';
        if (!hasLoS) {
            quality = 'blocked';
        } else if (fresnelClearance < 20) {
            quality = 'poor';
        } else if (fresnelClearance < 60) {
            quality = 'marginal';
        } else if (fresnelClearance < 100) {
            quality = 'good';
        }

        return {
            hasLoS,
            obstructions,
            fresnelClearance,
            quality,
            totalDistance
        };
    }

    /**
     * Calculate earth bulge (curvature) at a point
     * Returns bulge height in meters
     */
    calculateEarthBulge(d1, d2) {
        // d1 and d2 in km
        const bulge = (d1 * d2) / (2 * this.earthRadius);
        return bulge * 1000; // Convert to meters
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Get terrain statistics for a profile
     */
    getTerrainStats(elevationProfile) {
        const { profile } = elevationProfile;
        const elevations = profile.map(p => p.elevation);

        const min = Math.min(...elevations);
        const max = Math.max(...elevations);
        const avg = elevations.reduce((a, b) => a + b, 0) / elevations.length;

        // Calculate elevation gain/loss
        let totalGain = 0;
        let totalLoss = 0;

        for (let i = 1; i < elevations.length; i++) {
            const diff = elevations[i] - elevations[i - 1];
            if (diff > 0) {
                totalGain += diff;
            } else {
                totalLoss += Math.abs(diff);
            }
        }

        return {
            min,
            max,
            avg,
            totalGain,
            totalLoss,
            elevationChange: max - min
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ElevationService;
}
