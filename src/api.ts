
import type {
  Measurement,
  Status,
  Waypoint,
  WasteDetectionResponse,
} from "./types";

// Configure these in your frontend hosting environment.
const SIMULATOR_URL = (
  import.meta.env.VITE_SIMULATOR_URL ||
  "/sim"
).replace(/\/+$/, "");


const YOLO_URL = (
  import.meta.env.VITE_YOLO_URL ||
  "https://yolo11-zwvx.onrender.com"
).replace(/\/+$/, "");


function simulatorUrl(path: string): string {
  // Already an absolute URL
  if (/^https?:\/\//i.test(path)) return path;

  // With a direct Render base URL, append the relative path.
  if (/^https?:\/\//i.test(SIMULATOR_URL)) {
    return `${SIMULATOR_URL}/${path.replace(/^\/+/, "")}`;
  }

  return `${SIMULATOR_URL}/${path.replace(/^\/+/, "")}`;
}

async function readJson(response: Response): Promise<any> {
  return response.json().catch(() => null);
}

function errorMessage(body: any, fallback: string): string {
  if (typeof body?.detail === "string") return body.detail;
  if (typeof body?.error === "string") return body.error;
  return fallback;
}

export async function startMission(
  id: number,
  wps: Waypoint[],
  interval: number
) {
  const payload = {
    mission_id: Number(id),
    interval_seconds: Number(interval),
    waypoints: wps.map((p, index) => ({
      lat: Number(p.lat),
      lon: Number(p.lng),
      point_index: index + 1,
    })),
  };

  const response = await fetch(simulatorUrl("/waypoints"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      errorMessage(body, `Mission start failed (${response.status})`)
    );
  }

  return body;
}

export async function status(): Promise<Status> {
  const response = await fetch(simulatorUrl("/status"));

  if (!response.ok) {
    throw new Error(`Could not get simulator status (${response.status})`);
  }

  return response.json();
}

export async function stop() {
  const response = await fetch(simulatorUrl("/stop"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: "operator_stop" }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      errorMessage(body, `Could not stop mission (${response.status})`)
    );
  }

  return body;
}

export function stream(
  cb: (measurement: Measurement) => void,
  err: () => void
) {
  const eventSource = new EventSource(
    simulatorUrl("/measurements/stream")
  );

  eventSource.addEventListener("measurement", (event) => {
    try {
      const measurement = JSON.parse(
        (event as MessageEvent).data
      ) as Measurement;

      cb(measurement);
    } catch (error) {
      console.error("Invalid measurement event:", error);
    }
  });

  eventSource.onerror = () => {
    err();
  };

  return () => eventSource.close();
}

export async function detectWaste(
  imageUrl: string,
  filename: string
): Promise<WasteDetectionResponse> {
  // Resolve camera image URLs correctly.
  const resolvedImageUrl = /^https?:\/\//i.test(imageUrl)
    ? imageUrl
    : simulatorUrl(imageUrl);

  const imageResponse = await fetch(resolvedImageUrl);

  if (!imageResponse.ok) {
    throw new Error(
      `Could not download camera image (${imageResponse.status})`
    );
  }

  const imageBlob = await imageResponse.blob();
  const form = new FormData();

  form.append("file", imageBlob, filename || "camera-image.jpg");

  const response = await fetch(`${YOLO_URL}/predict`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: form,
  });

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      errorMessage(body, `YOLO prediction failed (${response.status})`)
    );
  }

  return body as WasteDetectionResponse;
}

