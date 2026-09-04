import { Fragment, useEffect } from "react";

import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  Marker,
  Tooltip,
  useMapEvents,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import type {
  Point,
  Waypoint,
  Measurement,
  WasteDetectionResponse,
} from "./types";

import {
  color,
  score,
} from "./utils";


const boatIcon = L.divIcon({
  className: "boat",
  html: `
    <div style="
      width:34px;
      height:34px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(135deg,#06b6d4,#6366f1);
      border:3px solid white;
      box-shadow:0 6px 18px rgba(15,23,42,.25);
      font-size:19px;
    ">⛵</div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function wasteIcon(count: number) {
  return L.divIcon({
    className: "waste-marker",
    html: `
      <div class="waste-dot" title="${count} floating waste object${count === 1 ? "" : "s"}">
        ♻
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 31],
  });
}

function Clicks({
  drawing,
  onClick,
}: {
  drawing: boolean;
  onClick: (point: Point) => void;
}) {
  useMapEvents({
    click(event) {
      if (!drawing) return;
      onClick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });
  return null;
}

function Fly({ to }: { to: Point | null }) {
  const map = useMap();

  useEffect(() => {
    if (!to) return;
    map.flyTo([to.lat, to.lng], 15, { duration: 0.7 });
  }, [to, map]);

  return null;
}

export default function MapView({
  center,
  home,
  poly,
  drawing,
  add,
  wps,
  measure,
  waste,
  boat,
  selected,
  select,
  fly,
}: {
  center: Point;
  home: Point;
  poly: Point[];
  drawing: boolean;
  add: (point: Point) => void;
  wps: Waypoint[];
  measure: Map<number, Measurement>;
  waste: Map<number, WasteDetectionResponse>;
  boat: Point | null;
  selected: number | null;
  select: (measurement: Measurement) => void;
  fly: Point | null;
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      doubleClickZoom={false}
      className="map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Clicks drawing={drawing} onClick={add} />
      <Fly to={fly} />

      {poly.length >= 2 && (
        <Polyline
          positions={poly.map(
            (point) => [point.lat, point.lng] as [number, number]
          )}
          pathOptions={{
            color: "#7c3aed",
            dashArray: "8 6",
            weight: 4,
          }}
        />
      )}

      {poly.length >= 3 && (
        <Polygon
          positions={poly.map((point) => [point.lat, point.lng])}
          pathOptions={{
            color: "#7c3aed",
            fillColor: "#a78bfa",
            fillOpacity: 0.15,
            weight: 3,
          }}
        />
      )}

      {drawing &&
        poly.map((point, index) => (
          <CircleMarker
            key={`draw-${index}`}
            center={[point.lat, point.lng]}
            radius={7}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#7c3aed",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Tooltip direction="top">
              Point {index + 1}
            </Tooltip>
          </CircleMarker>
        ))}

      <Marker position={[home.lat, home.lng]}>
        <Tooltip permanent direction="top">
          Home
        </Tooltip>
      </Marker>

      {wps.map((waypoint) => {
        const measurement = measure.get(waypoint.point_index);
        const wasteResult = waste.get(waypoint.point_index);

        const pollutionColor = measurement
          ? color(score(measurement.sensors))
          : "#6366f1";

        return (
          <Fragment key={`point-${waypoint.point_index}`}>
            <CircleMarker
              center={[waypoint.lat, waypoint.lng]}
              radius={measurement ? 10 : 7}
              pathOptions={{
                color: pollutionColor,
                fillColor: pollutionColor,
                fillOpacity: measurement ? 0.82 : 0.25,
                weight:
                  selected === waypoint.point_index ? 4 : 2,
              }}
              eventHandlers={{
                click: () => {
                  if (measurement) select(measurement);
                },
              }}
            >
              <Tooltip>
                Point {waypoint.point_index}
                {measurement
                  ? ` • ${score(measurement.sensors)}/100`
                  : " • waiting"}
                {wasteResult?.detection_count
                  ? ` • ♻ ${wasteResult.detection_count}`
                  : ""}
              </Tooltip>
            </CircleMarker>

            {measurement && wasteResult?.detection_count ? (
              <Marker
                position={[waypoint.lat, waypoint.lng]}
                icon={wasteIcon(wasteResult.detection_count)}
                eventHandlers={{
                  click: () => select(measurement),
                }}
              >
                <Tooltip direction="top">
                  ♻ {wasteResult.detection_count} floating waste object
                  {wasteResult.detection_count === 1 ? "" : "s"}
                </Tooltip>
              </Marker>
            ) : null}
          </Fragment>
        );
      })}

      {boat && (
        <Marker
          position={[boat.lat, boat.lng]}
          icon={boatIcon}
        >
          <Tooltip permanent>
            Simulated boat
          </Tooltip>
        </Marker>
      )}
    </MapContainer>
  );
}
