/**
 * Universal view controller for the election visualization system
 * Controls the universal view window and provides shared functions for all control panels
 */

// System state
const universalViewState = {
  displayWindow: null,
  isPrepared: false,
  preparedViewType: null,
  preparedParams: null,
  preparedData: null,
  activeViewType: null,
  activeParams: null,
  activeData: null,
  updateInterval: null,
  autoUpdateEnabled: true,
  autoUpdateSeconds: 30,
};

/**
 * Open the universal display window
 * @param {string} initialViewType - Initial view type to load (optional)
 * @param {object} initialParams - Initial parameters (optional)
 * @returns {boolean} - Success status
 */
function openUniversalDisplay(initialViewType = null, initialParams = null) {
  // Close existing window if open
  if (
    universalViewState.displayWindow &&
    !universalViewState.displayWindow.closed
  ) {
    universalViewState.displayWindow.close();
  }

  console.log("Opening universal display window...");

  // Build URL with initial view if provided
  let url = "views/universal-view.html";
  if (initialViewType && initialParams) {
    url += `?view=${initialViewType}`;

    // Add main parameter (usually kommune)
    if (initialParams.id) {
      url += `&id=${initialParams.id}`;
    } else if (initialParams.kommune) {
      url += `&kommune=${initialParams.kommune}`;
    }
  }

  console.log(`Opening URL: ${url}`);

  // Open new window in fullscreen
  universalViewState.displayWindow = window.open(
    url,
    "UniversalView",
    "menubar=0,toolbar=0,location=0,status=0,fullscreen=1"
  );

  if (!universalViewState.displayWindow) {
    log("Kunne ikke åbne visningsvindue. Tjek pop-up blocker.", "error");
    alert(
      "Kunne ikke åbne visningsvindue. Kontrollér at pop-up blocker er deaktiveret."
    );
    updateStatus(false, "Fejl ved åbning");
    return false;
  }

  // Set active view if initial was provided
  if (initialViewType && initialParams) {
    universalViewState.activeViewType = initialViewType;
    universalViewState.activeParams = initialParams;
  }

  // Check for window closure
  const checkWindowClosed = setInterval(() => {
    if (universalViewState.displayWindow.closed) {
      updateStatus(false, "Visning lukket");
      log("Visningsvindue lukket");
      clearInterval(checkWindowClosed);

      if (universalViewState.updateInterval) {
        clearInterval(universalViewState.updateInterval);
        universalViewState.updateInterval = null;
      }
    }
  }, 1000);

  log("Universelt visningsvindue åbnet");
  return true;
}

/**
 * Close the universal display window
 */
function closeUniversalDisplay() {
  if (
    universalViewState.displayWindow &&
    !universalViewState.displayWindow.closed
  ) {
    universalViewState.displayWindow.close();
    log("Visningsvindue lukket manuelt");

    if (universalViewState.updateInterval) {
      clearInterval(universalViewState.updateInterval);
      universalViewState.updateInterval = null;
    }

    updateStatus(false, "Visning lukket");

    // Reset view state
    universalViewState.activeViewType = null;
    universalViewState.activeParams = null;
    universalViewState.activeData = null;
    universalViewState.isPrepared = false;
    universalViewState.preparedViewType = null;
    universalViewState.preparedParams = null;
    universalViewState.preparedData = null;

    return true;
  } else {
    log("Intet aktivt visningsvindue at lukke");
    return false;
  }
}

/**
 * Prepare a view for display (but don't show it yet)
 * @param {string} viewType - Type of view to prepare
 * @param {object} params - Parameters for the view
 * @param {object} data - Data for the view (optional)
 * @returns {boolean} - Success status
 */
function prepareView(viewType, params, data = null) {
  if (
    !universalViewState.displayWindow ||
    universalViewState.displayWindow.closed
  ) {
    log("Intet aktivt visningsvindue. Åbn et visningsvindue først.", "error");
    return false;
  }

  console.log(`Preparing view: ${viewType}`, params);

  // Store prepared state
  universalViewState.isPrepared = true;
  universalViewState.preparedViewType = viewType;
  universalViewState.preparedParams = params;
  universalViewState.preparedData = data;

  // Send prepare message to universal view
  universalViewState.displayWindow.postMessage(
    {
      action: "prepView",
      viewType: viewType,
      params: params,
      data: data,
    },
    "*"
  );

  log(`Forberedt ${getViewTypeName(viewType)} til visning`);
  return true;
}

/**
 * Take the prepared view and display it
 * @param {string} transition - Transition effect to use (cut, fade, wipe)
 * @returns {boolean} - Success status
 */
function takeView(transition = "cut") {
  if (
    !universalViewState.displayWindow ||
    universalViewState.displayWindow.closed
  ) {
    log("Intet aktivt visningsvindue. Åbn et visningsvindue først.", "error");
    return false;
  }

  if (!universalViewState.isPrepared) {
    log("Ingen forberedt visning. Forbered en visning først.", "warning");
    return false;
  }

  console.log(`Taking view with transition: ${transition}`);

  // Send take message to universal view
  universalViewState.displayWindow.postMessage(
    {
      action: "takeView",
      transition: transition,
    },
    "*"
  );

  // Update active state
  universalViewState.activeViewType = universalViewState.preparedViewType;
  universalViewState.activeParams = universalViewState.preparedParams;
  universalViewState.activeData = universalViewState.preparedData;

  // Reset prepared state
  universalViewState.isPrepared = false;
  universalViewState.preparedViewType = null;
  universalViewState.preparedParams = null;
  universalViewState.preparedData = null;

  // Update status
  updateStatus(
    true,
    `Viser ${getViewTypeName(universalViewState.activeViewType)}`
  );

  log(
    `Skiftet til ${getViewTypeName(
      universalViewState.activeViewType
    )} med ${transition}-transition`
  );
  return true;
}

/**
 * Update data in the current view
 * @param {object} data - New data to display
 * @returns {boolean} - Success status
 */
function updateViewData(data) {
  if (
    !universalViewState.displayWindow ||
    universalViewState.displayWindow.closed
  ) {
    log("Intet aktivt visningsvindue. Åbn et visningsvindue først.", "error");
    return false;
  }

  universalViewState.activeData = data;

  // Send data update message to universal view
  universalViewState.displayWindow.postMessage(
    {
      action: "updateData",
      data: data,
    },
    "*"
  );

  log("Data opdateret i aktiv visning");
  return true;
}

/**
 * Directly display a view without preview
 * @param {string} viewType - Type of view to display
 * @param {object} params - Parameters for the view
 * @param {object} data - Data for the view (optional)
 * @returns {boolean} - Success status
 */
function directView(viewType, params, data = null) {
  if (
    !universalViewState.displayWindow ||
    universalViewState.displayWindow.closed
  ) {
    log("Intet aktivt visningsvindue. Åbn et visningsvindue først.", "error");
    return false;
  }

  console.log(`Directly changing to view: ${viewType}`, params);

  // Send direct view message to universal view
  universalViewState.displayWindow.postMessage(
    {
      action: "directView",
      viewType: viewType,
      params: params,
      data: data,
    },
    "*"
  );

  // Update active state
  universalViewState.activeViewType = viewType;
  universalViewState.activeParams = params;
  universalViewState.activeData = data;

  // Reset prepared state
  universalViewState.isPrepared = false;
  universalViewState.preparedViewType = null;
  universalViewState.preparedParams = null;
  universalViewState.preparedData = null;

  // Update status
  updateStatus(true, `Viser ${getViewTypeName(viewType)}`);

  log(`Skiftet direkte til ${getViewTypeName(viewType)}`);
  return true;
}

/**
 * Update status indicator on UI
 * @param {boolean} isOnline - Whether display is online
 * @param {string} statusMessage - Status message
 */
function updateStatus(isOnline, statusMessage) {
  const statusIndicator = document.getElementById("statusIndicator");
  const statusText = document.getElementById("statusText");

  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${
      isOnline ? "status-online" : "status-offline"
    }`;
  }

  if (statusText) {
    statusText.textContent = statusMessage;
  }
}

/**
 * Get user-friendly name for view type
 * @param {string} viewType - View type code
 * @returns {string} - User-friendly name
 */
function getViewTypeName(viewType) {
  switch (viewType) {
    case "results":
      return "Valgresultater";
    case "candidates":
      return "Valgte kandidater";
    case "polling-station":
      return "Valgstedsresultater";
    default:
      return viewType || "Ukendt";
  }
}
