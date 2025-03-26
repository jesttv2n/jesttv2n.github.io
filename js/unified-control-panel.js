panelState.candidatesKommuneId = id;
  const kommune = getKommune(id) || { navn: "Ukendt" };

  // Update UI
  document.querySelectorAll("#kommuneButtonsCand button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });

  // Reset data
  panelState.candidatesData = null;

  // Update info panel if candidates tab is active
  if (panelState.activeTab === "candidates") {
    const currentKommuneEl = safeEl("currentKommune");
    const currentValgstedEl = safeEl("currentValgsted");
    const lastUpdateEl = safeEl("lastUpdate");
    
    if (currentKommuneEl) currentKommuneEl.textContent = kommune.navn;
    if (currentValgstedEl) currentValgstedEl.textContent = "-";
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString();
  }

  // Update preview if candidates tab is active
  if (panelState.activeTab === "candidates") {
    updatePreviewFrames();
  }

  // Log action
  log(`Skiftet til ${kommune.navn} (ID: ${id}) for kandidater`);


/**
 * Set kommune for polling station view
 */
function setKommunePollingStation(id) {
  panelState.pollingStationKommuneId = id;
  const kommune = getKommune(id) || { navn: "Ukendt" };

  // Update UI
  document.querySelectorAll("#kommuneButtonsPS button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });

  // Reset data
  panelState.pollingStationData = null;

  // Update polling station buttons
  initializeValgstedButtons();

  // Update info panel if polling station tab is active
  if (panelState.activeTab === "polling-station") {
    const currentKommuneEl = safeEl("currentKommune");
    const lastUpdateEl = safeEl("lastUpdate");
    
    if (currentKommuneEl) currentKommuneEl.textContent = kommune.navn;
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString();
  }

  // Update preview if polling station tab is active
  if (panelState.activeTab === "polling-station") {
    updatePreviewFrames();
  }

  // Log action
  log(`Skiftet til ${kommune.navn} (ID: ${id}) for valgsteder`);
}

/**
 * Set valgsted for polling station view
 */
function setValgsted(id, navn) {
  panelState.pollingStationValgstedId = id;
  panelState.pollingStationData = null;

  // Update UI
  document.querySelectorAll("#valgstedButtons button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });

  // Update info panel if polling station tab is active
  if (panelState.activeTab === "polling-station") {
    const currentValgstedEl = safeEl("currentValgsted");
    const lastUpdateEl = safeEl("lastUpdate");
    
    if (currentValgstedEl) currentValgstedEl.textContent = navn;
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString();
  }

  // Update preview
  if (panelState.activeTab === "polling-station") {
    updatePreviewFrames();
  }

  // Log action
  log(`Skiftet til valgsted ${navn} (ID: ${id})`);
}

/**
 * Update preview frames based on active tab
 */
function updatePreviewFrames() {
  let previewUrl;
  
  // Set active view type in info panel
  const activeViewTypeEl = safeEl("activeViewType");
  
  if (activeViewTypeEl) {
    if (!window.universalViewState) {
      activeViewTypeEl.textContent = "Ingen";
    } else {
      switch(panelState.activeTab) {
        case "results":
          activeViewTypeEl.textContent = universalViewState.activeViewType === "results" ? 
            "Valgresultater" : universalViewState.activeViewType ? 
            getViewTypeName(universalViewState.activeViewType) : "Ingen";
          
          previewUrl = `views/forbedret-valgresultater.html?id=${panelState.resultsKommuneId}`;
          break;
          
        case "candidates":
          activeViewTypeEl.textContent = universalViewState.activeViewType === "candidates" ? 
            "Valgte kandidater" : universalViewState.activeViewType ? 
            getViewTypeName(universalViewState.activeViewType) : "Ingen";
            
          previewUrl = `views/valgte-kandidater-opdateret.html?id=${panelState.candidatesKommuneId}`;
          break;
          
        case "polling-station":
          activeViewTypeEl.textContent = universalViewState.activeViewType === "polling-station" ? 
            "Valgstedresultater" : universalViewState.activeViewType ? 
            getViewTypeName(universalViewState.activeViewType) : "Ingen";
            
          previewUrl = `views/valgsteder-resultater.html?kommune=${panelState.pollingStationKommuneId}&valgsted=${panelState.pollingStationValgstedId}`;
          break;
      }
    }
  }
  
  // Update preview frame
  const previewFrameEl = safeEl("previewFrame");
  if (previewFrameEl && previewUrl) {
    previewFrameEl.src = previewUrl;
  }
  
  // Update live frame if display is open
  const liveFrameEl = safeEl("liveFrame");
  if (liveFrameEl && window.universalViewState && universalViewState.displayWindow && !universalViewState.displayWindow.closed) {
    // Only update live frame when we have a prepared/active view
    if (universalViewState.activeViewType) {
      liveFrameEl.src = `views/universal-view.html?view=${universalViewState.activeViewType}&id=${universalViewState.activeParams?.id || universalViewState.activeParams?.kommune || ""}`;
    }
  }
}

/**
 * Fetch and prepare results view
 */
async function prepareResultsView() {
  try {
    log(`Henter valgdata for kommune ${panelState.resultsKommuneId}...`);
    
    // Fetch election results
    const data = await fetchElectionResults(panelState.resultsKommuneId);
    panelState.resultsData = data;
    
    // Update timestamp
    const lastUpdateEl = safeEl("lastUpdate");
    if (lastUpdateEl && data.lastUpdated) {
      const dato = new Date(data.lastUpdated);
      lastUpdateEl.textContent = dato.toLocaleTimeString("da-DK");
    }
    
    // Check if universal controller is loaded
    if (!window.prepareView) {
      log("Fejl: Universal controller er ikke indlæst korrekt", "error");
      return false;
    }
    
    // Prepare the view in the universal display
    const params = {
      id: panelState.resultsKommuneId
    };
    
    const success = prepareView("results", params, data);
    
    if (success) {
      // Enable take buttons
      enableTakeButtons();
      
      // Update prep info
      const kommune = getKommune(panelState.resultsKommuneId) || { navn: "Ukendt" };
      const prepInfoEl = safeEl("prepInfo");
      if (prepInfoEl) {
        prepInfoEl.textContent = `Forberedt: Valgresultater - ${kommune.navn}`;
      }
      
      log(`Valgresultater for ${kommune.navn} forberedt og klar til visning`);
    }
    
    return data;
  } catch (error) {
    log(`Fejl ved hentning af valgdata: ${error.message}`, "error");
    return null;
  }
}

/**
 * Fetch and prepare candidates view
 */
async function prepareCandidatesView() {
  try {
    log(`Henter kandidatdata for kommune ${panelState.candidatesKommuneId}...`);
    
    // Fetch candidate data
    const data = await fetchCandidateData(panelState.candidatesKommuneId);
    panelState.candidatesData = data;
    
    // Update timestamp
    const lastUpdateEl = safeEl("lastUpdate");
    if (lastUpdateEl && data.lastUpdated) {
      const dato = new Date(data.lastUpdated);
      lastUpdateEl.textContent = dato.toLocaleTimeString("da-DK");
    }
    
    // Check if universal controller is loaded
    if (!window.prepareView) {
      log("Fejl: Universal controller er ikke indlæst korrekt", "error");
      return false;
    }
    
    // Prepare the view in the universal display
    const params = {
      id: panelState.candidatesKommuneId
    };
    
    const success = prepareView("candidates", params, data);
    
    if (success) {
      // Enable take buttons
      enableTakeButtons();
      
      // Update prep info
      const kommune = getKommune(panelState.candidatesKommuneId) || { navn: "Ukendt" };
      const prepInfoEl = safeEl("prepInfo");
      if (prepInfoEl) {
        prepInfoEl.textContent = `Forberedt: Valgte kandidater - ${kommune.navn}`;
      }
      
      log(`Kandidatvisning for ${kommune.navn} forberedt og klar til visning`);
    }
    
    return data;
  } catch (error) {
    log(`Fejl ved hentning af kandidatdata: ${error.message}`, "error");
    return null;
  }
}

/**
 * Fetch and prepare polling station view
 */
async function preparePollingStationView() {
  try {
    log(`Henter valgstedsdata for kommune ${panelState.pollingStationKommuneId}, valgsted ${panelState.pollingStationValgstedId}...`);
    
    // Fetch polling station data
    const data = await fetchPollingStationResults(panelState.pollingStationKommuneId, panelState.pollingStationValgstedId);
    panelState.pollingStationData = data;
    
    // Update timestamp
    const lastUpdateEl = safeEl("lastUpdate");
    if (lastUpdateEl && data.lastUpdated) {
      const dato = new Date(data.lastUpdated);
      lastUpdateEl.textContent = dato.toLocaleTimeString("da-DK");
    }
    
    // Check if universal controller is loaded
    if (!window.prepareView) {
      log("Fejl: Universal controller er ikke indlæst korrekt", "error");
      return false;
    }
    
    // Prepare the view in the universal display
    const params = {
      kommune: panelState.pollingStationKommuneId,
      valgsted: panelState.pollingStationValgstedId
    };
    
    const success = prepareView("polling-station", params, data);
    
    if (success) {
      // Enable take buttons
      enableTakeButtons();
      
      // Update prep info
      const kommune = getKommune(panelState.pollingStationKommuneId) || { navn: "Ukendt" };
      const valgstedNavn = getValgstedNavn(panelState.pollingStationKommuneId, panelState.pollingStationValgstedId);
      
      const prepInfoEl = safeEl("prepInfo");
      if (prepInfoEl) {
        prepInfoEl.textContent = `Forberedt: Valgstedsresultater - ${kommune.navn} - ${valgstedNavn}`;
      }
      
      log(`Valgstedsresultater for ${kommune.navn} - ${valgstedNavn} forberedt og klar til visning`);
    }
    
    return data;
  } catch (error) {
    log(`Fejl ved hentning af valgstedsdata: ${error.message}`, "error");
    return null;
  }
}

/**
 * Update results data
 */
async function updateResults() {
  try {
    // Check if universal controller is loaded
    if (!window.universalViewState) {
      log("Fejl: Universal controller er ikke indlæst korrekt", "error");
      return false;
    }
    
    if (universalViewState.activeViewType !== "results") {
      log("Kan ikke opdatere data. Aktiv visning er ikke valgresultater.", "warning");
      return;
    }
    
    log("Opdaterer valgresultater...");
    const data = await fetchElectionResults(panelState.resultsKommuneId);
    panelState.resultsData = data;
    
    // Update view data
    updateViewData(data);
    
    // Update timestamp
    const lastUpdateEl = safeEl("lastUpdate");
    if (lastUpdateEl && data.lastUpdated) {
      const dato = new Date(data.lastUpdated);
      lastUpdateEl.textContent = dato.toLocaleTimeString("da-DK");
    }
    
    log("Valgresultater opdateret");
    return data;
  } catch (error) {
    log(`Fejl ved opdatering af valgresultater: ${error.message}`, "error");
    return null;
  }
}

/**
 * Update candidates data
 */
async function updateCandidates() {
  try {
    // Check if universal controller is loaded
    if (!window.universalViewState) {
      log("Fejl: Universal controller er ikke indlæst korrekt", "error");
      return false;
    }
    
    if (universalViewState.activeViewType !== "candidates") {
      log("Kan ikke opdatere data. Aktiv visning er ikke kandidater.", "warning");
      return;
    }
    
    log("Opdaterer kandidatdata...");
    const data = await fetchCandidateData(panelState.candidatesKommuneId);
    panelState.candidatesData = data;
    
    // Update view data
    updateViewData(data);
    
    // Update timestamp
    const lastUpdateEl = safeEl("lastUpdate");
    if (lastUpdateEl && data.lastUpdated) {
      const dato = new Date(data.lastUpdated);
      lastUpdateEl.textContent = dato.toLocaleTimeString("da-DK");
    }
    
    log("Kandidatdata opdateret");
    return data;
  } catch (error) {
    log(`Fejl ved opdatering af kandidatdata: ${error.message}`, "error");
    return null;
  }
}

/**
 * Update polling station data
 */
async function updatePollingStation() {
  try {
    // Check if universal controller is loaded
    if (!window.universalViewState) {
      log("Fejl: Universal controller er ikke indlæst korrekt", "error");
      return false;
    }
    
    if (universalViewState.activeViewType !== "polling-station") {
      log("Kan ikke opdatere data. Aktiv visning er ikke valgsteder.", "warning");
      return;
    }
    
    log("Opdaterer valgstedsdata...");
    const data = await fetchPollingStationResults(panelState.pollingStationKommuneId, panelState.pollingStationValgstedId);
    panelState.pollingStationData = data;
    
    // Update view data
    updateViewData(data);
    
    // Update timestamp
    const lastUpdateEl = safeEl("lastUpdate");
    if (lastUpdateEl && data.lastUpdated) {
      const dato = new Date(data.lastUpdated);
      lastUpdateEl.textContent = dato.toLocaleTimeString("da-DK");
    }
    
    log("Valgstedsdata opdateret");
    return data;
  } catch (error) {
    log(`Fejl ved opdatering af valgstedsdata: ${error.message}`, "error");
    return null;
  }
}

/**
 * Enable take buttons
 */
function enableTakeButtons() {
  const btnTakeCut = safeEl("btnTakeCut");
  const btnTakeFade = safeEl("btnTakeFade");
  const btnTakeWipe = safeEl("btnTakeWipe");
  const statusIndicator = safeEl("statusIndicator");
  
  if (btnTakeCut) btnTakeCut.disabled = false;
  if (btnTakeFade) btnTakeFade.disabled = false;
  if (btnTakeWipe) btnTakeWipe.disabled = false;
  
  // Update status indicator
  if (statusIndicator) {
    statusIndicator.className = "status-indicator status-prepared";
  }
}

/**
 * Open display window
 */
function openDisplay() {
  // Check if universal controller is loaded
  if (!window.openUniversalDisplay) {
    log("Fejl: Universal controller er ikke indlæst korrekt", "error");
    return false;
  }
  
  // Get initial view based on active tab
  let initialViewType = null;
  let initialParams = null;
  
  switch(panelState.activeTab) {
    case "results":
      initialViewType = "results";
      initialParams = { id: panelState.resultsKommuneId };
      break;
      
    case "candidates":
      initialViewType = "candidates";
      initialParams = { id: panelState.candidatesKommuneId };
      break;
      
    case "polling-station":
      initialViewType = "polling-station";
      initialParams = { 
        kommune: panelState.pollingStationKommuneId,
        valgsted: panelState.pollingStationValgstedId
      };
      break;
  }
  
  // Open the display window
  const success = openUniversalDisplay(initialViewType, initialParams);
  
  if (success) {
    // Update status
    if (window.getViewTypeName) {
      updateStatus(true, `Viser ${getViewTypeName(initialViewType)}`);
    } else {
      updateStatus(true, "Visning åbnet");
    }
    
    // Update live frame
    setTimeout(() => {
      updatePreviewFrames();
    }, 1000);
    
    return true;
  }
  
  return false;
}

/**
 * Close display window
 */
function closeDisplay() {
  // Check if universal controller is loaded
  if (!window.closeUniversalDisplay) {
    log("Fejl: Universal controller er ikke indlæst korrekt", "error");
    return false;
  }
  
  const success = closeUniversalDisplay();
  
  if (success) {
    // Disable take buttons
    const btnTakeCut = safeEl("btnTakeCut");
    const btnTakeFade = safeEl("btnTakeFade");
    const btnTakeWipe = safeEl("btnTakeWipe");
    const prepInfoEl = safeEl("prepInfo");
    const liveFrameEl = safeEl("liveFrame");
    
    if (btnTakeCut) btnTakeCut.disabled = true;
    if (btnTakeFade) btnTakeFade.disabled = true;
    if (btnTakeWipe) btnTakeWipe.disabled = true;
    
    // Update prep info
    if (prepInfoEl) prepInfoEl.textContent = "Ingen forberedt visning";
    
    // Clear live frame
    if (liveFrameEl) liveFrameEl.src = "about:blank";
  }
  
  return success;
}

/**
 * Send to CasparCG (simulated)
 */
function sendToCasparCG() {
  // Check if universal controller is loaded
  if (!window.universalViewState) {
    log("Fejl: Universal controller er ikke indlæst korrekt", "error");
    return false;
  }
  
  // Get current view info
  let viewName = "ingen visning";
  let kommune = "Ingen kommune";
  
  if (universalViewState.activeViewType) {
    if (window.getViewTypeName) {
      viewName = getViewTypeName(universalViewState.activeViewType);
    } else {
      viewName = universalViewState.activeViewType;
    }
    
    // Get kommune name
    if (universalViewState.activeParams?.id) {
      const kommuneObj = getKommune(universalViewState.activeParams.id);
      kommune = kommuneObj ? kommuneObj.navn : "Ukendt kommune";
    } else if (universalViewState.activeParams?.kommune) {
      const kommuneObj = getKommune(universalViewState.activeParams.kommune);
      kommune = kommuneObj ? kommuneObj.navn : "Ukendt kommune";
    }
  }
  
  const host = safeEl("casparHost")?.value || "127.0.0.1";
  const port = safeEl("casparPort")?.value || "5250";
  const channel = safeEl("casparChannel")?.value || "1";
  
  log(`Sender til CasparCG (${host}:${port}): ${viewName} for ${kommune} på kanal ${channel}`);
  
  // Simulated response
  setTimeout(() => {
    log(`CasparCG bekræftede: ${viewName} for ${kommune} på kanal ${channel}`);
  }, 500);
}

/**
 * Show preview in fullscreen
 */
function showFullscreen() {
  const iframe = safeEl("previewFrame");
  if (iframe && iframe.requestFullscreen) {
    iframe.requestFullscreen();
  }
}

/**
 * Update status indicator in UI
 * @param {boolean} isOnline - Whether display is online
 * @param {string} statusMessage - Status message
 */
function updateStatus(isOnline, statusMessage) {
  const statusIndicator = safeEl("statusIndicator");
  const statusText = safeEl("statusText");

  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${
      isOnline ? "status-online" : "status-offline"
    }`;
  }
  
  if (statusText) {
    statusText.textContent = statusMessage;
  }
}

// Initialize the controller
initialize();/**
 * Controller for the unified control panel
 * This controller integrates the functionality of all control panels into one
 */

// Panel state
const panelState = {
  // Results tab
  resultsKommuneId: "851", // Aalborg as default
  resultsData: null,
  
  // Candidates tab
  candidatesKommuneId: "851", // Aalborg as default
  candidatesData: null,
  
  // Polling stations tab
  pollingStationKommuneId: "851", // Aalborg as default
  pollingStationValgstedId: "85103", // Default polling station
  pollingStationData: null,
  
  // Active tab
  activeTab: "results",
  
  // Sort settings
  sortAlphabetically: true,
  
  // Auto update timing
  autoUpdateSeconds: 30
};

/**
 * Safe way to get elements with error handling
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} - DOM element or null if not found
 */
function safeEl(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with ID "${id}" not found!`);
  }
  return element;
}

/**
 * Initialize the control panel
 */
function initialize() {
  document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing unified control panel...");
    
    // Initialize tabs
    setupTabs();
    
    // Initialize municipality buttons for all tabs
    initializeKommuneButtons("kommuneButtons", panelState.resultsKommuneId, (id) => {
      setKommuneResults(id);
    });
    
    initializeKommuneButtons("kommuneButtonsCand", panelState.candidatesKommuneId, (id) => {
      setKommuneCandidates(id);
    });
    
    initializeKommuneButtons("kommuneButtonsPS", panelState.pollingStationKommuneId, (id) => {
      setKommunePollingStation(id);
    });
    
    // Initialize polling station buttons
    initializeValgstedButtons();
    
    // Setup control buttons
    setupControlButtons();
    
    // Setup display window controls
    setupDisplayControls();
    
    // Update preview frames
    updatePreviewFrames();
    
    // Update status
    updateStatus(false, "Klar til brug");
    
    // Log system start
    log("Unified kontrolpanel initialiseret");
    
    console.log("Unified control panel initialized");
  });
}

/**
 * Set up tab switching
 */
function setupTabs() {
  console.log("Setting up tabs...");
  
  // Results tab
  const tabResults = safeEl("tabResults");
  if (tabResults) {
    tabResults.addEventListener("click", () => {
      switchTab("results");
    });
  }
  
  // Candidates tab
  const tabCandidates = safeEl("tabCandidates");
  if (tabCandidates) {
    tabCandidates.addEventListener("click", () => {
      switchTab("candidates");
    });
  }
  
  // Polling stations tab
  const tabPollingStations = safeEl("tabPollingStations");
  if (tabPollingStations) {
    tabPollingStations.addEventListener("click", () => {
      switchTab("polling-station");
    });
  }
}

/**
 * Switch between tabs
 * @param {string} tabName - Name of tab to switch to
 */
function switchTab(tabName) {
  console.log(`Switching to tab: ${tabName}`);
  
  // Update panel state
  panelState.activeTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll(".view-tab").forEach(tab => {
    tab.classList.remove("active");
  });
  
  // Update tab content
  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.remove("active");
  });
  
  // Activate correct tab
  switch(tabName) {
    case "results":
      const tabResultsEl = safeEl("tabResults");
      const resultsContentEl = safeEl("resultsContent");
      
      if (tabResultsEl) tabResultsEl.classList.add("active");
      if (resultsContentEl) resultsContentEl.classList.add("active");
      break;
      
    case "candidates":
      const tabCandidatesEl = safeEl("tabCandidates");
      const candidatesContentEl = safeEl("candidatesContent");
      
      if (tabCandidatesEl) tabCandidatesEl.classList.add("active");
      if (candidatesContentEl) candidatesContentEl.classList.add("active");
      break;
      
    case "polling-station":
      const tabPollingStationsEl = safeEl("tabPollingStations");
      const pollingStationsContentEl = safeEl("pollingStationsContent");
      
      if (tabPollingStationsEl) tabPollingStationsEl.classList.add("active");
      if (pollingStationsContentEl) pollingStationsContentEl.classList.add("active");
      break;
  }
  
  // Update preview frame
  updatePreviewFrames();
}

/**
 * Initialize municipality buttons
 * @param {string} elementId - ID of button container
 * @param {string} activeId - ID of active municipality
 * @param {Function} clickHandler - Click handler function
 */
function initializeKommuneButtons(elementId, activeId, clickHandler) {
  const kommuneButtonsEl = safeEl(elementId);
  if (!kommuneButtonsEl) return;
  
  kommuneButtonsEl.innerHTML = "";

  // Sort municipalities as needed
  const sortedKommuner = [...kommuner].sort((a, b) => {
    if (panelState.sortAlphabetically) {
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
      clickHandler(kommune.id);
    });

    if (kommune.id === activeId) {
      button.classList.add("active");
    }

    kommuneButtonsEl.appendChild(button);
  });
}

/**
 * Initialize polling station buttons
 */
function initializeValgstedButtons() {
  const valgstedButtonsEl = safeEl("valgstedButtons");
  if (!valgstedButtonsEl) return;
  
  valgstedButtonsEl.innerHTML = "";

  const kommuneValgsteder = getValgstederForKommune(panelState.pollingStationKommuneId);

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
      setValgsted(valgsted.id, valgsted.navn);
    });

    if (valgsted.id === panelState.pollingStationValgstedId) {
      button.classList.add("active");
    }

    valgstedButtonsEl.appendChild(button);
  });
}

/**
 * Set up control buttons
 */
function setupControlButtons() {
  console.log("Setting up control buttons...");
  
  // Results tab buttons
  const btnPrepResults = safeEl("btnPrepResults");
  if (btnPrepResults) {
    btnPrepResults.addEventListener("click", prepareResultsView);
  }
  
  const btnUpdateResults = safeEl("btnUpdateResults");
  if (btnUpdateResults) {
    btnUpdateResults.addEventListener("click", updateResults);
  }
  
  const btnRefreshKommuner = safeEl("btnRefreshKommuner");
  if (btnRefreshKommuner) {
    btnRefreshKommuner.addEventListener("click", () => {
      initializeKommuneButtons("kommuneButtons", panelState.resultsKommuneId, (id) => {
        setKommuneResults(id);
      });
      log("Kommuneliste for resultater opdateret");
    });
  }
  
  const btnSortKommuner = safeEl("btnSortKommuner");
  if (btnSortKommuner) {
    btnSortKommuner.addEventListener("click", toggleSorting);
  }
  
  // Candidates tab buttons
  const btnPrepCandidates = safeEl("btnPrepCandidates");
  if (btnPrepCandidates) {
    btnPrepCandidates.addEventListener("click", prepareCandidatesView);
  }
  
  const btnUpdateCandidates = safeEl("btnUpdateCandidates");
  if (btnUpdateCandidates) {
    btnUpdateCandidates.addEventListener("click", updateCandidates);
  }
  
  const btnRefreshKommunerCand = safeEl("btnRefreshKommunerCand");
  if (btnRefreshKommunerCand) {
    btnRefreshKommunerCand.addEventListener("click", () => {
      initializeKommuneButtons("kommuneButtonsCand", panelState.candidatesKommuneId, (id) => {
        setKommuneCandidates(id);
      });
      log("Kommuneliste for kandidater opdateret");
    });
  }
  
  // Polling stations tab buttons
  const btnPrepPollingStation = safeEl("btnPrepPollingStation");
  if (btnPrepPollingStation) {
    btnPrepPollingStation.addEventListener("click", preparePollingStationView);
  }
  
  const btnUpdatePollingStation = safeEl("btnUpdatePollingStation");
  if (btnUpdatePollingStation) {
    btnUpdatePollingStation.addEventListener("click", updatePollingStation);
  }
  
  const btnRefreshKommunerPS = safeEl("btnRefreshKommunerPS");
  if (btnRefreshKommunerPS) {
    btnRefreshKommunerPS.addEventListener("click", () => {
      initializeKommuneButtons("kommuneButtonsPS", panelState.pollingStationKommuneId, (id) => {
        setKommunePollingStation(id);
      });
      log("Kommuneliste for valgsteder opdateret");
    });
  }
  
  const btnRefreshValgsteder = safeEl("btnRefreshValgsteder");
  if (btnRefreshValgsteder) {
    btnRefreshValgsteder.addEventListener("click", () => {
      initializeValgstedButtons();
      log("Valgstedsliste opdateret");
    });
  }
  
  // Take buttons
  const btnTakeCut = safeEl("btnTakeCut");
  if (btnTakeCut) {
    btnTakeCut.addEventListener("click", () => {
      takeView("cut");
    });
  }
  
  const btnTakeFade = safeEl("btnTakeFade");
  if (btnTakeFade) {
    btnTakeFade.addEventListener("click", () => {
      takeView("fade");
    });
  }
  
  const btnTakeWipe = safeEl("btnTakeWipe");
  if (btnTakeWipe) {
    btnTakeWipe.addEventListener("click", () => {
      takeView("wipe");
    });
  }
  
  // Helper buttons
  const btnClearLog = safeEl("btnClearLog");
  if (btnClearLog) {
    btnClearLog.addEventListener("click", clearLog);
  }
  
  const btnFullscreen = safeEl("btnFullscreen");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", showFullscreen);
  }
  
  const btnSendToCasparCG = safeEl("btnSendToCasparCG");
  if (btnSendToCasparCG) {
    btnSendToCasparCG.addEventListener("click", sendToCasparCG);
  }
}

/**
 * Set up display window controls
 */
function setupDisplayControls() {
  const btnOpenDisplay = safeEl("btnOpenDisplay");
  if (btnOpenDisplay) {
    btnOpenDisplay.addEventListener("click", openDisplay);
  }
  
  const btnCloseDisplay = safeEl("btnCloseDisplay");
  if (btnCloseDisplay) {
    btnCloseDisplay.addEventListener("click", closeDisplay);
  }
}

/**
 * Toggle sorting order for municipality buttons
 */
function toggleSorting() {
  panelState.sortAlphabetically = !panelState.sortAlphabetically;
  
  // Refresh all kommune buttons
  initializeKommuneButtons("kommuneButtons", panelState.resultsKommuneId, (id) => {
    setKommuneResults(id);
  });
  
  initializeKommuneButtons("kommuneButtonsCand", panelState.candidatesKommuneId, (id) => {
    setKommuneCandidates(id);
  });
  
  initializeKommuneButtons("kommuneButtonsPS", panelState.pollingStationKommuneId, (id) => {
    setKommunePollingStation(id);
  });
  
  log(`Kommuner sorteret ${panelState.sortAlphabetically ? "alfabetisk" : "efter ID"}`);
}

/**
 * Set kommune for results view
 */
function setKommuneResults(id) {
  panelState.resultsKommuneId = id;
  const kommune = getKommune(id) || { navn: "Ukendt" };

  // Update UI
  document.querySelectorAll("#kommuneButtons button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });

  // Reset data
  panelState.resultsData = null;

  // Update info panel
  const currentKommuneEl = safeEl("currentKommune");
  const currentValgstedEl = safeEl("currentValgsted");
  const lastUpdateEl = safeEl("lastUpdate");
  
  if (currentKommuneEl) currentKommuneEl.textContent = kommune.navn;
  if (currentValgstedEl) currentValgstedEl.textContent = "-";
  if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString();

  // Update preview
  updatePreviewFrames();

  // Log action
  log(`Skiftet til ${kommune.navn} (ID: ${id}) for resultater`);
}

/**
 * Set kommune for candidates view
 */
function setKommuneCandidates(id) {
  panelState.candidatesKommuneId = id;
  const kommune = getKommune(id) || { navn: "Ukendt" };

  // Update UI
  document.querySelectorAll("#kommuneButtonsCand button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });

  // Reset data
  panelState.candidates