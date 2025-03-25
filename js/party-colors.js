/**
 * Party color mapping
 * Maps party letter/abbreviation to color hex codes
 */
const partiFarver = {
  A: "#e4002b", // Socialdemokratiet
  B: "#0085c7", // Radikale Venstre
  C: "#00a95c", // Konservative
  D: "#f58220", // Nye Borgerlige
  E: "#0085ca", // Klaus Riskær
  F: "#d71440", // SF
  G: "#005221", // Veganerpartiet
  I: "#ffc20e", // Liberal Alliance
  K: "#004b87", // Kristendemokraterne
  L: "#2cac2a", // Lokallisterne (generisk)
  M: "#522d80", // Moderaterne
  O: "#e3006e", // Dansk Folkeparti
  P: "#099d84", // Stram Kurs
  Q: "#7bc143", // Frie Grønne
  V: "#1e1e1e", // Venstre
  Ø: "#c00", // Enhedslisten
  Å: "#6a0dad", // Alternativet
};

// Add lowercase variants
Object.keys(partiFarver).forEach(
  (k) => (partiFarver[k.toLowerCase()] = partiFarver[k])
);

/**
 * Get color for party letter
 * @param {string} bogstav - Party letter/abbreviation
 * @returns {string} - Hex color code
 */
function farve(bogstav) {
  return partiFarver[bogstav] || "#888";
}
