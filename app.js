/**
 * Main Application
 * Handles UI interactions, map management, and coordinates all modules
 */

// Initialize services
const loraCalc = new LoRaCalculator();
const elevationService = new ElevationService();

// Application state
const appState = {
    map: null,
    points: [],
    markers: [],
    polylines: [],
    addingPoint: false,
    elevationCharts: [],
    currentAnalysis: null,
    buildingsLayer: null,
    buildingsEnabled: false,
    coverageCircles: [],
    coverageEnabled: false,
    baseLayers: {}
};

// LoRa parameters state
const loraParams = {
    frequency: 868,
    bandwidth: 125,
    spreadingFactor: 7,
    codingRate: 5,
    txPower: 14,
    txGain: 2,
    rxGain: 2
};

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initEventListeners();
    initInputHandlers();
    updateCalculations();
});

/**
 * Initialize Leaflet map
 */
function initMap() {
    // Create map centered on Europe
    appState.map = L.map('map').setView([45.4642, 9.1900], 6);

    // Define base layers
    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });

    const osmTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
    });

    // Add default layer (Topo map with elevation)
    osmTopo.addTo(appState.map);

    // Store layers
    appState.baseLayers = {
        "Topographic": osmTopo,
        "Standard": osmStandard,
        "Satellite": satellite
    };

    // Add layer control
    L.control.layers(appState.baseLayers).addTo(appState.map);

    // Initialize OSM Buildings layer (not added to map yet)
    appState.buildingsLayer = new OSMBuildings(appState.map).load();

    // Try to get user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            appState.map.setView([lat, lon], 10);
        });
    }
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
    // Add point button
    document.getElementById('addPointBtn').addEventListener('click', () => {
        appState.addingPoint = true;
        document.getElementById('addPointBtn').classList.add('active');
        appState.map.getContainer().style.cursor = 'crosshair';
    });

    // Clear points button
    document.getElementById('clearPointsBtn').addEventListener('click', clearAllPoints);

    // Analyze button
    document.getElementById('analyzeBtn').addEventListener('click', analyzeLineOfSight);

    // Toggle buildings layer
    document.getElementById('toggleBuildingsBtn').addEventListener('click', toggleBuildingsLayer);

    // Toggle coverage layer
    document.getElementById('toggleCoverageBtn').addEventListener('click', toggleCoverageLayer);

    // Map click handler
    appState.map.on('click', onMapClick);
}

/**
 * Initialize input handlers for LoRa parameters
 */
function initInputHandlers() {
    // Frequency radio buttons
    document.querySelectorAll('input[name="frequency"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            loraParams.frequency = parseInt(e.target.value);
            document.getElementById('frequencyValue').textContent = e.target.value;
            updateCalculations();
        });
    });

    // Bandwidth select
    document.getElementById('bandwidth').addEventListener('change', (e) => {
        loraParams.bandwidth = parseInt(e.target.value);
        document.getElementById('bandwidthValue').textContent = e.target.value;
        updateCalculations();
    });

    // Spreading Factor range
    document.getElementById('spreadingFactor').addEventListener('input', (e) => {
        loraParams.spreadingFactor = parseInt(e.target.value);
        document.getElementById('sfValue').textContent = e.target.value;
        updateCalculations();
    });

    // Coding Rate select
    document.getElementById('codingRate').addEventListener('change', (e) => {
        loraParams.codingRate = parseInt(e.target.value);
        document.getElementById('crValue').textContent = `4/${e.target.value}`;
        updateCalculations();
    });

    // TX Power range
    document.getElementById('txPower').addEventListener('input', (e) => {
        loraParams.txPower = parseFloat(e.target.value);
        document.getElementById('txPowerValue').textContent = e.target.value;
        updateCalculations();
    });

    // TX Gain range
    document.getElementById('txGain').addEventListener('input', (e) => {
        loraParams.txGain = parseFloat(e.target.value);
        document.getElementById('txGainValue').textContent = e.target.value;
        updateCalculations();
    });

    // RX Gain range
    document.getElementById('rxGain').addEventListener('input', (e) => {
        loraParams.rxGain = parseFloat(e.target.value);
        document.getElementById('rxGainValue').textContent = e.target.value;
        updateCalculations();
    });
}

/**
 * Handle map clicks
 */
function onMapClick(e) {
    if (appState.addingPoint) {
        addPoint(e.latlng.lat, e.latlng.lng);
        appState.addingPoint = false;
        document.getElementById('addPointBtn').classList.remove('active');
        appState.map.getContainer().style.cursor = '';
    }
}

/**
 * Add a point to the map
 */
async function addPoint(lat, lon) {
    const pointIndex = appState.points.length;
    const label = String.fromCharCode(65 + pointIndex); // A, B, C, ...

    // Fetch elevation
    const elevation = await elevationService.getElevation(lat, lon);

    // Create marker
    const marker = L.marker([lat, lon], {
        draggable: true,
        icon: L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-label">${label}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(appState.map);

    // Add popup
    marker.bindPopup(`
        <div style="color: #e4e6eb;">
            <strong>Point ${label}</strong><br>
            Lat: ${lat.toFixed(6)}<br>
            Lon: ${lon.toFixed(6)}<br>
            Elevation: ${elevation.toFixed(1)} m
        </div>
    `);

    // Handle marker drag
    marker.on('dragend', () => {
        const pos = marker.getLatLng();
        updatePointPosition(pointIndex, pos.lat, pos.lng);
    });

    // Store point
    const point = {
        lat,
        lon,
        elevation,
        label,
        marker
    };

    appState.points.push(point);
    appState.markers.push(marker);

    // Update UI
    updatePointsTable();
    updateAnalyzeButton();
    
    // Draw lines if we have 2+ points
    if (appState.points.length >= 2) {
        drawLines();
    }

    // Update coverage layer if enabled
    if (appState.coverageEnabled) {
        updateCoverageLayer();
    }
}

/**
 * Update point position after drag
 */
async function updatePointPosition(index, lat, lon) {
    const elevation = await elevationService.getElevation(lat, lon);
    
    appState.points[index].lat = lat;
    appState.points[index].lon = lon;
    appState.points[index].elevation = elevation;

    updatePointsTable();
    drawLines();
}

/**
 * Draw lines between points
 */
function drawLines() {
    // Clear existing lines
    appState.polylines.forEach(line => appState.map.removeLayer(line));
    appState.polylines = [];

    // Draw lines between consecutive points
    for (let i = 0; i < appState.points.length - 1; i++) {
        const p1 = appState.points[i];
        const p2 = appState.points[i + 1];

        const polyline = L.polyline(
            [[p1.lat, p1.lon], [p2.lat, p2.lon]],
            {
                color: '#00d9ff',
                weight: 2,
                opacity: 0.7,
                dashArray: '5, 10'
            }
        ).addTo(appState.map);

        appState.polylines.push(polyline);
    }
}

/**
 * Clear all points
 */
function clearAllPoints() {
    // Remove markers
    appState.markers.forEach(marker => appState.map.removeLayer(marker));
    appState.markers = [];

    // Remove lines
    appState.polylines.forEach(line => appState.map.removeLayer(line));
    appState.polylines = [];

    // Remove coverage circles
    appState.coverageCircles.forEach(circle => appState.map.removeLayer(circle));
    appState.coverageCircles = [];

    // Clear state
    appState.points = [];
    appState.currentAnalysis = null;

    // Update UI
    updatePointsTable();
    updateAnalyzeButton();
    clearAnalysisResults();
}

/**
 * Update points table
 */
function updatePointsTable() {
    const tbody = document.getElementById('pointsTableBody');
    
    if (appState.points.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="placeholder">No points added yet</td></tr>';
        return;
    }

    tbody.innerHTML = appState.points.map((point, index) => `
        <tr>
            <td><strong>${point.label}</strong></td>
            <td>${point.lat.toFixed(6)}</td>
            <td>${point.lon.toFixed(6)}</td>
            <td>${point.elevation.toFixed(1)} m</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="removePoint(${index})">
                    Remove
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Remove a specific point
 */
function removePoint(index) {
    // Remove marker
    appState.map.removeLayer(appState.markers[index]);
    
    // Remove from arrays
    appState.points.splice(index, 1);
    appState.markers.splice(index, 1);

    // Re-label remaining points
    appState.points.forEach((point, i) => {
        point.label = String.fromCharCode(65 + i);
        const marker = appState.markers[i];
        marker.setIcon(L.divIcon({
            className: 'custom-marker',
            html: `<div class="marker-label">${point.label}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        }));
    });

    // Update UI
    updatePointsTable();
    updateAnalyzeButton();
    drawLines();
}

/**
 * Update analyze button state
 */
function updateAnalyzeButton() {
    const btn = document.getElementById('analyzeBtn');
    btn.disabled = appState.points.length < 2;
}

/**
 * Update LoRa calculations
 */
function updateCalculations() {
    const { frequency, bandwidth, spreadingFactor, codingRate, txPower, txGain, rxGain } = loraParams;

    // Get sensitivity
    const sensitivity = loraCalc.getSensitivity(spreadingFactor, bandwidth);

    // Calculate data rate
    const dataRate = loraCalc.calculateDataRate(spreadingFactor, bandwidth, codingRate);

    // Calculate max theoretical range
    const maxRange = loraCalc.calculateMaxRange({
        txPower,
        txGain,
        rxGain,
        frequency,
        sf: spreadingFactor,
        bw: bandwidth
    });

    // Calculate link budget for a reference distance (1 km)
    const refLinkBudget = loraCalc.calculateLinkBudget({
        txPower,
        txGain,
        rxGain,
        frequency,
        distance: 1,
        sf: spreadingFactor,
        bw: bandwidth,
        cr: codingRate
    });

    // Update UI
    document.getElementById('linkBudget').textContent = `${refLinkBudget.linkBudget.toFixed(1)} dB`;
    document.getElementById('dataRate').textContent = formatDataRate(dataRate);
    document.getElementById('sensitivity').textContent = `${sensitivity.toFixed(1)} dBm`;
    document.getElementById('maxRange').textContent = `${maxRange.toFixed(1)} km`;

    // Update coverage layer if enabled
    if (appState.coverageEnabled) {
        updateCoverageLayer();
    }

    // Re-analyze if we have points
    if (appState.currentAnalysis) {
        analyzeLineOfSight();
    }
}

/**
 * Analyze line of sight
 */
async function analyzeLineOfSight() {
    if (appState.points.length < 2) return;

    // Show loading state
    const linkAnalysisDiv = document.getElementById('linkAnalysis');
    linkAnalysisDiv.innerHTML = '<p class="placeholder">Analyzing... Please wait</p>';

    try {
        // Analyze each link between consecutive points
        const analyses = [];

        for (let i = 0; i < appState.points.length - 1; i++) {
            const p1 = appState.points[i];
            const p2 = appState.points[i + 1];

            // Get elevation profile
            const elevationProfile = await elevationService.getElevationProfile(
                { lat: p1.lat, lon: p1.lon },
                { lat: p2.lat, lon: p2.lon },
                50
            );

            // Calculate distance
            const distance = elevationProfile.totalDistance;

            // Get buildings if enabled
            let buildings = [];
            if (appState.buildingsEnabled) {
                buildings = await elevationService.getBuildingsAlongPath(
                    p1.lat, p1.lon, p2.lat, p2.lon, 0.1
                );
            }

            // Calculate Fresnel radius
            const fresnelRadius = loraCalc.calculateMaxFresnelRadius(distance, loraParams.frequency);

            // Analyze LoS with buildings
            const losAnalysis = elevationService.analyzeLineOfSight(
                elevationProfile,
                10, // Antenna height point 1 (10m)
                10, // Antenna height point 2 (10m)
                fresnelRadius,
                loraParams.frequency,
                buildings
            );

            // Calculate link budget
            const linkBudget = loraCalc.calculateLinkBudget({
                ...loraParams,
                distance,
                sf: loraParams.spreadingFactor,
                bw: loraParams.bandwidth,
                cr: loraParams.codingRate
            });

            analyses.push({
                from: p1.label,
                to: p2.label,
                distance,
                elevationProfile,
                losAnalysis,
                linkBudget,
                fresnelRadius
            });

            // Update polyline color based on status
            const color = getLinkColor(losAnalysis.hasLoS, linkBudget.status);
            appState.polylines[i].setStyle({ color, weight: 3, opacity: 1 });
        }

        // Store analysis
        appState.currentAnalysis = analyses;

        // Display results
        displayAnalysisResults(analyses);

        // Display elevation charts for all links
        displayElevationCharts(analyses);

    } catch (error) {
        console.error('Analysis error:', error);
        linkAnalysisDiv.innerHTML = '<p class="placeholder" style="color: var(--danger);">Error during analysis. Please try again.</p>';
    }
}

/**
 * Toggle buildings layer
 */
function toggleBuildingsLayer() {
    const btn = document.getElementById('toggleBuildingsBtn');
    
    appState.buildingsEnabled = !appState.buildingsEnabled;
    
    if (appState.buildingsEnabled) {
        // Show buildings
        appState.buildingsLayer = new OSMBuildings(appState.map).load();
        btn.classList.add('active');
    } else {
        // Hide buildings
        if (appState.buildingsLayer) {
            appState.buildingsLayer.remove();
            appState.buildingsLayer = null;
        }
        btn.classList.remove('active');
    }
}

/**
 * Toggle coverage layer
 */
function toggleCoverageLayer() {
    const btn = document.getElementById('toggleCoverageBtn');
    
    appState.coverageEnabled = !appState.coverageEnabled;
    
    if (appState.coverageEnabled) {
        btn.classList.add('active');
        updateCoverageLayer();
    } else {
        // Remove coverage circles
        appState.coverageCircles.forEach(circle => appState.map.removeLayer(circle));
        appState.coverageCircles = [];
        btn.classList.remove('active');
    }
}

/**
 * Update coverage layer based on current points
 */
function updateCoverageLayer() {
    // Remove existing coverage circles
    appState.coverageCircles.forEach(circle => appState.map.removeLayer(circle));
    appState.coverageCircles = [];
    
    if (!appState.coverageEnabled || appState.points.length === 0) {
        return;
    }

    // Calculate max range for current settings
    const maxRange = loraCalc.calculateMaxRange({
        ...loraParams,
        sf: loraParams.spreadingFactor,
        bw: loraParams.bandwidth
    });

    // Add coverage circle for each point
    appState.points.forEach((point, index) => {
        // Convert km to meters
        const radiusMeters = maxRange * 1000;

        // Create circle with gradient effect
        const circle = L.circle([point.lat, point.lon], {
            radius: radiusMeters,
            color: index === 0 ? '#00d9ff' : '#7b61ff',
            fillColor: index === 0 ? '#00d9ff' : '#7b61ff',
            fillOpacity: 0.1,
            weight: 2,
            opacity: 0.5
        }).addTo(appState.map);

        // Add popup
        circle.bindPopup(`
            <div style="color: #0f1419;">
                <strong>Coverage for Point ${point.label}</strong><br>
                Max Range: ${maxRange.toFixed(1)} km<br>
                Settings: SF${loraParams.spreadingFactor}, BW${loraParams.bandwidth}kHz
            </div>
        `);

        appState.coverageCircles.push(circle);
    });
}

/**
 * Display analysis results
 */
function displayAnalysisResults(analyses) {
    const linkAnalysisDiv = document.getElementById('linkAnalysis');
    
    const html = analyses.map(analysis => {
        const { from, to, distance, losAnalysis, linkBudget } = analysis;
        
        // Determine overall status
        const isViable = losAnalysis.hasLoS && linkBudget.linkMargin > 0;
        const statusClass = isViable ? 
            (linkBudget.status === 'excellent' || linkBudget.status === 'good' ? 'success' : 'warning') : 
            'danger';
        
        const statusText = isViable ?
            (losAnalysis.quality === 'excellent' ? '✅ Excellent' : 
             losAnalysis.quality === 'good' ? '✅ Good' :
             '⚠️ Marginal') :
            '❌ Not Viable';

        return `
            <div class="link-status ${statusClass}">
                <div class="link-status-title">${from} → ${to}: ${statusText}</div>
                
                <div class="link-detail">
                    <span class="link-detail-label">Distance:</span>
                    <span class="link-detail-value">${distance.toFixed(2)} km</span>
                </div>
                
                <div class="link-detail">
                    <span class="link-detail-label">Link Margin:</span>
                    <span class="link-detail-value">${linkBudget.linkMargin.toFixed(1)} dB</span>
                </div>
                
                <div class="link-detail">
                    <span class="link-detail-label">RX Power:</span>
                    <span class="link-detail-value">${linkBudget.rxPower.toFixed(1)} dBm</span>
                </div>
                
                <div class="link-detail">
                    <span class="link-detail-label">Fresnel Clearance:</span>
                    <span class="link-detail-value">${losAnalysis.fresnelClearance.toFixed(0)}%</span>
                </div>
                
                <div class="link-detail">
                    <span class="link-detail-label">Line of Sight:</span>
                    <span class="link-detail-value">${losAnalysis.hasLoS ? 'Clear ✓' : `Blocked (${losAnalysis.obstructions.length} points)`}</span>
                </div>
                
                <div class="link-detail">
                    <span class="link-detail-label">Data Rate:</span>
                    <span class="link-detail-value">${formatDataRate(linkBudget.dataRate)}</span>
                </div>
            </div>
        `;
    }).join('');

    linkAnalysisDiv.innerHTML = html;
}

/**
 * Display elevation charts for all links
 */
function displayElevationCharts(analyses) {
    const container = document.getElementById('elevationProfiles');
    
    // Clear existing charts
    appState.elevationCharts.forEach(chart => chart.destroy());
    appState.elevationCharts = [];
    container.innerHTML = '';

    // Create a chart for each link
    analyses.forEach((analysis, index) => {
        const { elevationProfile, losAnalysis, from, to } = analysis;
        const { profile } = elevationProfile;

        // Create chart container
        const chartCard = document.createElement('div');
        chartCard.className = 'elevation-chart-card';
        chartCard.innerHTML = `
            <h3>Elevation Profile: ${from} → ${to}</h3>
            <canvas id="elevationChart${index}"></canvas>
        `;
        container.appendChild(chartCard);

        // Prepare data
        const labels = profile.map(p => p.distance.toFixed(2));
        const elevations = profile.map(p => p.elevation);

        // Calculate LoS line
        const startHeight = profile[0].elevation + 10; // + antenna height
        const endHeight = profile[profile.length - 1].elevation + 10;
        const losLine = profile.map((p, i) => {
            const fraction = i / (profile.length - 1);
            return startHeight + (endHeight - startHeight) * fraction;
        });

        // Calculate Fresnel zone boundaries (60% clearance)
        const fresnelUpper = [];
        const fresnelLower = [];
        const totalDistance = elevationProfile.totalDistance;
        
        profile.forEach((p, i) => {
            const d1 = p.distance;
            const d2 = totalDistance - d1;
            const fresnelRadius = loraCalc.calculateFresnelRadius(d1, d2, loraParams.frequency);
            const lineHeight = losLine[i];
            
            fresnelUpper.push(lineHeight + fresnelRadius * 0.6);
            fresnelLower.push(lineHeight - fresnelRadius * 0.6);
        });

        // Create chart
        const ctx = document.getElementById(`elevationChart${index}`).getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Terrain Elevation',
                        data: elevations,
                        borderColor: '#ffaa00',
                        backgroundColor: 'rgba(255, 170, 0, 0.3)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'LoS Line',
                        data: losLine,
                        borderColor: losAnalysis.hasLoS ? '#00ff88' : '#ff4466',
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 2
                    },
                    {
                        label: '60% Fresnel Zone',
                        data: fresnelUpper,
                        borderColor: 'rgba(0, 217, 255, 0.3)',
                        backgroundColor: 'rgba(0, 217, 255, 0.1)',
                        fill: '+1',
                        pointRadius: 0,
                        borderWidth: 1,
                        borderDash: [2, 2]
                    },
                    {
                        label: 'Fresnel Lower',
                        data: fresnelLower,
                        borderColor: 'rgba(0, 217, 255, 0)',
                        fill: false,
                        pointRadius: 0,
                        borderWidth: 0,
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        labels: { 
                            color: '#e4e6eb',
                            filter: (item) => item.text !== 'Fresnel Lower'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Distance (km)',
                            color: '#a8b3cf'
                        },
                        ticks: { color: '#a8b3cf' },
                        grid: { color: '#2d3548' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Elevation (m)',
                            color: '#a8b3cf'
                        },
                        ticks: { color: '#a8b3cf' },
                        grid: { color: '#2d3548' }
                    }
                }
            }
        });

        appState.elevationCharts.push(chart);
    });
}

/**
 * Clear analysis results
 */
function clearAnalysisResults() {
    document.getElementById('linkAnalysis').innerHTML = '<p class="placeholder">Click "Analyze LoS" to see results</p>';
    
    appState.elevationCharts.forEach(chart => chart.destroy());
    appState.elevationCharts = [];
    document.getElementById('elevationProfiles').innerHTML = '';
}

/**
 * Get link color based on LoS and link budget status
 */
function getLinkColor(hasLoS, linkStatus) {
    if (!hasLoS) return '#ff4466'; // Red - blocked
    
    switch (linkStatus) {
        case 'excellent':
        case 'good':
            return '#00ff88'; // Green - good
        case 'marginal':
            return '#ffaa00'; // Orange - marginal
        default:
            return '#ff4466'; // Red - poor
    }
}

/**
 * Format data rate for display
 */
function formatDataRate(bps) {
    if (bps >= 1000) {
        return `${(bps / 1000).toFixed(2)} kbps`;
    }
    return `${bps.toFixed(0)} bps`;
}

// Make removePoint available globally
window.removePoint = removePoint;
