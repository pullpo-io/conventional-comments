import Platform, { SLACK_LINK_MARKER_CLASS } from "./platform.js";
import Popup from "./popup.js";

const SLACK_THREAD_BUTTON_MARKER_CLASS = "cc-slack-button-marker";

let prIdentifier = "";
let slackStatus = ""; // PENDING, UNAVAILABLE, NOT_INSTALLED, NOT_TRACKED, AVAILABLE
let slackRedirectKey = ""; // Cached on Slack status check
let slackRequesterId = ""; // Cached on Slack status check: unnecessary to look it up at thread UI processing

export async function checkSlackStatus() {
  // Prevent duplicates
  if (slackStatus == "PENDING") return slackStatus;

  const newPrIdentifier = Platform.strategy.getPullRequestIdentifier();
  if (slackStatus != "" && prIdentifier == newPrIdentifier) {
    return slackStatus; // This PR was already checked and executing this function would make no difference
  }

  // Start the check
  slackStatus = "PENDING";
  prIdentifier = newPrIdentifier;

  try {
    const params = await Platform.strategy.extractSlackStatusCheckParams();
    slackRequesterId = params.requester_id;

    const response = await chrome.runtime.sendMessage({
      type: "GET_PR_SLACK_STATUS",
      domain: window.location.hostname,
      organization: params.organization,
      repository: params.repository,
      number: params.number,
      requester_id: params.requester_id,
    });

    if (response.error) {
      console.error(response.error);
      slackStatus = "UNAVAILABLE";
      return slackStatus;
    }

    slackStatus = response.status ?? "";
    slackRedirectKey = response.key ?? "";
  } catch {
    slackStatus = "UNAVAILABLE";
  }

  return slackStatus;
}

export async function resetSlackStatus() {
  const newPrIdentifier = Platform.strategy.getPullRequestIdentifier();
  if (prIdentifier != newPrIdentifier) {
    // Only reset values if old ones belonged to a different PR
    slackStatus = "";
    slackRedirectKey = "";
    slackRequesterId = "";
  }
}

export function processThreads() {
  if (!slackStatus || slackStatus == "PENDING") return;

  const threads = document.querySelectorAll(
    Platform.strategy.getUnprocessedThreadQuery()
  );
  threads.forEach(initializeSlackLinkForThread);
}

function initializeSlackLinkForThread(threadElement) {
  if (
    !slackStatus ||
    slackStatus == "PENDING" ||
    slackStatus == "UNAVAILABLE" ||
    slackStatus == "NOT_TRACKED" ||
    threadElement.classList.contains(SLACK_LINK_MARKER_CLASS)
  )
    return;

  // Skip new comment creation boxes - they should not have Slack buttons
  if (
    threadElement.hasAttribute("data-marker-navigation-new-thread") ||
    threadElement.getAttribute("data-marker-id") === "new-comment"
  ) {
    return;
  }

  // Skip collapsed comments - they should not have Slack buttons (new GitHub experience only)
  // Look for chevron-right icon (collapsed state)
  const hasChevronRight = threadElement.querySelector(".octicon-chevron-right");
  if (hasChevronRight) {
    return;
  }

  threadElement.classList.add(SLACK_LINK_MARKER_CLASS);

  (async () => {
    if (slackStatus == "NOT_INSTALLED") {
      const slackButton = createSlackRedirectButton(null);
      return Platform.strategy.insertThreadSlackRedirectButton(
        threadElement,
        slackButton
      );
    }

    if (slackStatus != "AVAILABLE") return false;

    const threadId =
      Platform.strategy.getThreadIdFromThreadElement(threadElement);
    if (!threadId) {
      return false;
    }

    const response = await chrome.runtime.sendMessage({
      type: "GET_SLACK_REDIRECT_URL",
      key: slackRedirectKey,
      thread_id: threadId,
      requester_id: slackRequesterId,
    });

    if (response.error) {
      console.error("SLACK URL error:", response.error);
      return false;
    }

    if (!response.redirect_url) return false;

    const slackButton = createSlackRedirectButton(response.redirect_url);
    return Platform.strategy.insertThreadSlackRedirectButton(
      threadElement,
      slackButton
    );
  })().then((inserted) => {
    if (!inserted) threadElement.classList.remove(SLACK_LINK_MARKER_CLASS);
  });
}

function createSlackRedirectButton(url) {
  let button;

  if (url !== null) {
    button = document.createElement("a");
    button.href = url;
    button.target = "_blank";
    button.rel = "noopener noreferrer";
  } else {
    button = document.createElement("button");
    button.addEventListener("click", (event) => {
      // Stop propagation to avoid triggering underlying components
      event.stopPropagation();
      event.preventDefault();
      Popup.open(
        `/popups/install-pullpo.html?org=${encodeURIComponent(
          window.location.pathname.split("/")[1]
        )}`
      );
    });
  }

  button.className =
    Platform.strategy.getSlackThreadButtonClassName() +
    " " +
    SLACK_THREAD_BUTTON_MARKER_CLASS;
  button.style.textDecoration = "none";

  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("assets/slack_icon.svg");
  icon.style.height = "16px";
  icon.style.width = "16px";
  icon.style.marginRight = "4px";
  icon.style.verticalAlign = "text-bottom";

  const buttonText = document.createElement("span");
  buttonText.textContent = "Open in Slack";

  button.appendChild(icon);
  button.appendChild(buttonText);

  return button;
}

export function checkAndInitializeAddedThreads(node) {
  const query = Platform.strategy.getUnprocessedThreadQuery();
  if (
    node.matches &&
    node.matches(query) &&
    !node.classList.contains(SLACK_LINK_MARKER_CLASS)
  ) {
    initializeSlackLinkForThread(node);
  } else if (node.querySelectorAll) {
    const threadElements = node.querySelectorAll(query);
    threadElements.forEach((threadElement) => {
      initializeSlackLinkForThread(threadElement);
    });
  }
}

document.addEventListener("platformSettingsChanged", (event) => {
  const { changes } = event.detail; // Extract the data from the event

  // In the case where threads are re-enabled, the timer on content.js will render them within 1 second
  if (changes.hasOwnProperty("slack") && !changes.slack.newValue) {
    // Remove all Slack buttons by their class markers
    const slackButtonClass = Platform.strategy.getSlackThreadButtonClassName();
    const slackButtons = document.querySelectorAll(
      `.${SLACK_THREAD_BUTTON_MARKER_CLASS}`
    );
    slackButtons.forEach((button) => button.remove());

    // Remove the marker class from all thread button containers
    const markedThreads = document.querySelectorAll(
      `.${SLACK_LINK_MARKER_CLASS}`
    );
    markedThreads.forEach((thread) => {
      thread.classList.remove(SLACK_LINK_MARKER_CLASS);
    });
  }
});
