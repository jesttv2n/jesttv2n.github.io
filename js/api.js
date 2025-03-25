/**
 * API functions for KV21 election data
 */

/**
 * Base URL for API requests
 */
const API_BASE_URL = "https://election-api.services.tv2.dk/kv/kv21";

/**
 * Fetch general election results for a municipality
 * @param {string} kommuneId - Municipality ID
 * @returns {Promise<object>} - Election data
 */
async function fetchElectionResults(kommuneId) {
  try {
    const cacheKey = getCacheBuster();
    const url = `${API_BASE_URL}/results/${kommuneId}?_cb=${cacheKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    log(`Error fetching election results: ${error.message}`, "error");
    throw error;
  }
}

/**
 * Fetch polling station results
 * @param {string} kommuneId - Municipality ID
 * @param {string} valgstedId - Polling station ID
 * @returns {Promise<object>} - Polling station data
 */
async function fetchPollingStationResults(kommuneId, valgstedId) {
  try {
    const cacheKey = getCacheBuster();
    const url = `${API_BASE_URL}/results/${kommuneId}/${valgstedId}?_cb=${cacheKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    log(`Error fetching polling station results: ${error.message}`, "error");
    throw error;
  }
}

/**
 * Fetch candidate data for a municipality
 * @param {string} kommuneId - Municipality ID
 * @returns {Promise<object>} - Candidate data
 */
async function fetchCandidateData(kommuneId) {
  try {
    const cacheKey = getCacheBuster();
    const url = `${API_BASE_URL}/areastatus/${kommuneId}?_cb=${cacheKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    log(`Error fetching candidate data: ${error.message}`, "error");
    throw error;
  }
}

/**
 * Compare two datasets and return changes
 * @param {object} oldData - Previous data
 * @param {object} newData - New data
 * @returns {Array} - List of changes
 */
function findDataChanges(oldData, newData) {
  if (!oldData || !oldData.parties || !newData || !newData.parties) {
    return [];
  }

  const changes = [];

  // Map oldData parties for easier lookup
  const oldParties = {};
  oldData.parties.forEach((party) => {
    oldParties[party.letter || party.abbreviation] = party;
  });

  // Check each party in new data
  newData.parties.forEach((newParty) => {
    const letter = newParty.letter || newParty.abbreviation;
    const oldParty = oldParties[letter];

    if (oldParty) {
      // Check if percentages, votes or seats have changed
      const percentChange =
        oldParty.votesPercentage !== newParty.votesPercentage;
      const votesChange = oldParty.votes !== newParty.votes;
      const seatsChange = oldParty.seats !== newParty.seats;

      if (percentChange || votesChange || seatsChange) {
        changes.push({
          partyLetter: letter,
          percentChange,
          votesChange,
          seatsChange: seatsChange || false,
        });
      }
    }
  });

  return changes;
}
