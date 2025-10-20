import Platform from "./content/platform.js";
import {
  processCommentAreas,
  checkAndInitializeAddedTextareas,
} from "./content/badges.js";
import {
  checkSlackStatus,
  processThreads,
  checkAndInitializeAddedThreads,
  resetSlackStatus,
} from "./content/slack-threads.js";

// Enhanced initialization with multiple strategies
let isProcessing = false;

function processUiElements() {
  Platform.recheck();

  processCommentAreas();
  if (Platform.settings.get("slack", true))
    checkSlackStatus().then(processThreads);
}

function handleUrlChange() {
  // Reset necessary state
  resetSlackStatus();

  // Process
  isProcessing = false;
  processUiElements();
  setTimeout(processUiElements, 500);
  setTimeout(processUiElements, 1000);
  setTimeout(processUiElements, 2000);
}

// Listen for History API changes
window.addEventListener("popstate", handleUrlChange);
window.addEventListener("pushstate", handleUrlChange);
window.addEventListener("replacestate", handleUrlChange);

// Intercept History API methods
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function () {
  originalPushState.apply(this, arguments);
  handleUrlChange();
};

history.replaceState = function () {
  originalReplaceState.apply(this, arguments);
  handleUrlChange();
};

function main() {
  // Initial load
  processUiElements();

  // Periodic check for new elements
  setInterval(() => {
    if (!isProcessing) {
      const textareas = document.querySelectorAll(
        Platform.strategy.getUnprocessedTextareaQuery()
      );
      if (textareas.length > 0) {
        processCommentAreas();
      }

      if (Platform.settings.get("slack", true)) {
        const threads = document.querySelectorAll(
          Platform.strategy.getUnprocessedThreadQuery()
        );
        if (threads.length > 0) {
          checkSlackStatus().then(processThreads);
        }
      }
    }
  }, 500);

  // Mutation observer
  const observer = new MutationObserver((mutationsList) => {
    if (isProcessing) return;

    isProcessing = true;

    setTimeout(() => {
      try {
        Platform.recheck();

        for (const mutation of mutationsList) {
          if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                checkAndInitializeAddedTextareas(node);
                if (Platform.settings.get("slack", true))
                  checkAndInitializeAddedThreads(node);
              }
            }
          }
        }
      } catch (error) {
        console.error(
          "[Conventional Comments] Error processing DOM mutations:",
          error
        );
      } finally {
        isProcessing = false;
      }
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "id"],
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      processUiElements();
    }
  });
}

Platform.ready().then(main);
