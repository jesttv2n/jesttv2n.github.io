/**
 * Controller for the polling station control panel
 */

// System state
const state = {
  displayWindow: null,
  activeKommuneId: "851", // Aalborg as default
  activeValgstedId: "85103", // Løvvanghallen
  activeValgstedNavn: "Løvvanghallen",
  visningsUrl: "valgsteder-resultater.html",
  sortAlphabetically: true,
  lastData: null,
  updateInterval: null,
  autoUpdateEnabled: true,
  autoUpdateSeconds: 30,
};

/**
 * Initialize the control panel
 */
function initialize() {
  document.addEventListener("DOMContentLoaded", () => {
    // Setup tabs
    setupTabs();

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
    el("btnRefreshValgsteder").addEventListener(
      "click",
      handleRefreshValgsteder
    );
    el("btnSortKommuner").addEventListener("click", toggleSorting);
    el("btnClearLog").addEventListener("click", clearLog);
    el("btnFullscreen").addEventListener("click", showFullscreen);

    // Update preview
    el(
      "previewFrame"
    ).src = `${state.visningsUrl}?kommune=${state.activeKommuneId}&valgsted=${state.activeValgstedId}`;

    // Update status
    updateStatus(false, "Klar til brug");

    // Log system start
    log("Valgsteder-kontrolpanel initialiseret");
  });
}

/**
 * Set up tab functionality
 */
function setupTabs() {
  el("tabSystematic").addEventListener("click", () => {
    el("tabSystematic").classList.add("active");
    el("tabSearch").classList.remove("active");
    el("systematicContent").style.display = "block";
    el("searchContent").style.display = "none";
  });

  el("tabSearch").addEventListener("click", () => {
    el("tabSearch").classList.add("active");
    el("tabSystematic").classList.remove("active");
    el("systematicContent").style.display = "none";
    el("searchContent").style.display = "block";
    el("searchInput").focus();
  });

  // Set up search function
  el("searchInput").addEventListener("input", (e) => {
    updateValgstedListe(e.target.value);
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
 * Initialize polling station buttons for the active municipality
 */
function initializeValgstedButtons() {
  const valgstedButtonsEl = el("valgstedButtons");
  valgstedButtonsEl.innerHTML = "";

  const kommuneValgsteder = getValgstederForKommune(state.activeKommuneId);

  if (kommuneValgsteder.length === 0) {
    valgstedButtonsEl.innerHTML =
      '<div class="empty-state">Ingen valgsteder fundet for denne kommune.</div>';
    return;
  }

  kommuneValgsteder.forEach((valgsted) => {
    const button = document.createElement("button");
    button.textContent = valgsted.navn;
    button.dataset.id = valgsted.id;
    button.addEventListener("click", () => {
      setAktivValgsted(valgsted.id, valgsted.navn);
    });

    if (valgsted.id === state.activeValgstedId) {
      button.classList.add("active");
    }

    valgstedButtonsEl.appendChild(button);
  });
}

/**
 * Update the polling station list based on search
 * @param {string} searchTerm - Search term
 */
function updateValgstedListe(searchTerm = "") {
  const valgstedListeEl = el("valgstedListe");
  valgstedListeEl.innerHTML = "";

  const kommuneValgsteder = getValgstederForKommune(state.activeKommuneId);

  if (kommuneValgsteder.length === 0) {
    valgstedListeEl.innerHTML =
      '<div class="empty-state">Ingen valgsteder fundet for denne kommune.</div>';
    return;
  }

  // Filter polling stations based on search term
  const filteredValgsteder = searchTerm
    ? kommuneValgsteder.filter((v) =>
        v.navn.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : kommuneValgsteder;

  if (filteredValgsteder.length === 0) {
    valgstedListeEl.innerHTML =
      '<div class="empty-state">Ingen valgsteder matcher søgningen.</div>';
    return;
  }

  filteredValgsteder.forEach((valgsted) => {
    const item = document.createElement("div");
    item.className = "valgsted-item";
    item.textContent = valgsted.navn;

    if (valgsted.id === state.activeValgstedId) {
      item.classList.add("active");
    }

    item.addEventListener("click", () => {
      setAktivValgsted(valgsted.id, valgsted.navn);

      // Update active polling stations in the list
      document.querySelectorAll(".valgsted-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.id === valgsted.id);
      });
    });

    item.dataset.id = valgsted.id;
    valgstedListeEl.appendChild(item);
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

  // Update polling stations for the selected municipality
  initializeValgstedButtons();
  updateValgstedListe();

  // Set the first polling station as active if there are any
  const kommuneValgsteder = getValgstederForKommune(id);
  if (kommuneValgsteder.length > 0) {
    setAktivValgsted(kommuneValgsteder[0].id, kommuneValgsteder[0].navn);
  } else {
    // If there are no polling stations, reset active polling station
    state.activeValgstedId = "";
    state.activeValgstedNavn = "";
    el("currentValgsted").textContent = "Ingen valgsteder";
  }

  // Log action
  log(`Skiftet til ${kommune.navn} (ID: ${id})`);
}

/**
 * Set active polling station
 * @param {string} id - Polling station ID
 * @param {string} navn - Polling station name
 */
function setAktivValgsted(id, navn) {
  state.activeValgstedId = id;
  state.activeValgstedNavn = navn;

  // Update UI - polling station buttons
  document.querySelectorAll("#valgstedButtons button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });

  // Update UI - polling station list
  document.querySelectorAll(".valgsted-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.id === id);
  });

  // Update info panel
  el("currentValgsted").textContent = navn;
  el("lastUpdate").textContent = new Date().toLocaleTimeString();

  // Update preview
  const url = `${state.visningsUrl}?kommune=${state.activeKommuneId}&valgsted=${id}`;
  el("previewFrame").src = url;

  // Update display if open
  if (state.displayWindow && !state.displayWindow.closed) {
    state.displayWindow.postMessage(
      {
        action: "skiftValgsted",
        kommuneId: state.activeKommuneId,
        valgstedId: id,
        valgstedNavn: navn,
      },
      "*"
    );

    const kommune = getKommune(state.activeKommuneId) || { navn: "Ukendt" };
    updateStatus(true, `Viser ${kommune.navn} - ${navn}`);
  }

  // Log action
  log(`Skiftet til valgsted: ${navn} (ID: ${id})`);
}

/**
 * Fetch data from API and update displays
 */
async function fetchAndUpdateData() {
  try {
    log(
      `Henter valgsteddata for Kommune: ${state.activeKommuneId}, Valgsted: ${state.activeValgstedId}...`
    );

    const data = await fetchPollingStationResults(
      state.activeKommuneId,
      state.activeValgstedId
    );
    state.lastData = data;

    // Update info panel
    if (data.result) {
      // Update number of votes
      const validVotes = data.result.validVotes || 0;
      const blankVotes = data.result.blankVotes || 0;
      const invalidVotes = data.result.invalidVotes || 0;
      const totalVotes = validVotes + blankVotes + invalidVotes;

      el("antalStemmer").textContent = `${formatNumber(
        totalVotes
      )} (${formatNumber(validVotes)} gyldige)`;
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

    log(`Data opdateret for valgsted ${state.activeValgstedNavn}`);
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

  const url = `${state.visningsUrl}?kommune=${state.activeKommuneId}&valgsted=${state.activeValgstedId}`;

  // Open new window in fullscreen
  state.displayWindow = window.open(
    url,
    "ValgstedResultater",
    "menubar=0,toolbar=0,location=0,status=0,fullscreen=1"
  );

  if (state.displayWindow) {
    // Update status
    const kommune = getKommune(state.activeKommuneId) || { navn: "Ukendt" };
    updateStatus(true, `Viser ${kommune.navn} - ${state.activeValgstedNavn}`);

    // Log action
    log(
      `Visningsvindue åbnet med ${kommune.navn} - ${state.activeValgstedNavn}`
    );

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
    `Sender til CasparCG (${host}:${port}): Viser ${kommune.navn} - ${state.activeValgstedNavn} resultater på kanal ${channel}`
  );

  // Here you would implement the actual CasparCG communication
  // Example of how to send an AMCP command to CasparCG:
  /*
    const template = 'valgsteder_resultater_template';
    const casparCommand = `CG ${channel} ADD 1 "${template}" 1 "<templateData><kommune>${kommune.navn}</kommune><kommuneId>${state.activeKommuneId}</kommuneId><valgsted>${state.activeValgstedNavn}</valgsted><valgstedId>${state.activeValgstedId}</valgstedId></templateData>"`;
    
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
      `CasparCG bekræftede: Viser ${kommune.navn} - ${state.activeValgstedNavn} resultater på kanal ${channel}`
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
 * Handle refresh polling stations
 */
function handleRefreshValgsteder() {
  initializeValgstedButtons();
  updateValgstedListe(el("searchInput").value);
  log("Opdaterede valgstedsliste");
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
