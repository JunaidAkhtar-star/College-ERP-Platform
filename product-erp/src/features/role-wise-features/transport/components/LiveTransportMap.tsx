'use client';

import { useEffect, useRef } from 'react';
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass, Crosshair, Navigation, Gauge } from 'lucide-react';

export interface ILiveBus {
  _id: string;
  routeNo: string;
  routeName: string;
  vehicleNo: string;
  driverName: string;
  gps?: { lat: number; lng: number; speed?: number; heading?: number; lastSeen: string };
}

// CartoDB Voyager style for high-resolution vector-style rendering
const CARTO_VOYAGER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

interface IAnimState {
  startLat: number;
  startLng: number;
  targetLat: number;
  targetLng: number;
  startTime: number;
  duration: number;
  heading: number;
}

export default function LiveTransportMap({
  buses,
  selectedId,
  onSelect,
}: {
  buses: ILiveBus[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const animStatesRef = useRef<globalThis.Map<string, IAnimState>>(new globalThis.Map());
  const animationFrameRef = useRef<number | null>(null);

  const selectedBus = buses.find((b) => b._id === selectedId);

  // Initialize MapLibre GL map instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: CARTO_VOYAGER_STYLE,
      center: [78.9629, 20.5937],
      zoom: 5,
      pitch: 45, // 3D perspective pitch angle
      attributionControl: {},
    });

    map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    const markers = markersRef.current;
    const animStates = animStatesRef.current;
    markers.clear();
    mapRef.current = map;

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      markers.forEach((marker) => marker.remove());
      markers.clear();
      animStates.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers & setup smooth interpolation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(buses.filter((bus) => bus.gps).map((bus) => bus._id));
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        animStatesRef.current.delete(id);
      }
    });

    const bounds = new LngLatBounds();
    const now = Date.now();

    buses.forEach((bus) => {
      if (!bus.gps) return;
      const targetPoint: [number, number] = [bus.gps.lng, bus.gps.lat];
      bounds.extend(targetPoint);

      const marker = markersRef.current.get(bus._id);
      const isSelected = selectedId === bus._id;

      if (!marker) {
        const element = document.createElement('div');
        element.className = 'group cursor-pointer relative flex flex-col items-center select-none';

        // Floating Route Badge
        const badge = document.createElement('div');
        badge.className =
          'mb-1 flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-0.5 text-[11px] font-bold text-slate-800  backdrop-blur-md transition-all group-hover:scale-105';
        badge.innerHTML = `<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span><span>${bus.routeNo}</span>`;

        // 3D Bus Vehicle Mesh Container (Rotated by heading angle)
        const pinContainer = document.createElement('div');
        pinContainer.className =
          'relative flex items-center justify-center transition-transform duration-300';
        pinContainer.id = `bus-pin-${bus._id}`;

        const busSvg = `
          <div className="relative group cursor-pointer">
            <!-- Ground Drop-Shadow cast on road -->
            <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) scaleY(0.4); width: 46px; height: 18px; background: rgba(0,0,0,0.35); border-radius: 9999px; filter: blur(4px);"></div>
            
            <!-- 3D Isometric School/College Yellow Bus Mesh -->
            <svg viewBox="0 0 64 100" width="46" height="72" style="filter: drop-(0 10px 8px rgba(0, 0, 0, 0.3)); transition: transform 0.2s ease;">
              <defs>
                <linearGradient id="bus-body-${bus._id}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="${isSelected ? '#fef08a' : '#fde047'}"/>
                  <stop offset="50%" stop-color="${isSelected ? '#f59e0b' : '#eab308'}"/>
                  <stop offset="100%" stop-color="${isSelected ? '#d97706' : '#ca8a04'}"/>
                </linearGradient>
                <linearGradient id="bus-roof-${bus._id}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#fef08a"/>
                  <stop offset="100%" stop-color="#facc15"/>
                </linearGradient>
                <linearGradient id="light-beam-${bus._id}" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stop-color="rgba(254, 240, 138, 0.9)"/>
                  <stop offset="100%" stop-color="rgba(254, 240, 138, 0)"/>
                </linearGradient>
              </defs>
              
              <!-- Glowing Headlight Beams on road -->
              <polygon points="12,10 0,-4 24,-4" fill="url(#light-beam-${bus._id})"/>
              <polygon points="52,10 40,-4 64,-4" fill="url(#light-beam-${bus._id})"/>
              
              <!-- Heavy Duty Rubber Tires -->
              <rect x="1" y="18" width="7" height="18" rx="2" fill="#090d16"/>
              <rect x="56" y="18" width="7" height="18" rx="2" fill="#090d16"/>
              <rect x="1" y="68" width="7" height="18" rx="2" fill="#090d16"/>
              <rect x="56" y="68" width="7" height="18" rx="2" fill="#090d16"/>
              
              <!-- Main School Bus Body (Yellow Chassis) -->
              <rect x="6" y="10" width="52" height="80" rx="10" fill="url(#bus-body-${bus._id})" stroke="${isSelected ? '#0284c7' : '#78350f'}" stroke-width="${isSelected ? '3' : '2'}"/>
              
              <!-- Black Side Guard Rub-Rails (Classic School Bus Markings) -->
              <line x1="6" y1="36" x2="14" y2="36" stroke="#0f172a" stroke-width="2.5"/>
              <line x1="50" y1="36" x2="58" y2="36" stroke="#0f172a" stroke-width="2.5"/>
              <line x1="6" y1="60" x2="14" y2="60" stroke="#0f172a" stroke-width="2.5"/>
              <line x1="50" y1="60" x2="58" y2="60" stroke="#0f172a" stroke-width="2.5"/>

              <!-- Front Black Bumper -->
              <rect x="12" y="8" width="40" height="4" rx="2" fill="#0f172a"/>
              
              <!-- Front Windshield (Tinted Glass) -->
              <path d="M12,18 C12,14 18,14 32,14 C46,14 52,14 52,18 L50,28 L14,28 Z" fill="#0284c7" opacity="0.9"/>
              
              <!-- Side Mirrors -->
              <rect x="0" y="16" width="6" height="5" rx="1" fill="#0f172a"/>
              <rect x="58" y="16" width="6" height="5" rx="1" fill="#0f172a"/>
              
              <!-- Roof Top & Ventilation Units -->
              <rect x="14" y="32" width="36" height="44" rx="5" fill="url(#bus-roof-${bus._id})" opacity="0.95" stroke="#eab308" stroke-width="1"/>
              <rect x="20" y="36" width="24" height="6" rx="2" fill="#ffffff" opacity="0.9"/>
              <rect x="20" y="48" width="24" height="6" rx="2" fill="#ffffff" opacity="0.9"/>
              <rect x="20" y="60" width="24" height="6" rx="2" fill="#ffffff" opacity="0.9"/>
              
              <!-- Rear Black Bumper -->
              <rect x="12" y="88" width="40" height="4" rx="2" fill="#0f172a"/>
              
              <!-- Red Rear Tail Lights -->
              <circle cx="12" cy="85" r="3.5" fill="#ef4444"/>
              <circle cx="52" cy="85" r="3.5" fill="#ef4444"/>
              
              <!-- Bright Headlights -->
              <circle cx="12" cy="12" r="3.5" fill="#ffffff"/>
              <circle cx="52" cy="12" r="3.5" fill="#ffffff"/>
            </svg>
          </div>
        `;

        pinContainer.innerHTML = busSvg;
        element.appendChild(badge);
        element.appendChild(pinContainer);

        element.addEventListener('click', () => onSelect(bus._id));

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 4px; min-width: 180px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 700; font-size: 13px; color: #0f172a;">${bus.routeNo} · ${bus.routeName}</span>
              <span style="background: #ecfdf5; color: #047857; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 9999px;">3D LIVE</span>
            </div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 3px;"><strong>Vehicle:</strong> ${bus.vehicleNo}</div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 3px;"><strong>Driver:</strong> ${bus.driverName}</div>
            <div style="font-size: 12px; color: #0178D7; font-weight: 600; margin-top: 6px;">⚡ Speed: ${Math.round(bus.gps.speed ?? 0)} km/h</div>
          </div>
        `;

        const createdMarker = new Marker({ element })
          .setLngLat(targetPoint)
          .setPopup(new Popup({ offset: 35 }).setHTML(popupContent))
          .addTo(map);

        markersRef.current.set(bus._id, createdMarker);
        animStatesRef.current.set(bus._id, {
          startLat: bus.gps.lat,
          startLng: bus.gps.lng,
          targetLat: bus.gps.lat,
          targetLng: bus.gps.lng,
          startTime: now,
          duration: 1000,
          heading: bus.gps.heading ?? 0,
        });
      } else {
        // Update interpolation state for existing marker
        const currentPos = marker.getLngLat();
        animStatesRef.current.set(bus._id, {
          startLat: currentPos.lat,
          startLng: currentPos.lng,
          targetLat: bus.gps.lat,
          targetLng: bus.gps.lng,
          startTime: now,
          duration: 1200,
          heading: bus.gps.heading ?? 0,
        });
      }
    });

    // Smooth RequestAnimationFrame loop to interpolate marker positions
    const animate = () => {
      const currentTime = Date.now();
      animStatesRef.current.forEach((anim, busId) => {
        const marker = markersRef.current.get(busId);
        if (!marker) return;

        const elapsed = currentTime - anim.startTime;
        const progress = Math.min(1, elapsed / anim.duration);
        // Ease-out quad interpolation formula
        const ease = 1 - (1 - progress) * (1 - progress);

        const currentLat = anim.startLat + (anim.targetLat - anim.startLat) * ease;
        const currentLng = anim.startLng + (anim.targetLng - anim.startLng) * ease;

        marker.setLngLat([currentLng, currentLat]);

        // Rotate pin container if heading is provided
        const pinContainer = document.getElementById(`bus-pin-${busId}`);
        if (pinContainer && typeof anim.heading === 'number') {
          pinContainer.style.transform = `rotate(${anim.heading}deg)`;
        }
      });

      if (
        Array.from(animStatesRef.current.values()).some(
          (a) => Date.now() - a.startTime < a.duration,
        )
      ) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);

    // Ease camera to selected bus or fit active bounds
    if (selectedId) {
      const selected = buses.find((bus) => bus._id === selectedId)?.gps;
      if (selected) {
        map.easeTo({ center: [selected.lng, selected.lat], zoom: 15, duration: 800 });
      }
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 800 });
    }
  }, [buses, onSelect, selectedId]);

  const fitAllBuses = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new LngLatBounds();
    buses.forEach((bus) => {
      if (bus.gps) bounds.extend([bus.gps.lng, bus.gps.lat]);
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 800 });
    }
  };

  const recenterSelected = () => {
    const map = mapRef.current;
    if (!map || !selectedBus?.gps) return;
    map.flyTo({
      center: [selectedBus.gps.lng, selectedBus.gps.lat],
      zoom: 15,
      duration: 1000,
    });
  };

  return (
    <div className="relative h-115 w-full overflow-hidden rounded-xl border border-slate-200/80 ">
      {/* Container div for MapLibre canvas */}
      <div ref={containerRef} className="h-full w-full" aria-label="Live bus map" />

      {/* Floating Google Maps-Style HUD Overlay */}
      {selectedBus && selectedBus.gps && (
        <div className="absolute top-3 left-3 z-10 max-w-xs rounded-2xl border border-slate-200/80 bg-white/95 p-3.5  backdrop-blur-md transition-all">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE TRACKING
              </span>
              <h3 className="mt-1 text-sm font-bold text-slate-900">
                {selectedBus.routeNo} · {selectedBus.routeName}
              </h3>
            </div>
            <button
              type="button"
              onClick={recenterSelected}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white"
              title="Recenter camera on bus"
            >
              <Crosshair className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2">
              <Gauge className="h-3.5 w-3.5 text-primary" />
              <div>
                <p className="text-[10px] text-slate-600">Speed</p>
                <p className="font-bold text-slate-800">
                  {Math.round(selectedBus.gps.speed ?? 0)} km/h
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2">
              <Compass className="h-3.5 w-3.5 text-primary" />
              <div>
                <p className="text-[10px] text-slate-600">Heading</p>
                <p className="font-bold text-slate-800">
                  {Math.round(selectedBus.gps.heading ?? 0)}°
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              <strong>Driver:</strong> {selectedBus.driverName}
            </span>
            <span className="font-mono text-slate-600">{selectedBus.vehicleNo}</span>
          </div>
        </div>
      )}

      {/* Floating Recenter All Vehicles Action Button */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={fitAllBuses}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700  backdrop-blur-md transition-all hover:bg-slate-50 hover:text-primary active:scale-95"
        >
          <Navigation className="h-3.5 w-3.5 text-primary" />
          View All Vehicles ({buses.filter((b) => b.gps).length})
        </button>
      </div>
    </div>
  );
}
