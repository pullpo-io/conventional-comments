// Extract org parameter from URL or data attribute (for fallback modal)
function getOrgFromUrl(root) {
  // Check if we're in a fallback modal context with data-query-params
  if (root.dataset.queryParams) {
    const urlParams = new URLSearchParams(root.dataset.queryParams);
    return urlParams.get("org") || "";
  }

  // Otherwise, use window.location.search (native popup context)
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("org") || "";
}

// Check if we're in fallback modal context
function isInFallbackModal() {
  return document.getElementById("cc-modal-container") !== null;
}

// Close popup (handles both native popup and fallback modal)
function closePopup() {
  if (isInFallbackModal()) {
    // In fallback modal - click the close button
    const modalContainer = document.getElementById("cc-modal-container");
    if (modalContainer && modalContainer.shadowRoot) {
      const closeBtn = modalContainer.shadowRoot.querySelector(".close-btn");
      if (closeBtn) {
        closeBtn.click();
      }
    }
  } else {
    // In native popup - close the window
    window.close();
  }
}

function attachListeners(root) {
  const orgSlug = getOrgFromUrl(root);

  // Learn More button
  const learnMoreBtn = root.querySelector("#learn-more-btn");
  if (learnMoreBtn) {
    learnMoreBtn.addEventListener("click", () => {
      const url = `https://pullpo.io/pr-channels-from-cc?org=${encodeURIComponent(
        orgSlug
      )}`;
      window.open(url, "_blank");
      closePopup();
    });
  }

  // Watch Demo button
  const watchDemoBtn = root.querySelector("#watch-demo-btn");
  if (watchDemoBtn) {
    watchDemoBtn.addEventListener("click", () => {
      // Add demo parameter to trigger video modal automatically
      const url = `https://pullpo.io/pr-channels-from-cc?org=${encodeURIComponent(
        orgSlug
      )}&demo=true`;
      window.open(url, "_blank");
      closePopup();
    });
  }

  // Disable Slack buttons
  const disableSlackBtn = root.querySelector("#disable-slack-btn");
  if (disableSlackBtn) {
    disableSlackBtn.addEventListener("click", () => {
      // Save setting to disable Slack threads
      chrome.storage.local.set({ slack: false }, () => {
        closePopup();
      });
    });
  }

  // Join new integrations Waitlist button
  const newIntegrationsBtn = root.querySelector("#new-integrations-btn");
  if (newIntegrationsBtn) {
    newIntegrationsBtn.addEventListener("click", () => {
      const url = "https://pullpo.io/new-integrations";
      window.open(url, "_blank");
    });
  }
}

// Exported initialization function for fallback modal
export function initialize() {
  let root = document.getElementById("cc-popup-body");
  if (root === null) {
    root = document
      .getElementById("cc-modal-container")
      ?.shadowRoot?.getElementById("cc-popup-body");
  }

  if (root) {
    attachListeners(root);
  }
}

// Auto-initialize for native popup
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
