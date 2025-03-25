/**
 * Controller for the elected candidates visualization view
 */

// System state
const state = {
  kommuneId: null,
  lastData: null,
  kommuneData: null, // Til at holde data fra første endpoint
  cacheKey: Date.now(), // Til at undgå cache ved API-kald
  refreshInterval: 30, // sekunder
  sekunderTilOpdatering: 30,
};

/**
 * Initialize the visualization
 */
function initialize() {
  // Hent kommune-id fra URL-parameter
  state.kommuneId =
    new URLSearchParams(window.location.search).get("id") || "851";

  // Start data opdatering
  hentKandidatData(true);

  // Start nedtællingsopdatering
  startCountdownTimer();

  // Start periodisk dataopdatering
  startPeriodicUpdates();

  // Lyt efter beskeder fra kontrolpanelet
  setupMessageListener();
}

/**
 * Start the countdown timer
 */
function startCountdownTimer() {
  // Opdater nedtælling hvert sekund
  setInterval(() => {
    state.sekunderTilOpdatering--;
    if (state.sekunderTilOpdatering <= 0) {
      state.sekunderTilOpdatering = state.refreshInterval;

      // Vis "opdaterer..." når tiden er ude
      el("nedtaelling").innerHTML = `
          <svg class="update-icon pulse" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z"/>
          </svg>
          Opdaterer data...
        `;
    } else {
      // Opdater normal nedtælling
      el("nedtaelling").innerHTML = `
          <svg class="update-icon ${
            state.sekunderTilOpdatering <= 5 ? "pulse" : ""
          }" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4 7.58 4 12C4 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z"/>
          </svg>
          Opdaterer om: ${state.sekunderTilOpdatering} sek
        `;
    }
  }, 1000);
}

/**
 * Start periodic data updates
 */
function startPeriodicUpdates() {
  // Hent nye data med jævne mellemrum
  setInterval(() => {
    // Brug subtil opdatering
    hentKandidatData(false);
    state.sekunderTilOpdatering = state.refreshInterval;
  }, state.refreshInterval * 1000);
}

/**
 * Set up listener for messages from control panel
 */
function setupMessageListener() {
  window.addEventListener("message", function (event) {
    // Tjek om beskeden kommer fra en betroet kilde (kan tilpasses)
    // if (event.origin !== "http://din-betroede-domæne.dk") return;

    if (event.data?.action === "skiftKommune") {
      // Få fat i kommune-navn til transition
      const nyKommuneId = event.data.kommuneId;
      const kommune = kommuner.find((k) => k.id === nyKommuneId) || {
        navn: "Ukendt kommune",
      };

      // Vis kommune-transitions animation
      visKommuneTransition(kommune.navn);

      // Fade-out effekt før vi skifter kommune
      const fadeEl = document.getElementById("fadeOverlay");
      fadeEl.style.opacity = "1"; // Fade out

      // Skift kommune efter fade-out
      setTimeout(() => {
        state.kommuneId = nyKommuneId;
        state.lastData = null; // Nulstil sidste data så vi får fuld opdatering
        state.kommuneData = null; // Nulstil kommunedata
        hentKandidatData();

        // Fade in igen efter nyt data er hentet
        setTimeout(() => {
          fadeEl.style.opacity = "0";
        }, 100);
      }, 700);
    } else if (event.data?.action === "opdaterData") {
      // Direkte opdatering med data leveret i beskeden
      visKandidatData(event.data.payload);
      state.lastData = event.data.payload;

      // Vis opdateringseffekt
      visDataUpdateEffect();
    } else if (event.data?.action === "genindlæs") {
      // Genindlæs hele siden
      location.reload();
    }
  });
}

/**
 * Hent kommunedata fra results endpointet
 */
async function hentKommuneData() {
  try {
    const cacheKey = getCacheBuster();
    const url = `https://election-api.services.tv2.dk/kv/kv21/results/${state.kommuneId}?_cb=${cacheKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Server returnerede ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("Kommunedata modtaget:", data);

    state.kommuneData = data;
    return data;
  } catch (err) {
    console.error("Fejl ved hentning af kommunedata:", err);
    return null;
  }
}

/**
 * Hent kandidatdata fra TV2's API
 */
async function hentKandidatData(visLoadingScreen = true) {
  if (visLoadingScreen) {
    el("loadingScreen").style.display = "flex";
  }

  try {
    // Hent først kommunedata
    await hentKommuneData();

    // Derefter hent kandidatdata
    const cacheKey = getCacheBuster();
    const url = `https://election-api.services.tv2.dk/kv/kv21/areastatus/${state.kommuneId}?_cb=${cacheKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Server returnerede ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Kandidatdata modtaget:", data);

    // Gem som sidste data
    state.lastData = data;

    // Gem metadata til CasparCG hvis det bruges
    gemCasparCGMetadata(data);

    // Vis data på siden
    visKandidatData(data);

    // Opdater cache-key til næste kald
    state.cacheKey = getCacheBuster();
  } catch (err) {
    console.error("Fejl ved hentning af data:", err);
    el("kommuneNavn").textContent = "DATAFEJL";
    el("loadingScreen").innerHTML = `
        <div class="spinner">⟳</div>
        Fejl ved hentning af data: ${err.message}<br>
        Prøver igen om få sekunder...
      `;

    // Genindlæs siden om 10 sekunder ved fejl
    setTimeout(() => {
      location.reload();
    }, 10000);
  }
}

/**
 * Gem metadata i en skjult div til CasparCG
 */
function gemCasparCGMetadata(data) {
  const meta = {
    kommuneId: state.kommuneId,
    kommuneNavn: state.kommuneData?.result?.name || data.name || "",
    antalKandidater: data.elected?.flatMap((p) => p.candidates)?.length || 0,
    antalMandater: state.kommuneData?.result?.seats || 0,
    optalingsProcent: state.kommuneData?.result?.electionProgress || 0,
    opdateret: data.lastUpdated || "",
  };

  el("meta").setAttribute("data-json", JSON.stringify(meta));
}

/**
 * Vis transitionseffekt ved kommuneskift
 */
function visKommuneTransition(kommuneNavn) {
  const transitionDiv = el("transitionOverlay");
  const kommuneTransition = el("kommuneTransition");

  // Sæt kommunenavn
  kommuneTransition.textContent = kommuneNavn;

  // Vis overlay
  transitionDiv.style.opacity = "1";

  // Start animation
  setTimeout(() => {
    kommuneTransition.style.opacity = "1";
    kommuneTransition.style.transform = "scale(1)";
  }, 100);

  // Skjul efter animation
  setTimeout(() => {
    kommuneTransition.style.opacity = "0";
    kommuneTransition.style.transform = "scale(1.2)";

    setTimeout(() => {
      transitionDiv.style.opacity = "0";
      setTimeout(() => {
        kommuneTransition.style.transform = "scale(0.8)";
      }, 700);
    }, 800);
  }, 2000);
}

/**
 * Vis data opdateringseffekt
 */
function visDataUpdateEffect() {
  const updateFlash = el("updateFlash");
  updateFlash.style.opacity = "0.3";

  setTimeout(() => {
    updateFlash.style.opacity = "0";
  }, 700);
}

/**
 * Vis kandidatdata på siden
 */
function visKandidatData(data) {
  // Kommune navn fra kommunedata hvis tilgængelig, ellers fra kandidatdata
  const kommuneNavn =
    state.kommuneData?.result?.name || data.name || "Ukendt kommune";
  el("kommuneNavn").textContent = kommuneNavn;

  // Håndter optællingsindikator
  const optaltIndikator = el("optaltIndikator");
  const pct = state.kommuneData?.result?.electionProgress || 100;

  // Sæt optællingsprocent og klasse afhængigt af status
  optaltIndikator.textContent = `${pct}% optalt`;
  optaltIndikator.className = "optalt-indikator";

  if (pct >= 95) {
    optaltIndikator.classList.add("fuldt");
  } else if (pct >= 50) {
    optaltIndikator.classList.add("delvist");
  } else {
    optaltIndikator.classList.add("minimalt");
  }

  // Opdater info om byråd
  const antalMandater =
    state.kommuneData?.result?.seats || data.councilSeats || 31;
  el("mandatInfo").textContent = `${antalMandater} pladser i byrådet`;

  // Antal valgte kandidater
  const valgte = data.elected || [];
  const antalKandidater = valgte.flatMap((p) => p.candidates).length;
  el("kandidatInfo").textContent = `${antalKandidater} valgte kandidater`;

  // Ryd kandidat container
  const container = el("kandidatContainer");
  container.innerHTML = "";

  // Sorter partier efter antal mandater
  const sorteredePartier = [...valgte].sort(
    (a, b) => (b.candidates?.length || 0) - (a.candidates?.length || 0)
  );

  // Opret elementer for hvert parti
  sorteredePartier.forEach((parti, i) => {
    if (!parti.candidates || parti.candidates.length === 0) return;

    const partiLetter = parti.letter || parti.candidates[0]?.partyLetter || "";
    const partiNavn =
      parti.name || parti.candidates[0]?.partyName || "Ukendt parti";
    const partiColor = farve(partiLetter);
    const antalMandater = parti.candidates.length;

    // Opret parti-gruppe
    const partiGruppe = document.createElement("div");
    partiGruppe.className = "parti-gruppe";
    partiGruppe.style.animationDelay = `${i * 150}ms`;

    // Opret parti-header
    const partiHeader = document.createElement("div");
    partiHeader.className = "parti-header";
    partiHeader.innerHTML = `
        <div class="parti-bogstav" style="background-color: ${partiColor}">${partiLetter}</div>
        <div class="parti-navn">${partiNavn}</div>
        <div class="parti-mandater">${antalMandater} ${
      antalMandater === 1 ? "mandat" : "mandater"
    }</div>
      `;

    partiGruppe.appendChild(partiHeader);

    // Sorter kandidater efter stemmer
    const sorteredeKandidater = [...parti.candidates].sort(
      (a, b) => (b.votes || 0) - (a.votes || 0)
    );

    // Opret elementer for hver kandidat
    sorteredeKandidater.forEach((kandidat, j) => {
      // Simplificeret håndtering af billede-URL
      let imageUrl = "";
      if (kandidat.imageURL) {
        // Tag bare den første URL fra srcset
        const firstUrl = kandidat.imageURL.split(",")[0].trim();
        // Mønstergenkendelse baseret på URL-strukturen
        if (firstUrl.includes("?")) {
          // Brug hele url op til første parameter
          imageUrl = firstUrl.split(" ")[0].trim();
        }
      }

      // Opret kandidat-element
      const kandidatEl = document.createElement("div");
      kandidatEl.className = "kandidat";

      // Tjek om dette er borgmesteren baseret på data.mayor
      let erBorgmester = false;
      if (data.mayor && Object.keys(data.mayor).length > 0) {
        if (data.mayor.externalId && kandidat.externalId) {
          // Match på externalId hvis det findes
          erBorgmester = data.mayor.externalId === kandidat.externalId;
        } else if (data.mayor.name && kandidat.name) {
          // Fallback til at matche på navn
          erBorgmester = data.mayor.name === kandidat.name;
        }
      }

      if (erBorgmester) {
        kandidatEl.classList.add("borgmester");
      }

      // Initialerne hvis vi ikke har et billede
      const initialer = kandidat.name
        ? kandidat.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
        : "?";

      kandidatEl.innerHTML = `
          <div class="kandidat-foto" style="${
            imageUrl ? `background-image: url('${imageUrl}')` : ""
          }">${!imageUrl ? initialer : ""}</div>
          <div class="kandidat-info">
            <div class="kandidat-navn">${kandidat.name || "Ukendt"}</div>
            <div class="kandidat-detaljer">${
              kandidat.age ? `${kandidat.age} år` : ""
            }</div>
          </div>
          <div class="kandidat-stemmer">${formatNumber(
            kandidat.votes || 0
          )}</div>
        `;

      partiGruppe.appendChild(kandidatEl);
    });

    container.appendChild(partiGruppe);
  });

  // Opdater tidsstempel
  if (data.lastUpdated) {
    const dato = new Date(data.lastUpdated);
    el(
      "opdateretTid"
    ).textContent = `Sidst opdateret: ${dato.toLocaleTimeString("da-DK")}`;
  } else {
    el("opdateretTid").textContent = "";
  }

  // Skjul loading-skærm
  el("loadingScreen").style.display = "none";
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);
