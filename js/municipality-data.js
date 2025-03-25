/**
 * Municipality definitions
 * Mapping between municipality IDs and names
 */
const kommuner = [
  { id: "810", navn: "Brønderslev" },
  { id: "813", navn: "Frederikshavn" },
  { id: "820", navn: "Vesthimmerlands" },
  { id: "825", navn: "Læsø" },
  { id: "840", navn: "Rebild" },
  { id: "846", navn: "Mariagerfjord" },
  { id: "849", navn: "Jammerbugt" },
  { id: "851", navn: "Aalborg" },
  { id: "860", navn: "Hjørring" },
];

/**
 * Get municipality name by ID
 * @param {string} id - Municipality ID
 * @returns {string} - Municipality name
 */
function getKommuneNavn(id) {
  const kommune = kommuner.find((k) => k.id === id);
  return kommune ? kommune.navn : "Ukendt kommune";
}

/**
 * Get municipality by ID
 * @param {string} id - Municipality ID
 * @returns {object|null} - Municipality object or null if not found
 */
function getKommune(id) {
  return kommuner.find((k) => k.id === id) || null;
}
