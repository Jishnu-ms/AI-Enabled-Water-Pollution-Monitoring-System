import type {
  Measurement,
  Status,
  Waypoint,
  WasteDetectionResponse,
} from "./types";

const A = "/sim";
const YOLO = "/yolo";

export async function startMission(
  id: number,
  wps: Waypoint[],
  interval: number
) {
  const waypoints = wps.map((p, index) => ({
    lat: Number(p.lat),
    lon: Number(p.lng),
    point_index: index + 1,
  }));

  const payload = {
    mission_id: Number(id),
    interval_seconds: Number(interval),
    waypoints,
  };

  console.log("========== WATERBOAT REQUEST ==========");
  console.log(JSON.stringify(payload, null, 2));
  console.log("========================================");

  const r = await fetch(A + "/waypoints", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await r.json().catch(() => null);

  console.log("========== SIMULATOR RESPONSE ==========");
  console.log("HTTP:", r.status);
  console.log(body);
  console.log("=========================================");

  if (!r.ok) {
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : JSON.stringify(
            body?.detail ?? "Mission start failed"
          )
    );
  }

  return body;
}

export async function status(): Promise<Status> {
  const r = await fetch(A + "/status");

  if (!r.ok) {
    throw new Error("Could not get simulator status");
  }

  return r.json();
}

export async function stop() {
  const r = await fetch(A + "/stop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: "operator_stop",
    }),
  });

  if (!r.ok) {
    throw new Error("Could not stop mission");
  }

  return r.json();
}

export function stream(
  cb: (m: Measurement) => void,
  err: () => void
) {
  const e = new EventSource(
    A + "/measurements/stream"
  );

  e.addEventListener(
    "measurement",
    (x) => {
      try {
        const measurement = JSON.parse(
          (x as MessageEvent).data
        ) as Measurement;

        cb(measurement);
      } catch (error) {
        console.error(
          "Invalid measurement event:",
          error
        );
      }
    }
  );

  e.onerror = () => {
    err();
  };

  return () => {
    e.close();
  };
}

export async function detectWaste(
  imageUrl: string,
  filename: string
): Promise<WasteDetectionResponse> {
  const imageResponse = await fetch(
    A + imageUrl
  );

  if (!imageResponse.ok) {
    throw new Error(
      `Could not download camera image (${imageResponse.status})`
    );
  }

  const blob = await imageResponse.blob();

  const form = new FormData();

  form.append(
    "file",
    blob,
    filename || "camera-image.jpg"
  );

  const response = await fetch(
    YOLO + "/predict",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: form,
    }
  );

  const body = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `YOLO prediction failed (${response.status})`
    );
  }

  return body as WasteDetectionResponse;
}
