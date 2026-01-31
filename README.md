# LoRa Line of Sight Calculator

A web-based tool for analyzing LoRa radio coverage between multiple points, accounting for terrain elevation and calculating link budgets with Fresnel zone clearance.

![LoRa LoS Calculator](preview.png)

## Features

- 🗺️ **Interactive Map Interface** - Click to add multiple waypoints
- 📡 **LoRa Link Budget Calculator** - Customizable radio parameters
- 🏔️ **Terrain Analysis** - Real elevation data with earth curvature compensation
- 📊 **Fresnel Zone Calculation** - RF propagation modeling
- 🎨 **Modern Dark UI** - Clean, professional interface
- ✅ **Multi-Point Analysis** - Test coverage between 2+ locations
- 🌈 **Visual Feedback** - Color-coded links (Green = Good, Orange = Marginal, Red = Blocked)

## LoRa Parameters

Customize all key LoRa radio settings:

- **Frequency**: 433 MHz or 868 MHz
- **Bandwidth**: 125, 250, or 500 kHz
- **Spreading Factor**: SF7 to SF12
- **Coding Rate**: 4/5, 4/6, 4/7, 4/8
- **TX Power**: 2 to 27 dBm
- **Antenna Gains**: -2 to 15 dBi (TX and RX)

## Calculated Results

- **Link Budget** (dB)
- **Data Rate** (bps/kbps)
- **Receiver Sensitivity** (dBm)
- **Maximum Range** (km)
- **Received Power** (dBm)
- **Link Margin** (dB)
- **Fresnel Zone Clearance** (%)

## How to Use

1. **Add Points**: Click "Add Point" button, then click on the map
2. **Configure Radio**: Adjust LoRa parameters in the right panel
3. **Analyze**: Click "Analyze LoS" to calculate link quality
4. **Review Results**: Check elevation profile and link analysis

### Color Coding

- 🟢 **Green**: Excellent/Good link quality with clear LoS
- 🟡 **Orange**: Marginal link quality or limited Fresnel clearance
- 🔴 **Red**: Poor link quality or blocked line of sight

## Technical Details

### Link Budget Calculation

```
Received Power = TX Power + TX Gain + RX Gain - Path Loss - Misc Losses
Link Margin = Received Power - Receiver Sensitivity
Link Budget = Link Margin - Fade Margin
```

### Free Space Path Loss (FSPL)

```
FSPL (dB) = 20·log₁₀(d) + 20·log₁₀(f) + 32.45
where:
  d = distance (km)
  f = frequency (MHz)
```

### Fresnel Zone

The tool calculates the first Fresnel zone and requires 60% clearance for reliable LoRa communication:

```
r = 17.3 × √(d₁ × d₂ / (f × D))
where:
  r = Fresnel radius (m)
  d₁, d₂ = distances from point (km)
  f = frequency (MHz)
  D = total distance (km)
```

### Data Rate Calculation

```
DR = SF × (BW / 2^SF) × (4 / CR)
where:
  SF = Spreading Factor (7-12)
  BW = Bandwidth (Hz)
  CR = Coding Rate denominator (5-8)
```

## Data Sources

- **Elevation Data**: [Open-Elevation API](https://open-elevation.com/) (SRTM 30m resolution)
- **Map Tiles**: [CARTO Dark Matter](https://github.com/CartoDB/basemap-styles)
- **Mapping**: [Leaflet.js](https://leafletjs.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/)

## Installation

### GitHub Pages Deployment

1. Fork or clone this repository
2. Enable GitHub Pages in repository settings
3. Set source to `main` branch
4. Access at `https://yourusername.github.io/lora-los-tool/`

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/lora-los-tool.git
cd lora-los-tool

# Serve with any HTTP server
python -m http.server 8000
# or
npx http-server

# Open browser to http://localhost:8000
```

No build process required - pure HTML/CSS/JavaScript!

## File Structure

```
lora-los-tool/
├── index.html              # Main HTML file
├── styles.css              # Dark theme styling
├── app.js                  # Main application logic
├── lora-calculator.js      # LoRa link budget calculations
├── elevation-service.js    # Terrain elevation API
└── README.md              # This file
```

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Requires modern browser with ES6+ support

## API Rate Limits

The Open-Elevation API is used for terrain data. For heavy usage, consider:
- Implementing caching (already included)
- Using alternative elevation APIs (Mapbox, Google Elevation)
- Self-hosting elevation data

## Future Enhancements

- [ ] OSM Buildings integration for urban obstruction modeling
- [ ] Multiple receiver points with coverage heatmap
- [ ] Export results to PDF/image
- [ ] Save/load configurations
- [ ] Mobile antenna pattern support
- [ ] Weather/atmospheric loss modeling
- [ ] Real-time GPS integration

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this tool for any purpose.

## Acknowledgments

- LoRa sensitivity values based on Semtech datasheets
- RF propagation models follow ITU-R recommendations
- Built for the mesh networking and LoRa community

## Related Projects

- [Reticulum Network Stack](https://github.com/markqvist/Reticulum)
- [NomadNet](https://github.com/markqvist/NomadNet)
- [RNode Firmware](https://github.com/markqvist/RNode_Firmware)

## Author

Created for the LoRa/Reticulum community

## Support

If you find this tool useful, please give it a ⭐ on GitHub!

For issues or feature requests, please use the [GitHub Issues](https://github.com/yourusername/lora-los-tool/issues) page.
