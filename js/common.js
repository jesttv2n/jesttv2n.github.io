/**
 * Utility functions for KV21 visualization system
 */

/**
 * Shorthand for getting document elements by ID
 * @param {string} id - Element ID
 * @returns {Element} - DOM element
 */
const el = (id) => document.getElementById(id);

/**
 * Format number with thousands separator
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Get URL parameter value
 * @param {string} name - Parameter name
 * @returns {string|null} - Parameter value or null if not found
 */
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Logger helper function
 * Logs message to console and optionally to a log container if it exists
 * @param {string} message - Message to log
 * @param {string} type - Log type (info, error, warning)
 */
function log(message, type = "info") {
  // Log to console
  if (type === "error") {
    console.error(message);
  } else if (type === "warning") {
    console.warn(message);
  } else {
    console.log(message);
  }

  // Log to UI if log container exists
  const logContainer = el("logContainer");
  if (logContainer) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();

    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";
    logEntry.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-message ${
        type === "error" ? "log-error" : ""
      }">${message}</span>
    `;

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Limit number of log entries
    while (logContainer.children.length > 100) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }
}

/**
 * Generate current timestamp to use as cache buster
 * @returns {number} - Current timestamp
 */
function getCacheBuster() {
  return Date.now();
}

/**
 * Fade in element animation
 * @param {Element} element - Element to fade in
 * @param {number} duration - Animation duration in ms
 */
function fadeIn(element, duration = 300) {
  element.style.opacity = 0;
  element.style.display = "block";

  let start = null;
  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    element.style.opacity = Math.min(progress / duration, 1);

    if (progress < duration) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
}

/**
 * Fade out element animation
 * @param {Element} element - Element to fade out
 * @param {number} duration - Animation duration in ms
 * @param {Function} callback - Callback function after animation completes
 */
function fadeOut(element, duration = 300, callback = null) {
  element.style.opacity = 1;

  let start = null;
  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    element.style.opacity = Math.max(1 - progress / duration, 0);

    if (progress < duration) {
      window.requestAnimationFrame(step);
    } else {
      element.style.display = "none";
      if (callback) callback();
    }
  }

  window.requestAnimationFrame(step);
}
