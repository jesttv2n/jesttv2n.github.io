/**
 * Controller for the candidates control panel
 */

// System state
const state = {
  displayWindow: null,
  activeKommuneId: "851", // Aalborg as default
  visningsUrl: "valgte-kandidater-opdateret.html",
  sortAlphabetically: true,
  lastData: null,
  kommuneData: null, // To hold data from first endpoint
  updateInterval: null,
  autoUpdateEnabled: true,
  autoUpdateSeconds: 30,
};

/**
 * Initialize the control panel
 */
function initialize() {
  document.addEventListener("DOMContentLoaded", () => {
    // Initialize municipality buttons
    initializeKommuneButtons();
    setAktivKommune(state.activeKommuneId);

    // Main functions
    el("btnOpenDisplay").addEventListener("click", openDisplayWindow);
    el("btnRefreshData").addEventListener("click", handleManualDataRefresh);
    el("btnBurn").addEventListener("click", burnData);
    el("btnCasparCG").addEventListener("click", sendToCasparCG);
    el("btnCloseDisplay").addEventListener("click", closeDisplayWindow);

    // Helper functions
    el("btnRefreshKommuner").addEventListener("click", handleRefreshKommuner);
    el("btnSortKommuner").addEventListener("click", toggleSorting);
    el("btnClearLog").addEventListener("click", clearLog);
    el("btnFullscreen").addEventListener("click", showFullscreen);

    // Update preview
    el(
      "previewFrame"
    ).src = `../views/${state.visningsUrl}?id=${state.activeKommuneId}`;

    // Update status
    updateStatus(false, "Klar til brug");

    // Log system start
    log("Kandidat-kontrolpanel initialiseret");
  });
}

/**
 * Initialize municipality buttons
 */
function initializeKommuneButtons() {
  const kommuneButtonsEl = el("kommuneButtons");
  kommuneButtonsEl.innerHTML = "";

  // Sort municipalities as needed
  const sortedKommuner = [...kommuner].sort((a, b) => {
    if (state.sortAlphabetically) {
      return a.navn.localeCompare(b.navn);
    } else {
      return a.id - b.id; // Numeric sorting
    }
  });

  sortedKommuner.forEach((kommune) => {
    const button = document.createElement("button");
    button.textContent = kommune.navn;
    button.dataset.id = kommune.id;
    button.addEventListener("click", () => {
      setAktivKommune(kommune.id);
    });

    if (kommune.id === state.activeKommuneId) {
      button.classList.add("active");
    }

    kommuneButtonsEl.appendChild(button);
  });
}

/**
 * Set active municipality
 * @param {string} id - Municipality ID
 */
function setAktivKommune(id) {
  state.activeKommuneId = id;
  const kommune = getKommune(id) || { navn: "Ukendt" };

  // Update UI
  document.querySelectorAll("#kommuneButtons button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });

  // Update info panel
  el("currentKommune").textContent = kommune.navn;
  el("lastUpdate").textContent = new Date().toLocaleTimeString();

  // Reset data
  state.lastData = null;
  state.kommuneData = null;

  // Update preview
  const url = `../views/${state.visningsUrl}?id=${id}`;
  el("previewFrame").src = url;

  // Update display if open
  if (state.displayWindow && !state.displayWindow.closed) {
    state.displayWindow.postMessage(
      {
        action: "skiftKommune",
        kommuneId: id,
      },
      "*"
    );

    updateStatus(true, `Viser ${kommune.navn}`);
  }

  // Log action
  log(`Skiftet til ${kommune.navn} (ID: ${id})`);
}

/**
 * Fetch municipality data from results endpoint
 */
async function fetchKommuneData() {
  try {
    const data = await fetchElectionResults(state.activeKommuneId);
    state.kommuneData = data;
    return data;
  } catch (error) {
    log(`Fejl ved hentning af kommunedata: ${error.message}`, "error");
    return null;
  }
}

/**
 * Fetch data from API and update displays
 */
async function fetchAndUpdateData() {
  try {
    // First, fetch municipality data
    await fetchKommuneData();

    log(`Henter kandidatdata for kommune ${state.activeKommuneId}...`);

    const data = await fetchCandidateData(state.activeKommuneId);
    state.lastData = data;

    // Update info panel
    if (data.elected) {
      // Update number of candidates
      const antalKandidater = data.elected.flatMap((p) => p.candidates).length;
      el("antalKandidater").textContent = antalKandidater;
    }

    // Update number of seats
    if (state.kommuneData?.result?.seats) {
      el("antalMandater").textContent = state.kommuneData.result.seats;
    }

    // Update timestamp
    if (data.lastUpdated) {
      const dato = new Date(data.lastUpdated);
      el("lastUpdate").textContent = dato.toLocaleTimeString("da-DK");
    }

    // Send data to display window if open
    if (state.displayWindow && !state.displayWindow.closed) {
      state.displayWindow.postMessage(
        {
          action: "opdaterData",
          payload: data,
        },
        "*"
      );
    }

    const kommune = getKommune(state.activeKommuneId) || { navn: "Ukendt" };
    log(`Data opdateret for ${kommune.navn}`);
    return data;
  } catch (error) {
    log(`Fejl ved hentning af data: ${error.message}`, "error");
    return null;
  }
}

/**
 * Direct update of data (burning)
 */
async function burnData() {
  try {
    log("Henter opdateret data til brændemærkning...");
    const data = await fetchAndUpdateData();

    if (!data) {
      throw new Error("Kunne ikke hente data");
    }

    // Send specifically to display window with burning
    if (state.displayWindow && !state.displayWindow.closed) {
      state.displayWindow.postMessage(
        {
          action: "opdaterData",
          payload: data,
        },
        "*"
      );

      log("Data brændemærket til visningen");
      el("lastUpdate").textContent =
        new Date().toLocaleTimeString() + " (brændt)";
    } else {
      log("Visningsvindue er ikke åbent!", "error");
      alert("Visningsvindue er ikke åbent!");
    }
  } catch (error) {
    log(`Fejl ved brændemærkning: ${error.message}`, "error");
  }
}

/**
 * Open display window
 */
function openDisplayWindow() {
  // Close existing window if open
  if (state.displayWindow && !state.displayWindow.closed) {
    state.displayWindow.close();
  }

  const url = `../views/${state.visningsUrl}?id=${state.activeKommuneId}`;

  // Open new window in fullscreen
  state.displayWindow = window.open(
    url,
    "ValgteKandidater",
    "menubar=0,toolbar=0,location=0,status=0,fullscreen=1"
  );

  if (state.displayWindow) {
    // Update status
    const kommune = getKommune(state.activeKommuneId) || { navn: "Ukendt" };
    updateStatus(true, `Viser ${kommune.navn}`);

    // Log action
    log(`Visningsvindue åbnet med ${kommune.navn}`);

    // Set up automatic update
    if (state.updateInterval) {
      clearInterval(state.updateInterval);
    }

    if (state.autoUpdateEnabled) {
      state.updateInterval = setInterval(
        fetchAndUpdateData,
        state.autoUpdateSeconds * 1000
      );
      log(`Auto-opdatering aktiveret (hver ${state.autoUpdateSeconds} sek)`);
    }

    // Listen for window closure
    const checkWindowClosed = setInterval(() => {
      if (state.displayWindow.closed) {
        updateStatus(false, "Visning lukket");
        log("Visningsvindue lukket");
        clearInterval(checkWindowClosed);

        if (state.updateInterval) {
          clearInterval(state.updateInterval);
          state.updateInterval = null;
        }
      }
    }, 1000);
  } else {
    log("Kunne ikke åbne visningsvindue. Tjek pop-up blocker.", "error");
    alert(
      "Kunne ikke åbne visningsvindue. Kontrollér at pop-up blocker er deaktiveret."
    );
    updateStatus(false, "Fejl ved åbning");
  }
}

/**
 * Close display window
 */
function closeDisplayWindow() {
  if (state.displayWindow && !state.displayWindow.closed) {
    state.displayWindow.close();
    log("Visningsvindue lukket manuelt");

    if (state.updateInterval) {
      clearInterval(state.updateInterval);
      state.updateInterval = null;
    }

    updateStatus(false, "Visning lukket");
  } else {
    log("Intet aktivt visningsvindue at lukke");
  }
}

/**
 * Send message to CasparCG (simulated)
 */
function sendToCasparCG() {
  const kommune = getKommune(state.activeKommuneId) || { navn: "Ukendt" };
  const host = el("casparHost").value || "127.0.0.1";
  const port = el("casparPort").value || "5250";
  const channel = el("casparChannel").value || "1";

  // Log command
  log(
    `Sender til CasparCG (${host}:${port}): Viser ${kommune.navn} kandidater på kanal ${channel}`
  );

  // Here you would implement the actual CasparCG communication
  // Example of how to send an AMCP command to CasparCG:
  /*
    const template = 'kandidater_template';
    const casparCommand = `CG ${channel} ADD 1 "${template}" 1 "<templateData><kommune>${kommune.navn}</kommune><kommuneId>${state.activeKommuneId}</kommuneId></templateData>"`;
    
    // Use WebSocket or HTTP to send the command to the CasparCG server
    const ws = new WebSocket(`ws://${host}:${port}`);
    ws.onopen = () => {
      ws.send(casparCommand);
      ws.close();
    };
    */

  // Simulated success message
  setTimeout(() => {
    log(
      `CasparCG bekræftede: Viser ${kommune.navn} kandidater på kanal ${channel}`
    );
  }, 500);
}

/**
 * Toggle sorting order for municipality buttons
 */
function toggleSorting() {
  state.sortAlphabetically = !state.sortAlphabetically;
  initializeKommuneButtons();
  log(
    `Kommuner sorteret ${state.sortAlphabetically ? "alfabetisk" : "efter ID"}`
  );
}

/**
 * Update status indicator
 * @param {boolean} isOnline - Whether display is online
 * @param {string} statusMessage - Status message
 */
function updateStatus(isOnline, statusMessage) {
  const statusIndicator = el("statusIndicator");
  const statusText = el("statusText");

  statusIndicator.className = `status-indicator ${
    isOnline ? "status-online" : "status-offline"
  }`;
  statusText.textContent = statusMessage;
}

/**
 * Handle manual data refresh
 */
async function handleManualDataRefresh() {
  log("Manuel opdatering af data påbegyndt");
  await fetchAndUpdateData();
  log("Manuel opdatering fuldført");
}

/**
 * Handle refresh municipalities
 */
function handleRefreshKommuner() {
  initializeKommuneButtons();
  log("Opdaterede kommuneliste");
}

/**
 * Clear log
 */
function clearLog() {
  el("logContainer").innerHTML = "";
  log("Log ryddet");
}

/**
 * Show preview in fullscreen
 */
function showFullscreen() {
  const iframe = el("previewFrame");
  if (iframe.requestFullscreen) {
    iframe.requestFullscreen();
  }
}

// Initialize the controller
initialize();
