import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  Anchor,
  Droplets,
  LocateFixed,
  MapPin,
  Play,
  Search,
  Square,
  Thermometer,
  Waves,
  X,
  Zap,
  Recycle,
} from "lucide-react";

import MapView from "./MapView";

import type {
  Point,
  Waypoint,
  Measurement,
  Status,
  WasteDetectionResponse,
} from "./types";

import {
  grid,
  order,
  score,
  color,
  label,
} from "./utils";

import {
  startMission,
  status,
  stop,
  stream,
  detectWaste,
} from "./api";


const HOME: Point = {
  lat: 8.5214,
  lng: 76.9431,
};


export default function App() {

  const [home] =
    useState<Point>(HOME);

  const [center, setCenter] =
    useState<Point>(HOME);

  const [fly, setFly] =
    useState<Point | null>(HOME);


  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<any[]>([]);


  const [drawing, setDrawing] =
    useState(false);

  const [poly, setPoly] =
    useState<Point[]>([]);


  const [wps, setWps] =
    useState<Waypoint[]>([]);


  const [spacing, setSpacing] =
    useState(40);

  const [interval, setInterval] =
    useState(5);


  const [ms, setMs] =
    useState<Map<number, Measurement>>(
      new Map()
    );


  const [selected, setSelected] =
    useState<Measurement | null>(
      null
    );


  const [live, setLive] =
    useState(false);


  const [starting, setStarting] =
    useState(false);


  const [msg, setMsg] =
    useState(
      "Search for an area or draw a survey shape."
    );


  const [st, setSt] =
    useState<Status>({
      status: "idle",
      mission_id: null,
      current_waypoint: 0,
      total_waypoints: 0,
      measurements_generated: 0,
      last_measurement: null,
      error: null,
    });


  const [waste, setWaste] =
    useState<Map<number, WasteDetectionResponse>>(
      new Map()
    );

  const [wasteRunning, setWasteRunning] =
    useState(false);

  const [wasteProgress, setWasteProgress] =
    useState(0);

  const [wasteMessage, setWasteMessage] =
    useState("Floating waste detection is available after the survey completes.");


  /*
   * Live simulator stream
   */

  useEffect(() => {

    const off = stream(

      (measurement) => {

        setLive(true);


        setMs((previous) => {

          const next =
            new Map(previous);

          next.set(
            measurement.point_index,
            measurement
          );

          return next;
        });


        setSt((previous) => ({
          ...previous,

          status: "running",

          current_waypoint:
            measurement.point_index,

          measurements_generated:
            Math.max(
              previous.measurements_generated,
              measurement.point_index
            ),

          last_measurement:
            measurement,
        }));
      },


      () => {
        setLive(false);
      }

    );


    const timer =
      window.setInterval(() => {

        status()
          .then(setSt)
          .catch(() => {});

      }, 1200);


    return () => {
      off();
      window.clearInterval(timer);
    };

  }, []);


  /*
   * Search
   */

  async function search() {

    if (!query.trim()) return;


    try {

      const response =
        await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(
            query
          )}`
        );


      if (!response.ok) {
        throw new Error(
          "Search failed"
        );
      }


      const data =
        await response.json();


      setResults(data);

    } catch {

      setMsg(
        "Search failed."
      );

    }
  }


  /*
   * Select search result
   */

  function choose(result: any) {

    const point: Point = {
      lat: Number(result.lat),
      lng: Number(result.lon),
    };


    setCenter(point);

    setFly(point);

    setResults([]);
  }


  /*
   * Finish drawing
   */

  function finish() {

    if (poly.length < 3) {

      setMsg(
        "Draw at least 3 points."
      );

      return;
    }


    const generated =
      grid(
        poly,
        spacing
      );


    setWps(
      order(
        generated,
        home
      )
    );


    setDrawing(false);


    setMsg(
      `${generated.length} points generated.`
    );
  }


  /*
   * Regenerate grid
   */

  function regenerate() {

    if (poly.length < 3) {

      setMsg(
        "Draw at least 3 points."
      );

      return;
    }


    const generated =
      grid(
        poly,
        spacing
      );


    setWps(
      order(
        generated,
        home
      )
    );


    setMsg(
      `${generated.length} points regenerated.`
    );
  }


  /*
   * Start mission
   */

  async function start() {

    if (!wps.length) {

      setMsg(
        "Generate waypoints first."
      );

      return;
    }


    if (
      starting ||
      st.status === "running"
    ) {
      return;
    }


    setStarting(true);


    const missionId =
      Date.now();


    /*
     * Survey points + HOME
     */

    const mission: Waypoint[] = [

      ...wps,

      {
        ...home,

        point_index:
          wps.length + 1,
      },

    ];


    setMs(new Map());

    setWaste(new Map());
    setWasteProgress(0);
    setWasteMessage("Floating waste detection will be available after the survey completes.");

    setSelected(null);


    setMsg(
      "Starting simulated boat..."
    );


    try {

      console.log(
        "========== STARTING MISSION =========="
      );


      console.log(
        JSON.stringify(
          {
            mission_id:
              missionId,

            interval_seconds:
              interval,

            waypoints:
              mission,
          },
          null,
          2
        )
      );


      const response =
        await startMission(
          missionId,
          mission,
          interval
        );


      console.log(
        "Simulator accepted mission:",
        response
      );


      setMsg(
        `Mission started: ${wps.length} survey points + home return.`
      );


    } catch (error) {

      console.error(
        "Mission start failed:",
        error
      );


      setMsg(
        error instanceof Error
          ? error.message
          : "Mission start failed."
      );


    } finally {

      setStarting(false);

    }
  }


  /*
   * Stop
   */

  async function halt() {

    try {

      await stop();

      setStarting(false);

      setMsg(
        "Stop requested."
      );

    } catch {

      setMsg(
        "Could not stop mission."
      );

    }
  }


  async function runWasteDetection() {

    if (wasteRunning) return;

    if (!wps.length) {
      setWasteMessage("Generate survey waypoints first.");
      return;
    }

    if (measured.length < wps.length || st.status !== "completed") {
      setWasteMessage("Complete the full survey and return home first.");
      return;
    }

    setWasteRunning(true);
    setWasteProgress(0);
    setWaste(new Map());
    setWasteMessage(`Preparing ${measured.length} camera images...`);

    const orderedMeasurements = [...measured].sort(
      (a, b) => a.point_index - b.point_index
    );

    const results = new Map<number, WasteDetectionResponse>();

    for (let i = 0; i < orderedMeasurements.length; i++) {
      const measurement = orderedMeasurements[i];

      setWasteMessage(
        `Detecting floating waste: ${i + 1} / ${orderedMeasurements.length} — Point ${measurement.point_index}`
      );

      try {
        const result = await detectWaste(
          measurement.camera.image_url,
          measurement.camera.filename
        );

        results.set(
          measurement.point_index,
          result
        );

        setWaste(new Map(results));
      } catch (error) {
        console.error(
          `Waste detection failed for point ${measurement.point_index}:`,
          error
        );

        results.set(
          measurement.point_index,
          {
            filename: measurement.camera.filename,
            image_width: 0,
            image_height: 0,
            detection_count: 0,
            detections: [],
            error:
              error instanceof Error
                ? error.message
                : "YOLO request failed",
          }
        );

        setWaste(new Map(results));
      }

      setWasteProgress(
        Math.round(
          ((i + 1) / orderedMeasurements.length) * 100
        )
      );
    }

    const detectedPoints = [...results.values()].filter(
      (result) => result.detection_count > 0
    ).length;

    const detectedObjects = [...results.values()].reduce(
      (total, result) =>
        total + result.detection_count,
      0
    );

    setWasteMessage(
      detectedObjects > 0
        ? `Detection complete: ${detectedObjects} waste object${detectedObjects === 1 ? "" : "s"} found across ${detectedPoints} point${detectedPoints === 1 ? "" : "s"}.`
        : "Detection complete: no floating waste detected."
    );

    setWasteRunning(false);
  }


  /*
   * Survey measurements only.
   * Home measurement is excluded.
   */

  const measured =
    useMemo(
      () =>
        [...ms.values()].filter(
          (measurement) =>
            measurement.point_index <=
            wps.length
        ),
      [ms, wps]
    );


  const surveyComplete =
    wps.length > 0 &&
    measured.length >= wps.length &&
    st.status === "completed";

  const wasteObjectCount =
    [...waste.values()].reduce(
      (total, result) =>
        total + result.detection_count,
      0
    );

  const wastePointCount =
    [...waste.values()].filter(
      (result) => result.detection_count > 0
    ).length;


  /*
   * Overall pollution
   */

  const overall =
    measured.length
      ? Math.round(
          measured.reduce(
            (
              total,
              measurement
            ) =>
              total +
              score(
                measurement.sensors
              ),
            0
          ) /
            measured.length
        )
      : 0;


  /*
   * Average sensor
   */

  const avg = (
    key: keyof Measurement["sensors"]
  ) =>
    measured.length
      ? (
          measured.reduce(
            (
              total,
              measurement
            ) =>
              total +
              measurement.sensors[
                key
              ],
            0
          ) /
          measured.length
        ).toFixed(
          key === "ph"
            ? 2
            : 1
        )
      : "—";


  /*
   * Boat position
   */

  const boat: Point | null =
    st.last_measurement
      ? {
          lat:
            st.last_measurement
              .gps.latitude,

          lng:
            st.last_measurement
              .gps.longitude,
        }
      : null;


  /*
   * Progress
   */

  const progress =
    st.total_waypoints
      ? Math.min(
          100,
          (st.measurements_generated /
            st.total_waypoints) *
            100
        )
      : 0;


  return (

    <div className="shell">


      {/* HEADER */}

      <header className="top glass">

        <div className="brand">

          <div className="logo">
            <Waves />
          </div>


          <div>

            <b>
              WaterBoat
            </b>

            <small>
              Smart water survey console
            </small>

          </div>

        </div>


        <div className="state">

          <i
            className={
              st.status
            }
          />

          {st.status.toUpperCase()}


          <span>

            ●{" "}

            {live
              ? "LIVE"
              : "OFFLINE"}

          </span>

        </div>

      </header>



      <main className="layout">


        {/* LEFT */}

        <aside className="left">


          {/* SURVEY PLANNER */}

          <section className="glass card">

            <div className="eyebrow">
              SURVEY PLANNER
            </div>


            <h2>
              Find your water area
            </h2>


            {/* SEARCH */}

            <div className="search">

              <Search />

              <input
                value={query}

                onChange={(event) =>
                  setQuery(
                    event.target.value
                  )
                }

                onKeyDown={(event) => {

                  if (
                    event.key ===
                    "Enter"
                  ) {
                    search();
                  }

                }}

                placeholder="Search lake, river, city..."
              />


              <button
                onClick={search}
              >
                Go
              </button>

            </div>


            {/* RESULTS */}

            {results.length > 0 && (

              <div className="results">

                {results.map(
                  (
                    result,
                    index
                  ) => (

                    <button
                      key={index}

                      onClick={() =>
                        choose(
                          result
                        )
                      }
                    >

                      <MapPin />

                      {
                        result.display_name
                      }

                    </button>

                  )
                )}

              </div>

            )}


            {/* DRAW / HOME */}

            <div className="row">

              <button
                className={
                  drawing
                    ? "active"
                    : ""
                }

                onClick={() => {

                  setDrawing(
                    true
                  );

                  setPoly([]);

                  setWps([]);

                  setMs(
                    new Map()
                  );

                  setSelected(
                    null
                  );


                  setMsg(
                    "Click around the water area, then press Finish shape."
                  );

                }}
              >

                <MapPin />

                Draw shape

              </button>


              <button
                onClick={() =>
                  setFly(home)
                }
              >

                <LocateFixed />

                Home

              </button>

            </div>


            {/* SETTINGS */}

            <div className="inputs">

              <label>

                Grid spacing

                <input
                  type="number"

                  value={spacing}

                  min={10}

                  onChange={(event) =>
                    setSpacing(
                      Number(
                        event.target.value
                      )
                    )
                  }
                />

                <small>
                  m
                </small>

              </label>


              <label>

                Reading gap

                <input
                  type="number"

                  value={interval}

                  min={1}

                  onChange={(event) =>
                    setInterval(
                      Number(
                        event.target.value
                      )
                    )
                  }
                />

                <small>
                  s
                </small>

              </label>

            </div>


            {/* GENERATE / CLEAR */}

            <div className="row">

              <button
                className="primary"

                onClick={
                  regenerate
                }

                disabled={
                  poly.length < 3
                }
              >

                <Zap />

                Generate grid

              </button>


              <button
                onClick={() => {

                  setPoly([]);

                  setWps([]);

                  setMs(
                    new Map()
                  );

                  setSelected(
                    null
                  );

                  setDrawing(
                    false
                  );


                  setMsg(
                    "Survey cleared."
                  );

                }}
              >

                <X />

                Clear

              </button>

            </div>


            <p className="hint">
              {msg}
            </p>

          </section>



          {/* MISSION CONTROL */}

          <section className="glass card">

            <div className="eyebrow">
              MISSION CONTROL
            </div>


            <h2>
              Survey run
            </h2>


            <div className="stats">

              <div>

                <b>
                  {wps.length}
                </b>

                <small>
                  points
                </small>

              </div>


              <div>

                <b>
                  {
                    st.measurements_generated
                  }
                </b>

                <small>
                  readings
                </small>

              </div>


              <div>

                <b>
                  {Math.round(
                    progress
                  )}
                  %
                </b>

                <small>
                  progress
                </small>

              </div>

            </div>


            <div className="bar">

              <i
                style={{
                  width:
                    `${progress}%`,
                }}
              />

            </div>


            {/* START */}

            <button
              className="start"

              onClick={start}

              disabled={
                !wps.length ||
                starting ||
                st.status ===
                  "running"
              }
            >

              <Play
                fill="currentColor"
              />


              {starting
                ? "Starting..."
                : st.status ===
                    "running"
                  ? "Measurement running"
                  : "Start measurement"}

            </button>


            {/* STOP */}

            <button
              className="stop"

              onClick={halt}

              disabled={
                st.status !==
                "running"
              }
            >

              <Square
                fill="currentColor"
              />

              Stop

            </button>


            <button
              className="waste-button"
              onClick={runWasteDetection}
              disabled={!surveyComplete || wasteRunning}
            >

              <Recycle />

              {wasteRunning
                ? `Detecting ${wasteProgress}%`
                : "Detect Floating Waste"}

            </button>

            {wasteRunning && (
              <div className="waste-progress">
                <div>
                  <span>YOLO11n analysis</span>
                  <b>{wasteProgress}%</b>
                </div>
                <i>
                  <em style={{ width: `${wasteProgress}%` }} />
                </i>
              </div>
            )}

            <p className="waste-hint">
              {!surveyComplete
                ? "Available after the complete survey and return to home."
                : wasteMessage}
            </p>

            {!wasteRunning && waste.size > 0 && (
              <div className="waste-summary">
                <span>♻ {wasteObjectCount} objects</span>
                <span>{wastePointCount} points</span>
              </div>
            )}


            <p className="hint">

              <Anchor />

              Home is automatically
              appended as the final
              waypoint.

            </p>

          </section>

        </aside>



        {/* MAP */}

        <section
          className="glass mapwrap"
        >

          <MapView

            center={center}

            home={home}

            poly={poly}

            drawing={drawing}


            add={(point) =>
              setPoly(
                (previous) => [
                  ...previous,
                  point,
                ]
              )
            }


            wps={wps}

            measure={ms}

            waste={waste}

            boat={boat}


            selected={
              selected?.point_index ??
              null
            }


            select={
              setSelected
            }

            fly={fly}

          />


          {/* DRAWING CONTROLS */}

          {drawing && (

            <div className="drawhelp">

              <strong>
                Draw survey area
              </strong>


              <span>
                Click around the water
                area
              </span>


              <small>

                {poly.length} point
                {poly.length === 1
                  ? ""
                  : "s"} selected

              </small>


              <div className="draw-actions">


                <button

                  onClick={() =>
                    setPoly(
                      (previous) =>
                        previous.slice(
                          0,
                          -1
                        )
                    )
                  }

                  disabled={
                    poly.length === 0
                  }

                >
                  ↩ Undo
                </button>


                <button

                  className="finish"

                  onClick={
                    finish
                  }

                  disabled={
                    poly.length < 3
                  }

                >
                  ✓ Finish shape
                </button>


                <button

                  onClick={() => {

                    setDrawing(
                      false
                    );

                    setPoly([]);

                    setWps([]);

                    setMs(
                      new Map()
                    );

                    setSelected(
                      null
                    );


                    setMsg(
                      "Drawing cancelled."
                    );

                  }}

                >
                  ✕ Cancel
                </button>

              </div>

            </div>

          )}

        </section>



        {/* RIGHT */}

        <aside className="right">


          {/* OVERALL */}

          <section className="glass card">

            <div className="eyebrow">
              OVERALL POLLUTION
            </div>


            <div className="score">

              <div
                className="ring"

                style={
                  {
                    "--c":
                      color(
                        overall
                      ),
                  } as React.CSSProperties
                }
              >

                <b>
                  {overall}
                </b>

                <small>
                  /100
                </small>

              </div>


              <div>

                <h2>
                  {label(
                    overall
                  )}
                </h2>

                <p>
                  Average survey
                  pollution index
                </p>

              </div>

            </div>

          </section>



          {/* WATER PROFILE */}

          <section className="glass card">

            <div className="eyebrow">
              WATER PROFILE
            </div>


            <h2>
              Sensor levels
            </h2>


            <div className="sensors">

              <Sensor
                icon={<Droplets />}
                name="pH"
                value={avg(
                  "ph"
                )}
              />


              <Sensor
                icon={<Zap />}
                name="TDS"
                value={avg(
                  "tds_ppm"
                )}
                unit="ppm"
              />


              <Sensor
                icon={<Waves />}
                name="Turbidity"
                value={avg(
                  "turbidity_ntu"
                )}
                unit="NTU"
              />


              <Sensor
                icon={
                  <Thermometer />
                }
                name="Temperature"
                value={avg(
                  "temperature_c"
                )}
                unit="°C"
              />


              <Sensor
                icon={<Activity />}
                name="Dissolved O₂"
                value={avg(
                  "dissolved_oxygen_mg_l"
                )}
                unit="mg/L"
              />

            </div>

          </section>



          {/* READINGS */}

          <section
            className="glass card readings"
          >

            <div className="eyebrow">
              POINT READINGS
            </div>


            <h2>
              {measured.length}
              {" "}
              captured
            </h2>


            {measured.map(
              (measurement) => (

                <button

                  className="reading"

                  key={
                    measurement.point_index
                  }

                  onClick={() =>
                    setSelected(
                      measurement
                    )
                  }

                >

                  <i
                    style={{
                      background:
                        color(
                          score(
                            measurement.sensors
                          )
                        ),
                    }}
                  />


                  <span>

                    <b>
                      Point{" "}
                      {
                        measurement.point_index
                      }
                    </b>


                    <small>

                      {measurement.gps.latitude.toFixed(
                        5
                      )}

                      ,{" "}

                      {measurement.gps.longitude.toFixed(
                        5
                      )}

                    </small>

                  </span>


                  <strong>

                    {score(
                      measurement.sensors
                    )}

                    {waste.get(measurement.point_index)?.detection_count ? (
                      <em className="waste-mini">♻</em>
                    ) : null}

                  </strong>

                </button>

              )
            )}

          </section>

        </aside>

      </main>



      {/* MEASUREMENT MODAL */}

      {selected && (

        <div

          className="overlay"

          onClick={() =>
            setSelected(null)
          }

        >

          <div

            className="modal glass"

            onClick={(event) =>
              event.stopPropagation()
            }

          >

            <button

              className="close"

              onClick={() =>
                setSelected(null)
              }

            >

              <X />

            </button>


            <div className="eyebrow">

              WAYPOINT{" "}

              {
                selected.point_index
              }

            </div>


            <h2>
              Measurement details
            </h2>


            <div className="details">

              {[
                [
                  "Latitude",
                  selected.gps.latitude.toFixed(
                    6
                  ),
                ],

                [
                  "Longitude",
                  selected.gps.longitude.toFixed(
                    6
                  ),
                ],

                [
                  "pH",
                  selected.sensors.ph.toFixed(
                    2
                  ),
                ],

                [
                  "TDS",
                  `${selected.sensors.tds_ppm} ppm`,
                ],

                [
                  "Turbidity",
                  `${selected.sensors.turbidity_ntu} NTU`,
                ],

                [
                  "Temperature",
                  `${selected.sensors.temperature_c} °C`,
                ],

                [
                  "Dissolved O₂",
                  `${selected.sensors.dissolved_oxygen_mg_l} mg/L`,
                ],

                [
                  "Pollution",
                  `${score(
                    selected.sensors
                  )}/100`,
                ],

              ].map(
                ([name, value]) => (

                  <div key={name}>

                    <small>
                      {name}
                    </small>

                    <b>
                      {value}
                    </b>

                  </div>

                )
              )}

            </div>


            {waste.has(selected.point_index) && (
              <section className="waste-details">

                <div className="eyebrow">
                  FLOATING WASTE
                </div>

                {waste.get(selected.point_index)?.error ? (
                  <p className="waste-error">
                    YOLO error: {waste.get(selected.point_index)?.error}
                  </p>
                ) : waste.get(selected.point_index)?.detection_count ? (
                  <>
                    <h3>
                      {waste.get(selected.point_index)?.detection_count} object
                      {waste.get(selected.point_index)?.detection_count === 1 ? "" : "s"} detected
                    </h3>

                    <div className="waste-list">
                      {waste.get(selected.point_index)?.detections.map(
                        (detection, index) => (
                          <div className="waste-item" key={`${detection.class}-${index}`}>
                            <span>
                              <b>{detection.class}</b>
                              <small>
                                {Math.round(detection.confidence * 100)}% confidence
                              </small>
                            </span>
                            <strong>
                              {Math.round(detection.confidence * 100)}%
                            </strong>
                          </div>
                        )
                      )}
                    </div>
                  </>
                ) : (
                  <p className="waste-none">
                    ✓ No floating waste detected at this point.
                  </p>
                )}

              </section>
            )}


            <img

              src={
                `/sim${selected.camera.image_url}`
              }

              alt={
                selected.camera.filename
              }

            />


            <small>

              {
                selected.camera.filename
              }

            </small>

          </div>

        </div>

      )}

    </div>
  );
}


/*
 * Sensor card
 */

function Sensor({
  icon,
  name,
  value,
  unit,
}: {
  icon: React.ReactNode;
  name: string;
  value: string;
  unit?: string;
}) {

  return (

    <div className="sensor">

      <span>
        {icon}
      </span>


      <div>

        <small>
          {name}
        </small>


        <b>

          {value}{" "}

          {unit && (
            <em>
              {unit}
            </em>
          )}

        </b>

      </div>

    </div>

  );
}