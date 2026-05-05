import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined;

interface MapViewProps {
  className?: string;
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  marker?: boolean;
}

export default function MapView({
  className = "w-full h-full",
  center = [120.9842, 14.5995], // Manila, PH
  zoom = 12,
  marker = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN || TOKEN.includes("your_mapbox_public_token_here")) return;

    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    if (marker) {
      new mapboxgl.Marker({ color: "#e11d48" }).setLngLat(center).addTo(map);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom, marker]);

  if (!TOKEN || TOKEN.includes("your_mapbox_public_token_here")) {
    return (
      <div className={`${className} flex items-center justify-center bg-secondary border border-border rounded-lg text-sm text-muted-foreground p-6 text-center`}>
        Add your Mapbox public token to <code className="mx-1 px-1 rounded bg-background">.env.local</code> as <code className="mx-1 px-1 rounded bg-background">VITE_MAPBOX_PUBLIC_TOKEN</code> to load the map.
      </div>
    );
  }

  return <div ref={containerRef} className={className} />;
}
