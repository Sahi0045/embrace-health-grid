/**
 * Hyperledger Fabric Simulation Worker
 *
 * Runs in a separate Web Worker thread.
 * Handles WebSocket connection maintenance and telemetry simulation timers
 * to prevent main thread blocking and browser tab throttling.
 */

// Worker state
let isLeader = false;
let wsUrl = "";
let socket: WebSocket | null = null;
let vitalsTimer: any = null;
let staffTimer: any = null;
let isConnected = false;

// Handle messages from the main thread
self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case "INIT":
      wsUrl = payload.wsUrl;
      updateLeaderStatus(payload.isLeader);
      break;

    case "SET_LEADER":
      updateLeaderStatus(payload.isLeader);
      break;

    case "CLOSE":
      stopAll();
      break;

    default:
      console.warn(`[Fabric Worker] Unknown message type: ${type}`);
  }
};

/**
 * Updates the leader status and toggles connections/timers accordingly.
 */
function updateLeaderStatus(newLeaderStatus: boolean) {
  const statusChanged = isLeader !== newLeaderStatus;
  isLeader = newLeaderStatus;

  if (isLeader) {
    console.log("[Fabric Worker] Appointed as leader. Starting active background tasks...");
    startWebSocket();
    startSimulationTimers();
  } else {
    if (statusChanged) {
      console.log("[Fabric Worker] Stepped down as leader. Stopping WebSocket and timers...");
    }
    stopAll();
  }
}

/**
 * Stops WebSocket connections and simulation timers.
 */
function stopAll() {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (vitalsTimer) {
    clearInterval(vitalsTimer);
    vitalsTimer = null;
  }
  if (staffTimer) {
    clearInterval(staffTimer);
    staffTimer = null;
  }
  if (isConnected) {
    isConnected = false;
    postMessage({ type: "WS_STATUS", payload: { connected: false } });
  }
}

/**
 * Connects to the Fabric WebSocket server.
 */
function startWebSocket() {
  if (socket && socket.readyState < 2) return; // Already connecting or connected
  if (!wsUrl) return;

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      isConnected = true;
      postMessage({ type: "WS_STATUS", payload: { connected: true } });
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        postMessage({ type: "WS_MESSAGE", payload: msg });
      } catch (err) {
        // Silently catch json parsing issues
      }
    };

    socket.onerror = () => {
      // Handled by onclose reconnection
    };

    socket.onclose = () => {
      if (isConnected) {
        isConnected = false;
        postMessage({ type: "WS_STATUS", payload: { connected: false } });
      }
      socket = null;

      // Reconnect after 5 seconds if still the leader
      if (isLeader) {
        setTimeout(startWebSocket, 5000);
      }
    };
  } catch (err) {
    socket = null;
    if (isLeader) {
      setTimeout(startWebSocket, 5000);
    }
  }
}

/**
 * Runs the simulation loops on behalf of the application when offline/online.
 */
function startSimulationTimers() {
  if (vitalsTimer) clearInterval(vitalsTimer);
  if (staffTimer) clearInterval(staffTimer);

  // Vitals simulation ticker (5s)
  vitalsTimer = setInterval(() => {
    postMessage({ type: "SIMULATE_VITALS_TICK" });
  }, 5000);

  // Staff movement simulation ticker (8s)
  staffTimer = setInterval(() => {
    postMessage({ type: "SIMULATE_STAFF_TICK" });
  }, 8000);
}
export {};
