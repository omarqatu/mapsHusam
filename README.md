# منصة العقارات والخدمات (PSM)

**Property and Services Map** — A web-based GIS platform for browsing, searching, and editing geospatial data related to real estate and public services, built with [OpenLayers](https://openlayers.org/) and [GeoServer](https://geoserver.org/).

---

## Features

- 🗺️ **Interactive Map** — Switch between aerial imagery, OpenStreetMap, ESRI satellite, or no basemap.
- 📚 **Layer Management** — Toggle and control multiple GeoServer WMS/WFS layers.
- 🔎 **Advanced Attribute Search** — Filter features by field values with multiple conditions.
- 📍 **Location-Based Search** — Find nearby services or properties within a specified radius using your current location or a map-selected point.
- 📏 **Measurement Tools** — Measure distances (meters) and areas (m²), and draw points.
- 🔗 **Location Sharing** — Pick a point on the map and generate a shareable link with Palestine Grid and WGS84 coordinates.
- ℹ️ **Feature Popup** — Click on map features to view their attribute details.
- ✏️ **Feature Editing** — Add, modify, and delete point, polygon, and line features directly on the map via WFS-T transactions.
- 🌐 **Coordinate Display** — Real-time Palestine Grid (Palestine Transverse Mercator) coordinates shown as you move the cursor.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend map library | [OpenLayers](https://openlayers.org/) + [ol-ext](https://viglino.github.io/ol-ext/) |
| Coordinate projection | [proj4js](https://proj4js.org/) |
| Backend / proxy server | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) |
| Spatial data server | [GeoServer](https://geoserver.org/) |
| UI icons | [Font Awesome 6](https://fontawesome.com/) |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or later
- A running [GeoServer](https://geoserver.org/) instance on `http://localhost:8080/geoserver`

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Hu2024am/PSM.git
cd PSM
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the server

```bash
npm start
```

The application will be available at **http://localhost:3000**.

> The Node.js server acts as a reverse proxy, forwarding all requests to `/proxy/geoserver/*` to the GeoServer instance running on `http://localhost:8080/geoserver`.

---

## Project Structure

```
PSM/
├── index.html              # Main application page (Arabic/RTL)
├── server.js               # Express server & GeoServer proxy
├── package.json
├── css/
│   └── style.css           # Application styles
├── js/
│   ├── main.js             # App entry point & map initialization
│   ├── layers.js           # Layer definitions and WMS/WFS configuration
│   ├── layer-manager.js    # Layer panel UI logic
│   ├── popup.js            # Feature info popup
│   ├── search.js           # Attribute-based search
│   ├── location-search.js  # Proximity / location-based search
│   ├── measure.js          # Distance & area measurement tools
│   ├── share-location.js   # Location sharing with coordinate display
│   ├── editPoints.js       # Point feature editing (WFS-T)
│   ├── editPolygons.js     # Polygon feature editing (WFS-T)
│   ├── editLines.js        # Line feature editing (WFS-T)
│   ├── style-utils.js      # Map feature styling utilities
│   └── autocomplete.js     # Search input autocomplete
├── ol/                     # OpenLayers library files
├── proj4/                  # proj4js library files
├── icons/                  # Application icons
└── DB_Backups/             # Database backup files
```
written by copilot 
---

## Configuration

GeoServer connection settings (URL, workspace, layer names) are defined in `js/layers.js`. Update this file to point to your GeoServer workspace and layers.

---

## License

ISC
