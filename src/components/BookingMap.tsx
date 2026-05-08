import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Navigation2, Search, X, Route, Crosshair, MousePointer2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const PH_CENTER: [number, number] = [122.3643, 11.7054]; // Kalibo, Aklan
const BASE_FARE = 40;
const PER_KM = 15;

// ── Philippines time (Kalibo, UTC+8) ─────────────────────────────────
type LightPreset = "dawn" | "day" | "dusk" | "night";

function getPHDate(): Date {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);
}
function getPHHour(): number {
  const d = getPHDate();
  return d.getHours() + d.getMinutes() / 60;
}
function getPHTimeStr(): string {
  return getPHDate().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function getLightPreset(hour: number): LightPreset {
  if (hour >= 5  && hour < 7)  return "dawn";
  if (hour >= 7  && hour < 18) return "day";
  if (hour >= 18 && hour < 20) return "dusk";
  return "night";
}
const PRESET_META: Record<LightPreset, { icon: string; label: string; bg: string; text: string; border: string }> = {
  dawn:  { icon: "🌅", label: "Dawn",  bg: "bg-orange-900/60",  text: "text-orange-200", border: "border-orange-400/30" },
  day:   { icon: "☀️",  label: "Day",   bg: "bg-sky-900/60",    text: "text-sky-100",    border: "border-sky-400/30"    },
  dusk:  { icon: "🌆", label: "Dusk",  bg: "bg-amber-900/60",  text: "text-amber-200", border: "border-amber-400/30"  },
  night: { icon: "🌙", label: "Night", bg: "bg-indigo-950/70", text: "text-indigo-200", border: "border-indigo-400/30" },
};

export interface RouteInfo {
  pickup: [number, number] | null;
  dropoff: [number, number] | null;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  durationMin: number;
  fare: number;
}

interface Props {
  onUpdate: (info: RouteInfo) => void;
  baseFare?: number;
}

async function reverseGeocode(lng: number, lat: number): Promise<string> {
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${TOKEN}&types=address,place&limit=1`);
    const data = await res.json();
    return data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}

async function forwardGeocode(query: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&country=PH&limit=1`);
    const data = await res.json();
    const feat = data.features?.[0];
    return feat ? (feat.geometry.coordinates as [number, number]) : null;
  } catch { return null; }
}

async function fetchRoute(from: [number, number], to: [number, number]) {
  try {
    const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${TOKEN}`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return { geometry: route.geometry, distanceKm: route.distance / 1000, durationMin: route.duration / 60 };
  } catch { return null; }
}

function makeMarkerEl(color: string) {
  const el = document.createElement("div");
  el.style.cssText = `width:20px;height:28px;cursor:pointer`;
  el.innerHTML = `<svg viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`;
  return el;
}

export default function BookingMap({ onUpdate, baseFare }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const modeRef = useRef<"pickup" | "dropoff">("pickup");
  const intervalRef = useRef<number | null>(null);

  const [mode, setMode] = useState<"pickup" | "dropoff">("pickup");
  const [currentPreset, setCurrentPreset] = useState<LightPreset>(() => getLightPreset(getPHHour()));
  const [phTime, setPhTime] = useState<string>(() => getPHTimeStr());
  const [pickup, setPickup] = useState<[number, number] | null>(null);
  const [dropoff, setDropoff] = useState<[number, number] | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupSearch, setPickupSearch] = useState("");
  const [dropoffSearch, setDropoffSearch] = useState("");
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [searching, setSearching] = useState<"pickup" | "dropoff" | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);

  // keep modeRef in sync so the click handler doesn't capture stale mode
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;

    const initialPreset = getLightPreset(getPHHour());

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: PH_CENTER,
      zoom: 17,
      pitch: 62,
      bearing: -15,
      scrollZoom: false,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    map.on("style.load", () => {
      // Apply real-time PH light preset
      map.setConfigProperty("basemap", "lightPreset", initialPreset);
      map.setConfigProperty("basemap", "show3dObjects", true);

      // 3D terrain
      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
      }

      setMapReady(true);
      setCurrentPreset(initialPreset);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            // Set pickup immediately so marker appears without waiting for geocode
            setPickup(coords);
            setPickupSearch("Getting address…");
            setMode("dropoff");
            modeRef.current = "dropoff";
            // Resolve address in background
            const addr = await reverseGeocode(coords[0], coords[1]);
            setPickupAddress(addr);
            setPickupSearch(addr);
            toast.success("Current location set as pickup");
          },
          () => { /* silently ignore initial location error */ },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    });

    map.on("click", async (e) => {
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const addr = await reverseGeocode(coords[0], coords[1]);
      if (modeRef.current === "pickup") {
        setPickup(coords); setPickupAddress(addr); setPickupSearch(addr);
      } else {
        setDropoff(coords); setDropoffAddress(addr); setDropoffSearch(addr);
      }
    });

    // Auto-update theme every minute based on PH clock
    intervalRef.current = window.setInterval(() => {
      const preset = getLightPreset(getPHHour());
      const timeStr = getPHTimeStr();
      setPhTime(timeStr);
      setCurrentPreset(preset);
      if (map.isStyleLoaded()) {
        map.setConfigProperty("basemap", "lightPreset", preset);
      }
    }, 60000);

    mapRef.current = map;
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // place pickup marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickup) return;
    pickupMarkerRef.current?.remove();
    pickupMarkerRef.current = new mapboxgl.Marker({ element: makeMarkerEl("#10b981"), anchor: "bottom" }).setLngLat(pickup).addTo(map);
    map.flyTo({ center: pickup, zoom: 17, pitch: 62, speed: 1.2 });
  }, [pickup]);

  // place dropoff marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !dropoff) return;
    dropoffMarkerRef.current?.remove();
    dropoffMarkerRef.current = new mapboxgl.Marker({ element: makeMarkerEl("#ef4444"), anchor: "bottom" }).setLngLat(dropoff).addTo(map);
    map.flyTo({ center: dropoff, zoom: 17, pitch: 62, speed: 1.2 });
  }, [dropoff]);

  // draw route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickup || !dropoff || !mapReady) return;
    const draw = async () => {
      const route = await fetchRoute(pickup, dropoff);
      if (!route) return;
      setDistanceKm(route.distanceKm);
      setDurationMin(route.durationMin);
      const fare = Math.round((baseFare ?? BASE_FARE) + route.distanceKm * PER_KM);
      onUpdate({ pickup, dropoff, pickupAddress, dropoffAddress, distanceKm: route.distanceKm, durationMin: route.durationMin, fare });

      const addLayers = (geom: unknown) => {
        if (map.getSource("route")) {
          (map.getSource("route") as mapboxgl.GeoJSONSource).setData(geom as GeoJSON.Geometry);
        } else {
          map.addSource("route", { type: "geojson", data: geom as GeoJSON.Geometry });
          // outer bloom
          map.addLayer({ id: "route-bloom", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#a855f7", "line-width": 22, "line-opacity": 0.18 } });
          // neon glow
          map.addLayer({ id: "route-glow",  type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#c084fc", "line-width": 10, "line-opacity": 0.55 } });
          // vivid main line
          map.addLayer({ id: "route-line",  type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#a855f7", "line-width": 4,  "line-opacity": 1    } });
          // white core
          map.addLayer({ id: "route-core",  type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.85 } });
        }
      };

      if (map.isStyleLoaded()) addLayers(route.geometry);
      else map.once("idle", () => addLayers(route.geometry));

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(pickup); bounds.extend(dropoff);
      map.fitBounds(bounds, { padding: 80, maxZoom: 17, pitch: 55, speed: 1.2 });
    };
    void draw();
  }, [pickup, dropoff, mapReady]);

  const searchAddress = async (type: "pickup" | "dropoff") => {
    setSearching(type);
    const coords = await forwardGeocode(type === "pickup" ? pickupSearch : dropoffSearch);
    setSearching(null);
    if (!coords) { return; }
    const addr = await reverseGeocode(coords[0], coords[1]);
    if (type === "pickup") { setPickup(coords); setPickupAddress(addr); setPickupSearch(addr); }
    else { setDropoff(coords); setDropoffAddress(addr); setDropoffSearch(addr); }
  };

  const goToMyLocation = () => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17, pitch: 62, speed: 1.4 }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const clearPickup = () => { setPickup(null); setPickupAddress(""); setPickupSearch(""); pickupMarkerRef.current?.remove(); pickupMarkerRef.current = null; };
  const clearDropoff = () => { setDropoff(null); setDropoffAddress(""); setDropoffSearch(""); dropoffMarkerRef.current?.remove(); dropoffMarkerRef.current = null; };
  const fare = Math.round((baseFare ?? BASE_FARE) + distanceKm * PER_KM);

  return (
    <div className="space-y-3">

      {/* Step indicator */}
      <div className="flex items-center gap-3 px-1">
        <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${mode === "pickup" ? "text-emerald-400" : pickup ? "text-emerald-600" : "text-muted-foreground"}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${pickup ? "bg-emerald-500 text-white" : mode === "pickup" ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400" : "bg-secondary border border-border text-muted-foreground"}`}>1</div>
          Pickup
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${mode === "dropoff" ? "text-red-400" : dropoff ? "text-red-600" : "text-muted-foreground"}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${dropoff ? "bg-red-500 text-white" : mode === "dropoff" ? "bg-red-500/20 border border-red-500/50 text-red-400" : "bg-secondary border border-border text-muted-foreground"}`}>2</div>
          Dropoff
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 p-1 rounded-xl bg-secondary border border-border">
        <button onClick={() => setMode("pickup")}
          className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-all ${mode === "pickup" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <MapPin className="w-3.5 h-3.5" />Set Pickup
        </button>
        <button onClick={() => setMode("dropoff")}
          className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-all ${mode === "dropoff" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Navigation2 className="w-3.5 h-3.5" />Set Dropoff
        </button>
      </div>

      {/* Search inputs */}
      <div className="grid sm:grid-cols-2 gap-2">
        {(["pickup", "dropoff"] as const).map((type) => {
          const isPickup = type === "pickup";
          const val = isPickup ? pickupSearch : dropoffSearch;
          const set = isPickup ? setPickupSearch : setDropoffSearch;
          const clear = isPickup ? clearPickup : clearDropoff;
          const pinned = isPickup ? pickup : dropoff;
          const accentClear = isPickup ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/30" : "bg-red-500/15 text-red-400 hover:bg-red-500/30 border-red-500/30";
          return (
            <div key={type} className="space-y-1">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  {isPickup
                    ? <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400 pointer-events-none" />
                    : <Navigation2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-400 pointer-events-none" />}
                  <Input
                    placeholder={isPickup ? "Pickup location…" : "Dropoff location…"}
                    value={val} onChange={(e) => set(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchAddress(type)}
                    className="pl-8 h-9 text-sm bg-background border-border focus:border-violet-500/50"
                  />
                </div>
                <button onClick={() => searchAddress(type)} disabled={!val || searching === type}
                  className="h-9 w-9 rounded-lg border border-border bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors shrink-0">
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>
              {pinned && (
                <button onClick={clear}
                  className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${accentClear}`}>
                  <X className="w-2.5 h-2.5" />
                  Remove {isPickup ? "pickup" : "dropoff"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-border shadow-lg" style={{ height: 400 }}>
        <div ref={containerRef} className="w-full h-full" />

        {/* PH time + theme badge */}
        <div className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md border shadow-md text-xs font-medium pointer-events-none ${PRESET_META[currentPreset].bg} ${PRESET_META[currentPreset].text} ${PRESET_META[currentPreset].border}`}>
          <span>{PRESET_META[currentPreset].icon}</span>
          <span>{PRESET_META[currentPreset].label}</span>
          <span className="opacity-50">·</span>
          <span>{phTime} PHT</span>
        </div>

        {/* My location button */}
        <button onClick={goToMyLocation} disabled={locating}
          className="absolute top-10 left-2 z-10 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-background/90 backdrop-blur-sm border border-border text-xs font-medium text-foreground hover:bg-background transition-colors shadow-md disabled:opacity-60">
          <Crosshair className={`w-3.5 h-3.5 ${locating ? "animate-spin text-violet-400" : "text-muted-foreground"}`} />
          {locating ? "Locating…" : "My location"}
        </button>

        {/* Scroll hint */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] text-muted-foreground border border-border shadow-sm">
            <MousePointer2 className="w-3 h-3" />
            Click map to place {mode === "pickup" ? "pickup" : "dropoff"} · Use +/− to zoom · Drag to rotate 3D
          </div>
        </div>

        {/* Mode indicator pulse on map */}
        {!pickup && mode === "pickup" && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="flex items-center gap-2 bg-emerald-500/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white shadow-lg">
              <MapPin className="w-3 h-3" />Click to set pickup
            </div>
          </div>
        )}
        {pickup && !dropoff && mode === "dropoff" && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-white shadow-lg">
              <Navigation2 className="w-3 h-3" />Click to set dropoff
            </div>
          </div>
        )}
      </div>

      {/* Route summary */}
      {pickup && dropoff && distanceKm > 0 && (
        <div className="p-4 rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Route className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold">Route Summary</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-background/50">
              <div className="text-lg font-bold text-foreground">{distanceKm.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-0.5">km</span></div>
              <div className="text-xs text-muted-foreground">Distance</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <div className="text-lg font-bold text-foreground">{Math.round(durationMin)}<span className="text-xs font-normal text-muted-foreground ml-0.5">min</span></div>
              <div className="text-xs text-muted-foreground">Est. time</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <div className="text-lg font-bold text-emerald-400">₱{fare}</div>
              <div className="text-xs text-muted-foreground">Est. fare</div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Base ₱{baseFare ?? BASE_FARE} + ₱{PER_KM}/km · Final fare may vary</p>
        </div>
      )}
    </div>
  );
}
