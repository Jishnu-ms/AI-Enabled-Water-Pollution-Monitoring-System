# WaterBoat React + Local YOLO

## Local services

Terminal 1:
`uvicorn server:app --reload --port 9000`

Terminal 2:
`uvicorn main:app --reload --port 8000`

Terminal 3:
`npm install && npm run dev`

React proxies `/sim` to the hardware simulator and `/yolo` to the YOLO server.

The Floating Waste button is enabled only after all survey points are measured and the simulator reports `completed`. It analyzes survey camera images sequentially and adds waste markers to detected points.
