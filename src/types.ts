export type Point = {
  lat: number;
  lng: number;
};

export type Waypoint = Point & {
  point_index: number;
};

export type Sensors = {
  ph: number;
  tds_ppm: number;
  turbidity_ntu: number;
  temperature_c: number;
  dissolved_oxygen_mg_l: number;
};

export type Measurement = {
  mission_id: number;
  point_index: number;
  timestamp: string;
  gps: {
    latitude: number;
    longitude: number;
  };
  sensors: Sensors;
  camera: {
    filename: string;
    mime_type: string;
    image_url: string;
  };
};

export type WasteDetection = {
  class: string;
  confidence: number;
  /** [x1, y1, x2, y2] in original image pixel coordinates */
  bbox: [number, number, number, number];
};

export type WasteDetectionResponse = {
  filename: string;
  image_width: number;
  image_height: number;
  detection_count: number;
  detections: WasteDetection[];
  error?: string;
};

export type Status = {
  status: string;
  mission_id: number | null;
  current_waypoint: number;
  total_waypoints: number;
  measurements_generated: number;
  last_measurement: Measurement | null;
  error: string | null;
};
