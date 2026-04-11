"use client";

import { useMemo } from "react";

// Kazakhstan bounding box
const KZ_LAT_MIN = 40.5;
const KZ_LAT_MAX = 55.5;
const KZ_LON_MIN = 50.2;
const KZ_LON_MAX = 87.4;

// Convert lat/lon → SVG percentage coordinates
function toSvgCoords(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - KZ_LON_MIN) / (KZ_LON_MAX - KZ_LON_MIN)) * 100;
  const y = ((KZ_LAT_MAX - lat) / (KZ_LAT_MAX - KZ_LAT_MIN)) * 100; // y inverted
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

const MAJOR_CITIES = [
  { name: "Астана", lat: 51.18, lon: 71.45 },
  { name: "Алматы", lat: 43.25, lon: 76.95 },
  { name: "Шымкент", lat: 42.32, lon: 69.6 },
  { name: "Актобе", lat: 50.28, lon: 57.2 },
  { name: "Қарағанды", lat: 49.8, lon: 73.1 },
  { name: "Атырау", lat: 47.1, lon: 51.9 },
  { name: "Актау", lat: 43.65, lon: 51.17 },
  { name: "Павлодар", lat: 52.28, lon: 76.97 },
  { name: "Семей", lat: 50.41, lon: 80.23 },
  { name: "Өскемен", lat: 49.97, lon: 82.61 },
];

// Simplified Kazakhstan coast/border as SVG polyline points (percentage coords)
// Rough outline points going CW from NW corner
const KZ_OUTLINE_POINTS = [
  [5, 2], [18, 0], [30, 5], [42, 2], [55, 6], [68, 4], [80, 8], [90, 12],
  [98, 18], [96, 28], [99, 38], [95, 48], [88, 55], [80, 62], [68, 65],
  [55, 70], [45, 75], [35, 72], [25, 80], [15, 78], [8, 72], [2, 60],
  [0, 48], [2, 35], [0, 22], [5, 10], [5, 2],
]
  .map(([x, y]) => `${x},${y}`)
  .join(" ");

export type GeoPoint = {
  ticket_id: string;
  latitude: number;
  longitude: number;
  ai_priority?: number | null;
  client_city?: string | null;
  client_segment?: string | null;
};

interface KazakhstanMapProps {
  points: GeoPoint[];
  className?: string;
}

function priorityColor(priority?: number | null): string {
  if (!priority) return "#60a5fa"; // blue-400
  if (priority >= 8) return "#ef4444"; // red-500
  if (priority >= 5) return "#f97316"; // orange-500
  return "#22c55e"; // green-500
}

function priorityGlow(priority?: number | null): string {
  if (!priority) return "none";
  if (priority >= 8) return "0 0 6px 2px rgba(239,68,68,0.7)";
  if (priority >= 5) return "0 0 4px 1px rgba(249,115,22,0.6)";
  return "none";
}

export function KazakhstanMap({ points, className }: KazakhstanMapProps) {
  const svgPoints = useMemo(
    () =>
      points
        .filter(
          (p) =>
            p.latitude >= KZ_LAT_MIN &&
            p.latitude <= KZ_LAT_MAX &&
            p.longitude >= KZ_LON_MIN &&
            p.longitude <= KZ_LON_MAX
        )
        .map((p) => ({ ...p, ...toSvgCoords(p.latitude, p.longitude) })),
    [points]
  );

  return (
    <div className={`relative w-full h-full overflow-hidden rounded-md ${className ?? ""}`}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
      >
        {/* Background */}
        <rect width="100" height="100" fill="transparent" />

        {/* Kazakhstan rough outline */}
        <polyline
          points={KZ_OUTLINE_POINTS}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />

        {/* Grid lines */}
        {[25, 50, 75].map((v) => (
          <g key={v}>
            <line x1={v} y1="0" x2={v} y2="100" stroke="hsl(var(--border))" strokeWidth="0.15" strokeDasharray="1,2" />
            <line x1="0" y1={v} x2="100" y2={v} stroke="hsl(var(--border))" strokeWidth="0.15" strokeDasharray="1,2" />
          </g>
        ))}

        {/* Ticket dots */}
        {svgPoints.map((p) => (
          <circle
            key={p.ticket_id}
            cx={p.x}
            cy={p.y}
            r="0.8"
            fill={priorityColor(p.ai_priority)}
            opacity="0.85"
          >
            <title>
              {p.client_city ?? "Unknown"} | Priority: {p.ai_priority ?? "N/A"} | {p.client_segment ?? ""}
            </title>
          </circle>
        ))}

        {/* Major city markers */}
        {MAJOR_CITIES.map((city) => {
          const { x, y } = toSvgCoords(city.lat, city.lon);
          return (
            <g key={city.name}>
              <circle cx={x} cy={y} r="0.9" fill="hsl(var(--foreground))" opacity="0.6" />
              <text
                x={x + 1.2}
                y={y + 0.5}
                fontSize="2.5"
                fill="hsl(var(--muted-foreground))"
                fontFamily="sans-serif"
              >
                {city.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-[10px] text-muted-foreground bg-background/80 rounded px-2 py-1 backdrop-blur-sm">
        {[
          { color: "#ef4444", label: "High (8-10)" },
          { color: "#f97316", label: "Med (5-7)" },
          { color: "#22c55e", label: "Low (1-4)" },
          { color: "#60a5fa", label: "No data" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Point count */}
      <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-background/80 rounded px-2 py-0.5 backdrop-blur-sm">
        {svgPoints.length} точек
      </div>
    </div>
  );
}
