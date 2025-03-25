/**
 * Controller for the polling station results visualization view
 */

// System state
const state = {
  kommuneId: null,
  valgstedId: null,
  kommuneData: null, // Tilføjet for at gemme data fra kommuneendpointet
  lastData: null,
  cacheKey: Date.now(), // Til at undgå cache ved API-kald
  lastUpdateTimestamp: null,
  refreshInterval: 30, // sekunder
  sekunderTilOpdatering: 30,
};

/**
 * Initialize the visualization
 */
function initialize() {
  // Hent kommune-id og valgsted-id fra URL-parameter
  const urlParams = new URLSearchParams(window.location.search);
  state.kommuneId = urlParams.get("kommune") || "851";
  state.valgstedId = urlParams.get("valgsted") || "85103";

  // Hent først kommunedata, så vi har kommunenavnet
  hentKommuneData().then(() => {
    // Derefter hent valgstedsdata
    hentValgstedsdata(true);
  });

  // Start nedtællingsopdatering
  startCountdownTimer();

  // Start periodisk dataopdatering
  startPeriodicUpdates();

  // Lyt efter beskeder fra kontrolpanelet
  setupMessageListener();
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

    // Opdater kommune-info i UI
    if (data.result && data.result.name) {
      el("kommuneInfo").textContent = `Kommune: ${data.result.name}`;
    }

    state.kommuneData = data;
    return data;
  } catch (err) {
    console.error("Fejl ved hentning af kommunedata:", err);
    el("kommuneInfo").textContent = "Kommune: Fejl ved hentning af data";
    return null;
  }
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
    // Brug subtil opdatering (true=vis loading, false=skjul loading)
    hentValgstedsdata(false);
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

    if (event.data?.action === "skiftValgsted") {
      // Få fat i valgsteds-data til transition
      const nyKommuneId = event.data.kommuneId;
      const nyValgstedId = event.data.valgstedId;
      const valgstedNavn = event.data.valgstedNavn || "Nyt valgsted";

      // Vis transitions animation
      visTransition(valgstedNavn);

      // Fade-out effekt før vi skifter valgsted
      const fadeEl = document.getElementById("fadeOverlay");
      fadeEl.style.opacity = "1"; // Fade out

      // Skift valgsted efter fade-out
      setTimeout(() => {
        state.kommuneId = nyKommuneId;
        state.valgstedId = nyValgstedId;
        state.lastData = null; // Nulstil sidste data så vi får fuld opdatering
        state.kommuneData = null; // Nulstil kommunedata

        // Hent først kommunedata, så valgstedsdata
        hentKommuneData().then(() => {
          hentValgstedsdata();
        });

        // Fade in igen efter nyt data er hentet
        setTimeout(() => {
          fadeEl.style.opacity = "0";
        }, 100);
      }, 700);
    } else if (event.data?.action === "opdaterData") {
      // Direkte opdatering med data leveret i beskeden
      if (state.lastData) {
        const changes = findDataChanges(state.lastData, event.data.payload);
        visValgstedsdata(event.data.payload, changes, true);
      } else {
        visValgstedsdata(event.data.payload, [], false);
      }
      state.lastData = event.data.payload;
    } else if (event.data?.action === "genindlæs") {
      // Genindlæs hele siden
      location.reload();
    }
  });
}

/**
 * Sammenligner to datasæt og returnerer en liste af ændringer
 */
function findDataChanges(oldData, newData) {
  if (!oldData || !oldData.parties || !newData || !newData.parties) return [];

  const changes = [];

  // Map oldData partier for lettere opslag
  const oldParties = {};
  oldData.parties.forEach((party) => {
    oldParties[party.letter || party.abbreviation] = party;
  });

  // Tjek hver parti i nydata
  newData.parties.forEach((newParty) => {
    const letter = newParty.letter || newParty.abbreviation;
    const oldParty = oldParties[letter];

    if (oldParty) {
      // Tjek om procenter eller stemmer er ændret
      if (
        oldParty.votesPercentage !== newParty.votesPercentage ||
        oldParty.votes !== newParty.votes
      ) {
        changes.push({
          partyLetter: letter,
          percentChange: oldParty.votesPercentage !== newParty.votesPercentage,
          votesChange: oldParty.votes !== newParty.votes,
        });
      }
    }
  });

  return changes;
}

/**
 * Hent valgstedsdata fra TV2's API
 */
async function hentValgstedsdata(visLoadingScreen = true) {
  if (visLoadingScreen) {
    el("loadingScreen").style.display = "flex";
  }

  try {
    // Tilføj cache-buster parameter til API-kaldet
    const url = `https://election-api.services.tv2.dk/kv/kv21/results/${state.kommuneId}/${state.valgstedId}?_cb=${state.cacheKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Server returnerede ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Valgstedsdata modtaget:", data);

    // Find ændringer hvis vi har tidligere data
    const changes = findDataChanges(state.lastData, data);

    // Gem som sidste data til næste sammenligning
    state.lastData = data;

    // Gem metadata til CasparCG hvis det bruges
    gemCasparCGMetadata(data);

    // Vis data på siden
    visValgstedsdata(data, changes, !visLoadingScreen);

    // Opdater cache-key til næste kald
    state.cacheKey = Date.now();
  } catch (err) {
    console.error("Fejl ved hentning af data:", err);
    el("valgstedNavn").textContent = "DATAFEJL";
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
    valgstedId: state.valgstedId,
    kommuneNavn: state.kommuneData?.result?.name || "",
    valgstedNavn: data.result?.name || "",
    antalStemmer: data.result?.votesGiven || 0,
    valgdeltagelse: data.result?.votesPercentage || 0,
    opdateret: data.lastUpdated || "",
  };

  el("meta").setAttribute("data-json", JSON.stringify(meta));
}

/**
 * Vis transitionseffekt ved sted-skift
 */
function visTransition(tekst) {
  const transitionDiv = el("transitionOverlay");
  const contentEl = el("transitionContent");

  // Sæt tekst
  contentEl.textContent = tekst;

  // Vis overlay
  transitionDiv.style.opacity = "1";

  // Start animation
  setTimeout(() => {
    contentEl.style.opacity = "1";
    contentEl.style.transform = "scale(1)";
  }, 100);

  // Skjul efter animation
  setTimeout(() => {
    contentEl.style.opacity = "0";
    contentEl.style.transform = "scale(1.2)";

    setTimeout(() => {
      transitionDiv.style.opacity = "0";
      setTimeout(() => {
        contentEl.style.transform = "scale(0.8)";
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
 * Vis valgstedsdata på siden
 */
function visValgstedsdata(data, changes = [], subtilOpdatering = false) {
  // Hvis det er en subtil opdatering, viser vi en visuel effekt
  if (subtilOpdatering) {
    visDataUpdateEffect();
  }

  // Valgstedsnavn - skal hentes fra result.name
  if (data.result && data.result.name) {
    el("valgstedNavn").textContent = data.result.name;
  } else {
    el("valgstedNavn").textContent = "Ukendt valgsted";
  }

  // Kommune-info skulle allerede være opdateret fra hentKommuneData()
  // Men hvis vi ikke har kommunedata, kan vi prøve at hente det fra valgstedsdata
  if (!state.kommuneData && data.communityName) {
    el("kommuneInfo").textContent = `Kommune: ${data.communityName}`;
  }

  // Håndter optællingsindikator
  const optaltIndikator = el("optaltIndikator");
  optaltIndikator.textContent = "Optalt";
  optaltIndikator.className = "optalt-indikator fuldt";

  // Valgdeltagelse
  if (data.result && typeof data.result.votesPercentage === "number") {
    el(
      "valgdeltagelse"
    ).textContent = `Valgdeltagelse: ${data.result.votesPercentage.toFixed(
      1
    )}%`;
  } else {
    el("valgdeltagelse").textContent = "Valgdeltagelse: Afventer";
  }

  // Stemmeinfo - brug votesGiven i stedet for at beregne summen selv
  const stemmeInfo = el("stemmeInfo");
  if (data.result && data.result.votesGiven) {
    stemmeInfo.textContent = `${formatNumber(
      data.result.votesGiven
    )} stemmer afgivet`;
  } else {
    stemmeInfo.textContent = "0 stemmer afgivet";
  }

  // Hvis det er subtil opdatering, opdaterer vi kun værdierne uden at genopbygge listen
  if (subtilOpdatering && el("partiListe").children.length > 0) {
    opdaterPartiListe(data.parties, changes);
  } else {
    // Ellers genopbygger vi hele listen
    opretPartiListe(data.parties);
  }

  // Opdater tidsstempel
  if (data.lastUpdated) {
    const dato = new Date(data.lastUpdated);
    el(
      "opdateretTid"
    ).textContent = `Sidst opdateret: ${dato.toLocaleTimeString("da-DK")}`;
    state.lastUpdateTimestamp = data.lastUpdated;
  } else {
    el("opdateretTid").textContent = "";
  }

  // Skjul loading-skærm
  el("loadingScreen").style.display = "none";
}

/**
 * Opret hele partilisten på ny
 */
function opretPartiListe(partier) {
  // Ryd partilisten
  const liste = el("partiListe");
  liste.innerHTML = "";

  // Hent partier, sorter efter stemmeprocent
  const visPartier = (partier || []).sort(
    (a, b) => b.votesPercentage - a.votesPercentage
  );

  // Opret elementer for hvert parti
  visPartier.forEach((parti, i) => {
    const kode = (parti.letter || parti.abbreviation || "").toUpperCase();
    const navn = parti.name || "Ukendt";
    const procent =
      typeof parti.votesPercentage === "number"
        ? parti.votesPercentage.toFixed(1)
        : "0.0";
    const stemmer = parti.votes || 0;
    const color = farve(kode);

    // Opret parti-element
    const elBox = document.createElement("div");
    elBox.className = "parti";
    elBox.dataset.letter = kode;

    // Sæt animationsforsinkelse
    elBox.style.animationDelay = `${i * 100}ms`;

    // Byg HTML
    elBox.innerHTML = `
    <div class="parti-info">
      <div class="parti-bogstav" style="background-color: ${color}">${kode}</div>
      <div class="parti-navn">${navn}</div>
    </div>
    <div class="parti-procent">
      ${procent}%
    </div>
    <div class="parti-stemmer">
      ${formatNumber(stemmer)} stemmer
    </div>
    <div class="bar-container">
      <div class="bar" style="width: 0%; background-color: ${color}"></div>
    </div>
  `;

    // Tilføj til DOM
    liste.appendChild(elBox);

    // Animer bjælken efter en kort forsinkelse
    setTimeout(() => {
      const barEl = elBox.querySelector(".bar");
      barEl.style.width = `${Math.min(100, parseFloat(procent) * 2)}%`;
    }, 100);
  });
}

/**
 * Opdater eksisterende partiliste ved at ændre værdierne og animere ændrede værdier
 */
function opdaterPartiListe(partier, changes) {
  // Find alle eksisterende parti-elementer
  const partiElements = document.querySelectorAll(".parti");
  if (!partiElements.length) return;

  // Sorter partier efter stemmeprocent
  const sortedPartier = (partier || []).sort(
    (a, b) => b.votesPercentage - a.votesPercentage
  );

  // Opdater hvert parti-element
  partiElements.forEach((partiElement, index) => {
    if (index >= sortedPartier.length) return;

    const parti = sortedPartier[index];
    const partiLetter = partiElement.dataset.letter;

    // Find procent og stemmer elementer
    const procentElement = partiElement.querySelector(".parti-procent");
    const stemmerElement = partiElement.querySelector(".parti-stemmer");
    const barElement = partiElement.querySelector(".bar");

    if (!procentElement || !stemmerElement || !barElement) return;

    // Tjek om dette parti har ændringer
    const hasChanges = changes.find((c) => c.partyLetter === partiLetter);

    // Opdater værdierne
    const procent =
      typeof parti.votesPercentage === "number"
        ? parti.votesPercentage.toFixed(1)
        : "0.0";

    const stemmer = parti.votes || 0;

    // Opdater procent
    procentElement.textContent = `${procent}%`;

    // Opdater stemmer
    stemmerElement.textContent = `${formatNumber(stemmer)} stemmer`;

    // Opdater søjle
    barElement.style.width = `${Math.min(100, parseFloat(procent) * 2)}%`;

    // Tilføj highlight animation til ændrede elementer
    if (hasChanges) {
      if (hasChanges.percentChange) {
        procentElement.classList.add("parti-data-change");
        setTimeout(() => {
          procentElement.classList.remove("parti-data-change");
        }, 1500);
      }

      if (hasChanges.votesChange) {
        stemmerElement.classList.add("parti-data-change");
        setTimeout(() => {
          stemmerElement.classList.remove("parti-data-change");
        }, 1500);
      }
    }
  });
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);
