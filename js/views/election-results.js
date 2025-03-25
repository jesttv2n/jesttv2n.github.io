/**
 * Controller for the election results visualization view
 */

// System state
const state = {
  kommuneId: null,
  lastData: null,
  lastUpdateTimestamp: null,
  cacheKey: Date.now(), // Til at undgå cache ved API-kald
  opdateringsTimer: null,
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
  hentValgdata(true);

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
    // Brug subtil opdatering (true=vis loading, false=skjul loading)
    hentValgdata(false);
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
        hentValgdata();

        // Fade in igen efter nyt data er hentet
        setTimeout(() => {
          fadeEl.style.opacity = "0";
        }, 100);
      }, 700);
    } else if (event.data?.action === "opdaterData") {
      // Direkte opdatering med data leveret i beskeden
      if (state.lastData) {
        const changes = findDataChanges(state.lastData, event.data.payload);
        visValgdata(event.data.payload, changes, true);
      } else {
        visValgdata(event.data.payload, [], false);
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
      // Tjek om procenter eller mandater er ændret
      if (
        oldParty.votesPercentage !== newParty.votesPercentage ||
        oldParty.seats !== newParty.seats
      ) {
        changes.push({
          partyLetter: letter,
          percentChange: oldParty.votesPercentage !== newParty.votesPercentage,
          seatsChange: oldParty.seats !== newParty.seats,
        });
      }
    }
  });

  return changes;
}

/**
 * Hent valgdata fra TV2's API
 */
async function hentValgdata(visLoadingScreen = true) {
  if (visLoadingScreen) {
    el("loadingScreen").style.display = "flex";
  }

  try {
    // Tilføj cache-buster parameter til API-kaldet
    const url = `https://election-api.services.tv2.dk/kv/kv21/results/${state.kommuneId}?_cb=${state.cacheKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Server returnerede ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Valgdata modtaget:", data);

    // Find ændringer hvis vi har tidligere data
    const changes = findDataChanges(state.lastData, data);

    // Gem som sidste data til næste sammenligning
    state.lastData = data;

    // Gem metadata til CasparCG hvis det bruges
    gemCasparCGMetadata(data);

    // Vis data på siden
    visValgdata(data, changes, !visLoadingScreen);

    // Opdater cache-key til næste kald
    state.cacheKey = Date.now();
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
    kommuneNavn: data.result.name || "",
    optalt: data.result?.electionProgress || 0,
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
 * Vis valgdata på siden
 */
function visValgdata(data, changes = [], subtilOpdatering = false) {
  // Hvis det er en subtil opdatering, viser vi en visuel effekt
  if (subtilOpdatering) {
    visDataUpdateEffect();
  }

  // Udpak datastrukturen
  const resultData = data.result;

  if (!resultData) {
    console.error("Ingen resultatdata tilgængelig");
    el("kommuneNavn").textContent = "Ingen data";
    el("loadingScreen").style.display = "none";
    return;
  }

  // Kommune navn
  const kommuneNavn = resultData.name || "Ukendt kommune";
  el("kommuneNavn").textContent = kommuneNavn + " Kommune";

  // Håndter optællingsindikator
  const optaltIndikator = el("optaltIndikator");
  const pct = resultData.electionProgress || 0;

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

  // Opdater optællingstekst
  el("optaelling").textContent = `Optællingstatus: ${pct}%`;

  // Valgdeltagelse
  el("valgdeltagelse").textContent = resultData.votesPercentage
    ? `Valgdeltagelse: ${resultData.votesPercentage.toFixed(1)}%`
    : "Valgdeltagelse: Afventer";

  // Mandater i alt
  const totalMandater =
    resultData.totalSeats ||
    (data.parties || []).reduce((sum, p) => sum + (p.seats || 0), 0);
  el("mandater").textContent = `${totalMandater} mandater i alt`;

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

  // Hent partier, sorter efter stemmeprocent, vis kun top 10
  const visPartier = (partier || [])
    .sort((a, b) => b.votesPercentage - a.votesPercentage)
    .slice(0, 10);

  // Find partiet med flest mandater (vindende parti)
  const vindendeParti = [...visPartier].sort((a, b) => b.seats - a.seats)[0];

  // Opret elementer for hvert parti
  visPartier.forEach((parti, i) => {
    const kode = (parti.letter || parti.abbreviation || "").toUpperCase();
    const navn = parti.name || "Ukendt";
    const procent =
      typeof parti.votesPercentage === "number"
        ? parti.votesPercentage.toFixed(1)
        : "0.0";
    const procentDiff =
      typeof parti.votesPercentageChange === "number"
        ? parti.votesPercentageChange.toFixed(1)
        : null;
    const mandater = typeof parti.seats === "number" ? parti.seats : 0;
    const mandaterDiff =
      typeof parti.seatsChange === "number" ? parti.seatsChange : null;
    const color = farve(kode);

    // Opret parti-element
    const elBox = document.createElement("div");
    elBox.className = "parti";
    elBox.dataset.letter = kode;

    // Tilføj vindende-klasse hvis dette er partiet med flest mandater
    if (
      vindendeParti &&
      parti.seats === vindendeParti.seats &&
      parti.seats > 0
    ) {
      elBox.classList.add("vindende");
    }

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
        ${
          procentDiff !== null
            ? `<span class="difference ${
                procentDiff > 0
                  ? "positive"
                  : procentDiff < 0
                  ? "negative"
                  : "neutral"
              }">(${procentDiff > 0 ? "+" : ""}${procentDiff})</span>`
            : ""
        }
      </div>
      <div class="parti-mandater">
        ${mandater} ${mandater === 1 ? "mandat" : "mandater"} 
        ${
          mandaterDiff !== null
            ? `<span class="difference ${
                mandaterDiff > 0
                  ? "positive"
                  : mandaterDiff < 0
                  ? "negative"
                  : "neutral"
              }">(${
                mandaterDiff > 0 ? "+" : mandaterDiff < 0 ? mandaterDiff : "±0"
              })</span>`
            : ""
        }
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
  const sortedPartier = (partier || [])
    .sort((a, b) => b.votesPercentage - a.votesPercentage)
    .slice(0, 10);

  // Opdater hvert parti-element
  partiElements.forEach((partiElement, index) => {
    if (index >= sortedPartier.length) return;

    const parti = sortedPartier[index];
    const partiLetter = partiElement.dataset.letter;

    // Find procent og mandat elementer
    const procentElement = partiElement.querySelector(".parti-procent");
    const mandaterElement = partiElement.querySelector(".parti-mandater");
    const barElement = partiElement.querySelector(".bar");

    if (!procentElement || !mandaterElement || !barElement) return;

    // Tjek om dette parti har ændringer
    const hasChanges = changes.find((c) => c.partyLetter === partiLetter);

    // Opdater værdierne
    const procent =
      typeof parti.votesPercentage === "number"
        ? parti.votesPercentage.toFixed(1)
        : "0.0";

    const procentDiff =
      typeof parti.votesPercentageChange === "number"
        ? parti.votesPercentageChange.toFixed(1)
        : null;

    const mandater = typeof parti.seats === "number" ? parti.seats : 0;

    const mandaterDiff =
      typeof parti.seatsChange === "number" ? parti.seatsChange : null;

    // Opdater procent
    procentElement.innerHTML = `
        ${procent}% 
        ${
          procentDiff !== null
            ? `<span class="difference ${
                procentDiff > 0
                  ? "positive"
                  : procentDiff < 0
                  ? "negative"
                  : "neutral"
              }">(${procentDiff > 0 ? "+" : ""}${procentDiff})</span>`
            : ""
        }
      `;

    // Opdater mandater
    mandaterElement.innerHTML = `
        ${mandater} ${mandater === 1 ? "mandat" : "mandater"} 
        ${
          mandaterDiff !== null
            ? `<span class="difference ${
                mandaterDiff > 0
                  ? "positive"
                  : mandaterDiff < 0
                  ? "negative"
                  : "neutral"
              }">(${
                mandaterDiff > 0 ? "+" : mandaterDiff < 0 ? mandaterDiff : "±0"
              })</span>`
            : ""
        }
      `;

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

      if (hasChanges.seatsChange) {
        mandaterElement.classList.add("parti-data-change");
        setTimeout(() => {
          mandaterElement.classList.remove("parti-data-change");
        }, 1500);
      }
    }
  });
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);
