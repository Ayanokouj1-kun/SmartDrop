import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

interface MapViewProps {
  className?: string;
  fallbackCenter?: [number, number]; // [lng, lat]
  zoom?: number;
}

export default function MapView({
  className = "w-full h-full",
  fallbackCenter = [120.9842, 14.5995], // Manila, PH
  zoom = 14,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [status, setStatus] = useState<string>("Locating you…");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN || TOKEN.includes("your_mapbox_public_token_here")) return;

    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: fallbackCenter,
      zoom,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    });
    map.addControl(geolocate, "top-right");

    map.on("load", () => {
      geolocate.trigger();
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            map.flyTo({ center: c, zoom: 15, essential: true });
            new mapboxgl.Marker({ color: "#e11d48" }).setLngLat(c).addTo(map);
            setStatus("");
          },
          () => setStatus("Location unavailable — showing default area."),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        setStatus("Geolocation not supported by your browser.");
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [fallbackCenter, zoom]);

  if (!TOKEN || TOKEN.includes("your_mapbox_public_token_here")) {
    return (
      <div className={`${className} flex items-center justify-center bg-secondary border border-border rounded-lg text-sm text-muted-foreground p-6 text-center`}>
        Add your Mapbox public token to <code className="mx-1 px-1 rounded bg-background">.env.local</code> as <code className="mx-1 px-1 rounded bg-background">VITE_MAPBOX_PUBLIC_TOKEN</code> to load the map.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className={className} />
      {status && (
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-md bg-background/80 backdrop-blur border border-border text-xs text-muted-foreground">
          {status}
        </div>
      )}
    </div>
  );
}
