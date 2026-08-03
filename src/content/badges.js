import Platform, { TOOLBAR_MARKER_CLASS } from "./platform.js";
import { createEditorHandle } from "./editors.js";
import {
  LABELS,
  DECORATIONS,
  createBadgeMarkdown,
  createPlainMarkdown,
} from "./conventional-comments.js";

export {
  LABELS,
  DECORATIONS,
  PLAIN_CC_REGEX,
  BADGE_CC_REGEX,
} from "./conventional-comments.js";

// --- Toolbar selector Constants ---

const TOOLBAR_ID_PREFIX = "conventional-comments-toolbar-";
const SETTINGS_BUTTON_ID_PREFIX = "cc-settings-button-";

// --- Global Counters ---

let toolbarCounter = 0;
let settingsCounter = 0;

// --- Core Function: Update Comment Prefix (Handles Text or Badge) ---

function updateCommentPrefix(toolbar, editor) {
  const type = toolbar.dataset.selectedType;
  const decoration = toolbar.dataset.selectedDecoration;
  const prettified = toolbar.dataset.prettified === "true";

  const markdown = prettified
    ? createBadgeMarkdown(type, decoration)
    : createPlainMarkdown(type, decoration);

  editor.writePrefix(markdown, prettified);
}

// --- Settings UI ---

function createSettingsButton(toolbar, editor) {
  const button = document.createElement("button");
  button.id = `${SETTINGS_BUTTON_ID_PREFIX}${settingsCounter}`;
  button.title = "Toggle prettify";
  button.type = "button";

  button.classList.add("cc-settings-button");
  if (toolbar.dataset.prettified === "true") {
    button.classList.add("cc-settings-button-active");
  }

  button.innerHTML = `
<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 22">
    <path d="M7.375 7.75C7.375 7.84946 7.33549 7.94484 7.26517 8.01517C7.19484 8.08549 7.09946 8.125 7 8.125C6.90054 8.125 6.80516 8.08549 6.73484 8.01517C6.66451 7.94484 6.625 7.84946 6.625 7.75C6.625 7.65055 6.66451 7.55516 6.73484 7.48484C6.80516 7.41451 6.90054 7.375 7 7.375C7.09946 7.375 7.19484 7.41451 7.26517 7.48484C7.33549 7.55516 7.375 7.65055 7.375 7.75ZM7.375 7.75H7M11.125 7.75C11.125 7.84946 11.0855 7.94484 11.0152 8.01517C10.9448 8.08549 10.8495 8.125 10.75 8.125C10.6505 8.125 10.5552 8.08549 10.4848 8.01517C10.4145 7.94484 10.375 7.84946 10.375 7.75C10.375 7.65055 10.4145 7.55516 10.4848 7.48484C10.5552 7.41451 10.6505 7.375 10.75 7.375C10.8495 7.375 10.9448 7.41451 11.0152 7.48484C11.0855 7.55516 11.125 7.65055 11.125 7.75ZM11.125 7.75H10.75M14.875 7.75C14.875 7.84946 14.8355 7.94484 14.7652 8.01517C14.6948 8.08549 14.5995 8.125 14.5 8.125C14.4005 8.125 14.3052 8.08549 14.2348 8.01517C14.1645 7.94484 14.125 7.84946 14.125 7.75C14.125 7.65055 14.1645 7.55516 14.2348 7.48484C14.3052 7.41451 14.4005 7.375 14.5 7.375C14.5995 7.375 14.6948 7.41451 14.7652 7.48484C14.8355 7.55516 14.875 7.65055 14.875 7.75ZM14.875 7.75H14.5M1 10.76C1 12.36 2.123 13.754 3.707 13.987C4.794 14.147 5.892 14.27 7 14.356V19L11.184 14.817C11.3912 14.6107 11.6697 14.4918 11.962 14.485C13.9136 14.437 15.8605 14.2707 17.792 13.987C19.377 13.754 20.5 12.361 20.5 10.759V4.741C20.5 3.139 19.377 1.746 17.793 1.513C15.461 1.17072 13.107 0.99926 10.75 1C8.358 1 6.006 1.175 3.707 1.513C2.123 1.746 1 3.14 1 4.741V10.759V10.76Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/> 
</svg>
`;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const currentState = toolbar.dataset.prettified === "true";
    const newState = !currentState;
    const newStateString = newState.toString();

    toolbar.dataset.prettified = newStateString;

    button.classList.toggle("cc-settings-button-active", newState);

    if (toolbar.dataset.selectedType) {
      updateCommentPrefix(toolbar, editor);
    }
  });

  settingsCounter++;
  return button;
}

// --- Render Toolbar ---

function renderToolbar(toolbar, editor) {
  const state = toolbar.dataset.state || "initial";
  const selectedType = toolbar.dataset.selectedType || null;
  const selectedDecoration = toolbar.dataset.selectedDecoration || null;

  toolbar.innerHTML = "";

  if (state === "initial" || state === "changeType") {
    LABELS.forEach((item) => {
      const button = document.createElement("button");
      button.textContent = item.label;
      button.title = item.desc;
      button.type = "button";
      button.classList.add("cc-button", `cc-button-${item.label}`);

      if (state === "changeType" && item.label === selectedType) {
        button.classList.add("cc-type-selected-highlight");
      }

      button.addEventListener("click", () => {
        const currentSelectedType = toolbar.dataset.selectedType;

        if (currentSelectedType === item.label) {
          toolbar.dataset.selectedType = "";
          toolbar.dataset.selectedDecoration = "";
          toolbar.dataset.state = "initial";

          editor.clearPrefix();
        } else {
          toolbar.dataset.selectedType = item.label;
          toolbar.dataset.selectedDecoration = "";
          toolbar.dataset.state = "typeSelected";

          updateCommentPrefix(toolbar, editor);
        }

        renderToolbar(toolbar, editor);
      });
      toolbar.appendChild(button);
    });
  } else if (state === "typeSelected") {
    const typeLabel = document.createElement("span");
    typeLabel.textContent = selectedType;
    typeLabel.title = `Click to change type from '${selectedType}'`;
    typeLabel.classList.add("cc-selected-type-label");
    typeLabel.dataset.type = selectedType;

    typeLabel.addEventListener("click", () => {
      toolbar.dataset.state = "changeType";
      renderToolbar(toolbar, editor);
    });
    toolbar.appendChild(typeLabel);

    const separator = document.createElement("span");
    separator.textContent = " > ";
    separator.classList.add("cc-separator");
    toolbar.appendChild(separator);

    DECORATIONS.forEach((decItem) => {
      const button = document.createElement("button");
      button.textContent = decItem.label;
      button.title = decItem.desc;
      button.type = "button";
      button.classList.add("cc-button", `cc-button-dec-${decItem.label}`);

      if (decItem.label === selectedDecoration) {
        button.classList.add("cc-decoration-selected-highlight");
      }

      button.addEventListener("click", () => {
        const currentSelectedDecoration = toolbar.dataset.selectedDecoration;

        if (currentSelectedDecoration === decItem.label) {
          toolbar.dataset.selectedDecoration = "";
        } else {
          toolbar.dataset.selectedDecoration = decItem.label;
        }
        updateCommentPrefix(toolbar, editor);

        renderToolbar(toolbar, editor);
      });
      toolbar.appendChild(button);
    });
  }

  const settingsButton = createSettingsButton(toolbar, editor);
  const settingsButtonWrapper = document.createElement("div");
  settingsButtonWrapper.classList.add("cc-toolbar-settings-item");
  settingsButtonWrapper.appendChild(settingsButton);
  toolbar.appendChild(settingsButtonWrapper);
}

// --- Initialize Toolbar for a comment input ---

function initializeToolbarForElement(element) {
  const editor = createEditorHandle(element);

  const elementId =
    element.id ||
    element.name ||
    `cc-textarea-${Math.random().toString(36).substring(2, 9)}`;
  if (!element.id) element.id = elementId;

  const toolbar = document.createElement("div");
  toolbar.id = `${TOOLBAR_ID_PREFIX}${toolbarCounter++}`;
  toolbar.dataset.textareaId = element.id;
  toolbar.classList.add("cc-toolbar");

  const initialState = extractInitialState(editor);
  toolbar.dataset.state = initialState.state;
  toolbar.dataset.selectedType = initialState.label;
  toolbar.dataset.selectedDecoration = initialState.decorator;
  toolbar.dataset.prettified = initialState.prettified;

  toolbar.style.display = "flex";

  renderToolbar(toolbar, editor);

  const mountPoint = editor.getMountPoint();
  mountPoint.parentNode?.insertBefore(toolbar, mountPoint);

  element.classList.add(TOOLBAR_MARKER_CLASS);
}

// --- Detect initial comment input state ---

function extractInitialState(editor) {
  const prefix = editor.readPrefix();

  if (prefix) {
    return {
      state: "typeSelected",
      label: prefix.label ?? "",
      decorator: prefix.decoration ?? "",
      prettified: String(prefix.prettified),
    };
  }

  return {
    state: "initial",
    label: "",
    decorator: "",
    prettified: Platform.settings.get("prettify", "true"),
  };
}

// --- Public: process comment areas ---

function prepareElement(element, placeholder) {
  // Rich text editors render their own placeholder and have no `placeholder`
  // attribute, so only textareas are touched here.
  if (element.tagName === "TEXTAREA") {
    element.placeholder = placeholder;
  }

  const commentBoxContainer = element.closest(".CommentBox-container");
  if (commentBoxContainer) {
    const placeholderElement = commentBoxContainer.querySelector(
      ".CommentBox-placeholder"
    );
    if (placeholderElement) {
      placeholderElement.remove();
    }
  }

  if (!element.id) {
    element.id = `cc-textarea-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)}`;
  }
}

export function processCommentAreas() {
  const query = Platform.strategy.getUnprocessedTextareaQuery();
  const commentAreas = document.querySelectorAll(query);

  commentAreas.forEach((element) => {
    prepareElement(element, "Add your comment here...");
    initializeToolbarForElement(element);
  });
}

// --- Helpers for content.js ---

export function checkAndInitializeAddedTextareas(node) {
  const query = Platform.strategy.getUnprocessedTextareaQuery();
  if (
    node.matches &&
    node.matches(query) &&
    !node.classList.contains(TOOLBAR_MARKER_CLASS)
  ) {
    prepareElement(node, "");
    initializeToolbarForElement(node);
  } else if (node.querySelectorAll) {
    const elements = node.querySelectorAll(query);
    elements.forEach((element) => {
      prepareElement(element, "Add your comment here...");
      initializeToolbarForElement(element);
    });
  }
}
