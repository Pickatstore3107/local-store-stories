import { HYDERABAD, type LatLng } from "./pins";

export type MapPinItem = {
  id: string;
  lat: number;
  lng: number;
  storeName: string;
  photoUrl: string | null;
  year: number | null;
  active: boolean;
};

export type MapStatePayload = {
  pins?: MapPinItem[];
  trail?: LatLng[];
  me?: LatLng | null;
  selectedSpot?: LatLng | null;
};

/**
 * Builds the self-contained HTML page for the OpenFreeMap + MapLibre map,
 * styled with the Pick at Store paper, butter-road, water and park palette
 * from the website's src/components/map/open-map.ts.
 */
export function buildPasMapHtml(options: {
  initialCenter: LatLng;
  initialZoom: number;
  pickable?: boolean;
}) {
  const { south, west, north, east } = HYDERABAD.bounds;
  const config = JSON.stringify({
    center: [options.initialCenter.lng, options.initialCenter.lat],
    zoom: options.initialZoom,
    bounds: [
      [west, south],
      [east, north],
    ],
    pickable: !!options.pickable,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.2.0/dist/maplibre-gl.css" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Plus+Jakarta+Sans:wght@700;800&display=swap" />
<style>
  html, body, #map {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: #FBF5EA;
    overflow: hidden;
    -webkit-user-select: none;
    user-select: none;
  }
  .maplibregl-ctrl-attrib {
    font-family: "Plus Jakarta Sans", -apple-system, sans-serif;
    font-size: 10px;
    background: rgba(251, 245, 234, 0.85) !important;
  }
  .pas-pin {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    padding-top: 10px;
    padding-left: 14px;
    padding-right: 14px;
    position: relative;
  }
  .pas-pin-ring {
    border-radius: 999px;
    border-style: solid;
    border-width: 3px;
    background: #f4ece1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 14px rgba(120, 70, 30, 0.25);
  }
  .pas-pin-ring img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .pas-pin-fallback {
    font-family: "Plus Jakarta Sans", -apple-system, sans-serif;
    font-weight: 800;
    color: #a3171b;
  }
  .pas-pin-year {
    position: absolute;
    top: 2px;
    right: 2px;
    padding: 1px 6px;
    border-radius: 999px;
    font-family: "Anton", Impact, sans-serif;
    font-size: 12px;
    line-height: 1.2;
    box-shadow: 0 2px 6px rgba(43, 29, 26, 0.18);
  }
  .pas-pin-tip {
    width: 0;
    height: 0;
    margin-top: -2px;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@5.2.0/dist/maplibre-gl.js"></script>
<script>
(function() {
  var CFG = ${config};
  var PAPER = "#FBF5EA";
  var DOTS = "#E9DFD0";
  var WATER = "#D3E4EC";
  var WATER_LABEL = "#5B8AA3";
  var PARK = "#E4EDD6";
  var PARK_LABEL = "#6F8A55";
  var ROAD = "#FFE7A3";
  var ROAD_LIGHT = "#FFEFC2";
  var AREA_LABEL = "#B3A29B";
  var RED = "#a3171b";
  var YELLOW = "#ffc000";
  var INK = "#2b1d1a";
  var GREEN = ["park", "grass", "wood", "forest", "garden", "meadow", "scrub", "pitch", "playground", "cemetery", "golf_course", "recreation_ground", "nature_reserve"];
  var MAJOR = ["motorway", "trunk", "primary"];

  function send(msg) {
    var text = JSON.stringify(msg);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(text);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(text, "*");
    }
  }

  function dotsImage() {
    var scale = 2;
    var c = document.createElement("canvas");
    c.width = 22 * scale;
    c.height = 22 * scale;
    var g = c.getContext("2d");
    g.scale(scale, scale);
    g.fillStyle = PAPER;
    g.fillRect(0, 0, 22, 22);
    g.beginPath();
    g.arc(11, 11, 1.3, 0, Math.PI * 2);
    g.fillStyle = DOTS;
    g.fill();
    return { image: g.getImageData(0, 0, 22 * scale, 22 * scale), scale: scale };
  }

  function paperStyle(map) {
    if (!map.hasImage("pas-dots")) {
      var d = dotsImage();
      map.addImage("pas-dots", d.image, { pixelRatio: d.scale });
    }
    var layers = (map.getStyle() && map.getStyle().layers) || [];
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (layer.id.indexOf("lss-") === 0) continue;
      var source = layer["source-layer"];
      try {
        if (layer.type === "background") {
          map.setPaintProperty(layer.id, "background-color", PAPER);
          map.setPaintProperty(layer.id, "background-pattern", "pas-dots");
        } else if (layer.type === "fill" && source === "water") {
          map.setPaintProperty(layer.id, "fill-color", WATER);
        } else if (layer.type === "line" && source === "waterway") {
          map.setPaintProperty(layer.id, "line-color", WATER);
        } else if (layer.type === "fill" && (source === "park" || source === "landcover" || source === "landuse")) {
          map.setPaintProperty(layer.id, "fill-color", source === "park" ? PARK : ["match", ["get", "class"], GREEN, PARK, PAPER]);
        } else if (layer.type === "fill-extrusion" || (layer.type === "fill" && source === "building")) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        } else if (layer.type === "line" && source === "transportation") {
          if (layer.id.indexOf("casing") !== -1) map.setPaintProperty(layer.id, "line-color", PAPER);
          else map.setPaintProperty(layer.id, "line-color", ["match", ["get", "class"], MAJOR, ROAD, ROAD_LIGHT]);
        } else if (layer.type === "symbol" && source === "water_name") {
          map.setPaintProperty(layer.id, "text-color", WATER_LABEL);
        } else if (layer.type === "symbol" && source === "poi") {
          if (!CFG.pickable) map.setLayoutProperty(layer.id, "visibility", "none");
          else if (layer.id.indexOf("park") !== -1) map.setPaintProperty(layer.id, "text-color", PARK_LABEL);
        } else if (layer.type === "symbol" && source === "place") {
          map.setPaintProperty(layer.id, "text-color", AREA_LABEL);
          map.setLayoutProperty(layer.id, "text-transform", "uppercase");
          map.setLayoutProperty(layer.id, "text-letter-spacing", 0.24);
        } else if (layer.type === "symbol" && source === "transportation_name") {
          map.setPaintProperty(layer.id, "text-color", AREA_LABEL);
        }
      } catch (e) {}
    }
  }

  var map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: CFG.center,
    zoom: CFG.zoom,
    minZoom: 9,
    maxZoom: 18,
    maxBounds: CFG.bounds,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false
  });
  map.touchZoomRotate.disableRotation();

  var ready = false;
  var pendingState = null;
  var pendingCalls = [];
  var markers = [];
  var pickerMarker = null;

  function emptyCollection() {
    return { type: "FeatureCollection", features: [] };
  }

  map.on("load", function() {
    paperStyle(map);
    map.addSource("lss-trail", { type: "geojson", data: emptyCollection() });
    map.addLayer({
      id: "lss-trail-line",
      type: "line",
      source: "lss-trail",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": RED, "line-width": 2.5, "line-dasharray": [1.5, 2.5] }
    });

    map.addSource("lss-picker-box", { type: "geojson", data: emptyCollection() });
    map.addLayer({
      id: "lss-picker-fill",
      type: "fill",
      source: "lss-picker-box",
      paint: { "fill-color": RED, "fill-opacity": 0.15 }
    });
    map.addLayer({
      id: "lss-picker-line",
      type: "line",
      source: "lss-picker-box",
      paint: { "line-color": RED, "line-width": 2 }
    });

    map.addSource("lss-me", { type: "geojson", data: emptyCollection() });
    map.addLayer({
      id: "lss-me-halo",
      type: "circle",
      source: "lss-me",
      paint: { "circle-radius": 22, "circle-color": RED, "circle-opacity": 0.25 }
    });
    map.addLayer({
      id: "lss-me-dot",
      type: "circle",
      source: "lss-me",
      paint: { "circle-radius": 9, "circle-color": RED, "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 }
    });

    ready = true;
    if (pendingState) applyState(pendingState);
    while (pendingCalls.length) {
      var fn = pendingCalls.shift();
      fn();
    }
    send({ type: "ready" });
  });

  if (CFG.pickable) {
    map.on("click", function(e) {
      send({ type: "tap", lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
  }

  function buildPinElement(p) {
    var wrap = document.createElement("div");
    wrap.className = "pas-pin";
    wrap.style.zIndex = p.active ? "5" : "2";
    var size = p.active ? 62 : 44;
    var ringColor = p.active ? RED : "#ffffff";

    var ring = document.createElement("div");
    ring.className = "pas-pin-ring";
    ring.style.width = size + "px";
    ring.style.height = size + "px";
    ring.style.borderColor = ringColor;

    if (p.photoUrl) {
      var img = document.createElement("img");
      img.src = p.photoUrl;
      img.alt = p.storeName || "";
      ring.appendChild(img);
    } else {
      var fb = document.createElement("span");
      fb.className = "pas-pin-fallback";
      fb.style.fontSize = (p.active ? 22 : 16) + "px";
      fb.textContent = (p.storeName || "?").charAt(0).toUpperCase();
      ring.appendChild(fb);
    }
    wrap.appendChild(ring);

    if (p.year !== null && p.year !== undefined) {
      var yr = document.createElement("div");
      yr.className = "pas-pin-year";
      yr.style.background = p.active ? YELLOW : "#ffffff";
      yr.style.color = p.active ? INK : RED;
      yr.textContent = String(p.year);
      wrap.appendChild(yr);
    }

    var tip = document.createElement("div");
    tip.className = "pas-pin-tip";
    tip.style.borderTop = "10px solid " + ringColor;
    wrap.appendChild(tip);

    wrap.addEventListener("click", function(ev) {
      ev.stopPropagation();
      send({ type: "pick", id: p.id });
    });
    return wrap;
  }

  function applyState(state) {
    if (!ready) {
      pendingState = state;
      return;
    }
    if (state.trail) {
      var coords = state.trail.map(function(c) { return [c.lng, c.lat]; });
      var trailData = coords.length > 1
        ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] }
        : emptyCollection();
      map.getSource("lss-trail").setData(trailData);
    }
    if ("me" in state) {
      var meData = state.me
        ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [state.me.lng, state.me.lat] } }] }
        : emptyCollection();
      map.getSource("lss-me").setData(meData);
    }
    if ("selectedSpot" in state) {
      var s = state.selectedSpot;
      var dLat = 0.00225, dLng = 0.00235;
      var boxData = s
        ? {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [[
                  [s.lng - dLng, s.lat - dLat],
                  [s.lng + dLng, s.lat - dLat],
                  [s.lng + dLng, s.lat + dLat],
                  [s.lng - dLng, s.lat + dLat],
                  [s.lng - dLng, s.lat - dLat]
                ]]
              }
            }]
          }
        : emptyCollection();
      map.getSource("lss-picker-box").setData(boxData);
      if (pickerMarker) {
        pickerMarker.remove();
        pickerMarker = null;
      }
      if (s) {
        pickerMarker = new maplibregl.Marker({ color: RED }).setLngLat([s.lng, s.lat]).addTo(map);
      }
    }
    if (state.pins) {
      for (var i = 0; i < markers.length; i++) markers[i].remove();
      markers = [];
      for (var j = 0; j < state.pins.length; j++) {
        var p = state.pins[j];
        var el = buildPinElement(p);
        var m = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        markers.push(m);
      }
    }
  }

  window.pasMapCmd = function(cmd) {
    if (!ready && cmd.action !== "state") {
      pendingCalls.push(function() { window.pasMapCmd(cmd); });
      return;
    }
    if (cmd.action === "state") {
      applyState(cmd.state);
    } else if (cmd.action === "panTo") {
      var delta = cmd.delta || 0.02;
      var zoom = Math.max(10, Math.min(16.5, 14.2 - Math.log2(delta / 0.02)));
      var latOffset = cmd.offsetTop ? delta * 0.18 : 0;
      map.easeTo({
        center: [cmd.spot.lng, cmd.spot.lat - latOffset],
        zoom: zoom,
        duration: 600
      });
    } else if (cmd.action === "fit") {
      var pts = cmd.coords || [];
      if (!pts.length) return;
      if (pts.length === 1) {
        map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 14.5, duration: cmd.animated === false ? 0 : 600 });
        return;
      }
      var minLng = pts[0].lng, maxLng = pts[0].lng, minLat = pts[0].lat, maxLat = pts[0].lat;
      for (var i = 1; i < pts.length; i++) {
        if (pts[i].lng < minLng) minLng = pts[i].lng;
        if (pts[i].lng > maxLng) maxLng = pts[i].lng;
        if (pts[i].lat < minLat) minLat = pts[i].lat;
        if (pts[i].lat > maxLat) maxLat = pts[i].lat;
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
        padding: cmd.padding || { top: 140, bottom: 300, left: 40, right: 60 },
        maxZoom: 15,
        duration: cmd.animated === false ? 0 : 600
      });
    }
  };

  window.addEventListener("message", function(ev) {
    try {
      var data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
      if (data && data.action) window.pasMapCmd(data);
    } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}
