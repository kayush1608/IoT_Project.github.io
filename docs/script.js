const mqttUrl = "wss://f1ded01e.ala.asia-southeast1.emqxsl.com:8084/mqtt";
const options = {
  username: "ESP32",
  password: "Climate@310716",
  connectTimeout: 4000,
  reconnectPeriod: 2000,
};

const topicData = "esp32/sensors";
const topicControl = "esp32/control";
const topicOccupancy = "esp32/occupancy"; 
const client = mqtt.connect(mqttUrl, options);

let isConnected = false;

// Elements
const tempEl = document.getElementById("temperature-value");
const humidityEl = document.getElementById("humidity-value");
const co2El = document.getElementById("co2Level");
const feelsLikeEl = document.getElementById("feelsLike");
const occupancyEl = document.getElementById("occupancy-value");

const acStatus = document.getElementById("acStatus");
const fanStatus = document.getElementById("fanStatus");
const airPurifierStatus = document.getElementById("airPurifierStatus");
const ventStatus = document.getElementById("ventStatus");

const acDot = document.getElementById("acStatusDot");
const fanDot = document.getElementById("fanStatusDot");
const purifierDot = document.getElementById("airPurifierStatusDot");
const ventDot = document.getElementById("ventStatusDot");

const connectionStatus = document.getElementById("connectionStatus");
const connectionDot = document.getElementById("connectionStatusDot");

const acBtn = document.getElementById("acButton");
const fanBtn = document.getElementById("fanButton");
const purifierBtn = document.getElementById("airPurifierButton");
const ventBtn = document.getElementById("ventButton");

const autoCheck = document.getElementById("autoCheck");
const manualCheck = document.getElementById("manualCheck");
const disabledCheck = document.getElementById("disabledCheck");

// Initialize with null mode (unknown state)
let currentStatus = {
  fan_status: "off",
  vent_status: "closed",
  air_purifier_status: "off",
  ac_status: "off",
  mode: null, // Will be set when we receive first MQTT message
  occupancy: null
};

// Show "--" for all values until we receive data
document.addEventListener('DOMContentLoaded', () => {
  tempEl.textContent = "--";
  humidityEl.textContent = "--";
  co2El.textContent = "--";
  feelsLikeEl.textContent = "--";
  occupancyEl.textContent = "--";
  
  // Disable all controls until connected
  updateButtonStates();
});

// Function to calculate Heat Index (Feels Like Temperature)
function calculateHeatIndex(tempC, humidity) {
  const T = tempC;
  const RH = humidity;

  const HI = -8.78469475556 
    + 1.61139411 * T 
    + 2.33854883889 * RH 
    - 0.14611605 * T * RH 
    - 0.012308094 * T * T 
    - 0.0164248277778 * RH * RH 
    + 0.002211732 * T * T * RH 
    + 0.00072546 * T * RH * RH 
    - 0.000003582 * T * T * RH * RH;

  return HI;
}

// MQTT Connection
client.on("connect", () => {
  console.log("Connected to MQTT");
  connectionStatus.textContent = "Connected";
  connectionDot.classList.add("active");
  isConnected = true;
  
  // Subscribe to occupancy topic first
  client.subscribe(topicOccupancy, (err) => {
    if (!err) {
      console.log("Subscribed to occupancy topic");
    }
  });
  
  client.subscribe(topicData, (err) => {
    if (!err) {
      console.log("Subscribed to sensor data topic");
    }
  });
  
  updateButtonStates();
});

client.on("error", (err) => {
  console.error("MQTT Error:", err);
});

client.on("offline", () => {
  connectionStatus.textContent = "Offline";
  connectionDot.classList.remove("active");
  isConnected = false;
  updateButtonStates();
});

client.on("message", (topic, message) => {
  if (topic === topicData) {
    try {
      const data = JSON.parse(message.toString());
      
      // Update current status with new data (only if values exist)
      if (data.mode) currentStatus.mode = data.mode;
      if (data.fan_status) currentStatus.fan_status = data.fan_status;
      if (data.vent_status) currentStatus.vent_status = data.vent_status;
      if (data.air_purifier_status) currentStatus.air_purifier_status = data.air_purifier_status;
      if (data.ac_status) currentStatus.ac_status = data.ac_status;
      
      updateDashboard(data);
      updateButtonStates();
    } catch (e) {
      console.error("Error parsing MQTT message:", e);
    }
  } else if (topic === topicOccupancy) {
    try {
      const occupancy = parseInt(message.toString(), 10);
      if (!isNaN(occupancy)) {
        const previousOccupancy = currentStatus.occupancy;
        currentStatus.occupancy = occupancy;
        occupancyEl.textContent = occupancy.toString();
        
        // Handle mode changes based on occupancy
        if (occupancy <= 0) {
          // Switch to disabled mode if occupancy is 0
          if (currentStatus.mode !== "disabled") {
            switchToDisabledMode();
          }
        } else {
          // If coming from disabled mode (occupancy was 0 and now positive)
          if (previousOccupancy <= 0 && currentStatus.mode === "disabled") {
            switchToAutoMode();
          }
        }
      }
    } catch (e) {
      console.error("Error processing occupancy message:", e);
    }
  }
});

// Chart Setup (unchanged from your original code)
const MAX_POINTS = 20;
const tempChart = createLineChart("tempChart", "Temperature (°C)", "#f43f5e");
const humidityChart = createLineChart("humidityChart", "Humidity (%)", "#06b6d4");
const co2Chart = createLineChart("co2Chart", "Air Quality (ppm)", "#8b5cf6");
const feelsChart = createLineChart("feelsLikeChart", "Feels Like (°C)", "#facc15");

function createLineChart(id, label, borderColor) {
  const ctx = document.getElementById(id).getContext("2d");
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label,
        borderColor,
        backgroundColor: `${borderColor}20`, // Semi-transparent background
        borderWidth: 3,
        data: [],
        pointRadius: 4,
        pointBackgroundColor: borderColor,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        tension: 0.4, // Smooth curves
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 750,
        easing: 'easeInOutQuart'
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: "#334155",
            borderDash: [5, 5]
          },
          ticks: { 
            color: "#94a3b8",
            font: {
              family: "'Inter', sans-serif",
              size: 11
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: { 
            color: "#94a3b8",
            font: {
              family: "'Inter', sans-serif",
              size: 11
            },
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        legend: {
          labels: { 
            color: "#f8fafc",
            font: {
              family: "'Inter', sans-serif",
              size: 12,
              weight: 500
            },
            padding: 15
          }
        },
        tooltip: {
          backgroundColor: "rgba(17, 24, 39, 0.8)",
          titleFont: {
            family: "'Inter', sans-serif",
            size: 13
          },
          bodyFont: {
            family: "'Inter', sans-serif",
            size: 12
          },
          padding: 12,
          borderColor: "rgba(148, 163, 184, 0.2)",
          borderWidth: 1,
          displayColors: false
        }
      }
    }
  });
}

function addToChart(chart, value) {
  if (value === undefined || isNaN(value)) return;
  
  const timestamp = new Date().toLocaleTimeString();
  chart.data.labels.push(timestamp);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

function updateDashboard(data) {
  // Update sensor values only if they exist
  if (data.temperature !== undefined) {
    addToChart(tempChart, data.temperature);
    tempEl.textContent = data.temperature.toFixed(1);
  }
  
  if (data.humidity !== undefined) {
    addToChart(humidityChart, data.humidity);
    humidityEl.textContent = data.humidity.toFixed(1);
  }

  if (data.temperature !== undefined && data.humidity !== undefined) {
    const feelsLikeTemp = calculateHeatIndex(data.temperature, data.humidity);
    addToChart(feelsChart, feelsLikeTemp);
    feelsLikeEl.textContent = feelsLikeTemp.toFixed(1);
  }

  if (data.air_quality !== undefined) {
    addToChart(co2Chart, data.air_quality);
    co2El.textContent = data.air_quality;
  }

  // Update device status displays
  updateStatus(fanStatus, fanDot, data.fan_status || currentStatus.fan_status || "off");
  updateStatus(acStatus, acDot, data.ac_status || currentStatus.ac_status || "off");
  updateStatus(airPurifierStatus, purifierDot, data.air_purifier_status || currentStatus.air_purifier_status || "off");
  updateStatus(ventStatus, ventDot, data.vent_status || currentStatus.vent_status || "closed");

  // Update mode switches only if mode is provided
  if (data.mode !== undefined) {
    autoCheck.checked = data.mode === "auto";
    manualCheck.checked = data.mode === "manual";
    disabledCheck.checked = data.mode === "disabled";
  }

  updateButtonStates();
}

function switchToDisabledMode() {
  if (!isConnected) return;

  console.log("Switching to disabled mode due to zero occupancy");
  
  // Turn off all devices
  publishControl({
    mode: "disabled",
    fan: "off",
    vent: "closed",
    air_purifier: "off",
    ac: "off"
  });

  // Update UI immediately
  currentStatus = {
    ...currentStatus,
    mode: "disabled",
    fan_status: "off",
    vent_status: "closed",
    air_purifier_status: "off",
    ac_status: "off"
  };

  updateDashboard(currentStatus);
}

function switchToAutoMode() {
  if (!isConnected) return;

  console.log("Switching to auto mode due to positive occupancy");
  
  publishControl({
    mode: "auto",
    fan: "off",
    vent: "closed",
    air_purifier: "off",
    ac: "off"
  });

  // Update UI immediately
  currentStatus.mode = "auto";
  autoCheck.checked = true;
  manualCheck.checked = false;
  disabledCheck.checked = false;
  
  updateDashboard(currentStatus);
}

function updateStatus(el, dot, state) {
  const normalizedState = state.toLowerCase();
  el.textContent = normalizedState;
  if (normalizedState === "on" || normalizedState === "open") {
    dot.classList.add("active");
  } else {
    dot.classList.remove("active");
  }
}

function updateButtonStates() {
  const buttons = [acBtn, fanBtn, purifierBtn, ventBtn];
  const modeChecks = [autoCheck, manualCheck, disabledCheck];
  
  if (!isConnected) {
    // Disable all buttons when not connected
    buttons.forEach(btn => btn.disabled = true);
    modeChecks.forEach(check => check.disabled = true);
    return;
  }
  
  // Enable mode switches when connected
  modeChecks.forEach(check => check.disabled = false);
  
  if (currentStatus.mode === null) {
    // Still waiting for first MQTT message
    buttons.forEach(btn => btn.disabled = true);
    modeChecks.forEach(check => check.disabled = true);
  } else if (currentStatus.mode === "disabled") {
    // Disable all device buttons in disabled mode
    buttons.forEach(btn => btn.disabled = true);
  } else if (currentStatus.mode === "auto") {
    // Disable device buttons in auto mode
    buttons.forEach(btn => btn.disabled = true);
  } else if (currentStatus.mode === "manual") {
    // Enable device buttons in manual mode
    buttons.forEach(btn => btn.disabled = false);
  }
}

// Mode toggling with confirmation
autoCheck.addEventListener("change", (e) => {
  if (!isConnected || currentStatus.mode === null) {
    e.target.checked = !e.target.checked;
    return;
  }

  if (currentStatus.mode === "auto") {
    e.target.checked = true;
    return;
  }

  const confirmed = confirm("Switch to Auto mode? This will disable manual control.");
  if (confirmed) {
    manualCheck.checked = false;
    disabledCheck.checked = false;
    publishControl({ mode: "auto" });
    updateButtonStates();
  } else {
    e.target.checked = false;
  }
});

manualCheck.addEventListener("change", (e) => {
  if (!isConnected || currentStatus.mode === null) {
    e.target.checked = !e.target.checked;
    return;
  }

  if (currentStatus.mode === "manual") {
    e.target.checked = true;
    return;
  }

  const confirmed = confirm("Switch to Manual mode? You will need to control devices manually.");
  if (confirmed) {
    autoCheck.checked = false;
    disabledCheck.checked = false;
    publishControl({
      mode: "manual",
      fan: currentStatus.fan_status || "off",
      vent: currentStatus.vent_status || "closed",
      air_purifier: currentStatus.air_purifier_status || "off",
      ac: currentStatus.ac_status || "off"
    });
    updateButtonStates();
  } else {
    e.target.checked = false;
  }
});

disabledCheck.addEventListener("change", (e) => {
  if (!isConnected || currentStatus.mode === null) {
    e.target.checked = !e.target.checked;
    return;
  }

  if (currentStatus.mode === "disabled") {
    e.target.checked = true;
    return;
  }

  const confirmed = confirm("Switch to Disabled mode? This will turn off all devices.");
  if (confirmed) {
    autoCheck.checked = false;
    manualCheck.checked = false;
    switchToDisabledMode();
  } else {
    e.target.checked = false;
  }
});

function toggleDevice(device) {
  if (!isConnected || currentStatus.mode !== "manual") return;

  const newState = {
    mode: "manual",
    fan: currentStatus.fan_status || "off",
    vent: currentStatus.vent_status || "closed",
    air_purifier: currentStatus.air_purifier_status || "off",
    ac: currentStatus.ac_status || "off"
  };

  // Toggle the specific device
  switch (device) {
    case "fan":
      newState.fan = currentStatus.fan_status === "on" ? "off" : "on";
      break;
    case "ac":
      newState.ac = currentStatus.ac_status === "on" ? "off" : "on";
      break;
    case "airPurifier":
      newState.air_purifier = currentStatus.air_purifier_status === "on" ? "off" : "on";
      break;
    case "vent":
      newState.vent = currentStatus.vent_status === "open" ? "closed" : "open";
      break;
  }

  // Immediately update local state for responsive UI
  currentStatus = {
    ...currentStatus,
    [device === 'vent' ? 'vent_status' : 
     device === 'airPurifier' ? 'air_purifier_status' :
     device === 'ac' ? 'ac_status' : 'fan_status']: 
     newState[device === 'vent' ? 'vent' :
      device === 'airPurifier' ? 'air_purifier' :
      device === 'ac' ? 'ac' : 'fan']
  };

  // Update UI immediately
  updateDashboard(currentStatus);
  
  // Send command to ESP32
  publishControl(newState);
}

function publishControl(update) {
  if (isConnected) {
    console.log("Publishing control message:", update);
    client.publish(topicControl, JSON.stringify(update));
  }
}

window.toggleDevice = toggleDevice;