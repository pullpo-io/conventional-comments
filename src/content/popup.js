export default Popup = {
  async open(path) {
    const result = await chrome.runtime.sendMessage({
      type: "OPEN_POPUP",
      path,
    });

    if (result && result.error == "API_UNAVAILABLE") {
      openFallbackModal(path);
    }
  },
};

async function openFallbackModal(path) {
  const MODAL_ID = "cc-modal-container";

  // Remove existing modal if present to ensure fresh state
  const existing = document.getElementById(MODAL_ID);
  if (existing) {
    existing.remove();
  }

  // Extract query parameters from path
  const [pathWithoutQuery, queryString] = path.split("?");

  // Fetch the HTML first
  const htmlResponse = await fetch(chrome.runtime.getURL(pathWithoutQuery));
  let htmlContent = await htmlResponse.text();

  // Replace all relative paths in src and href attributes with chrome.runtime.getURL
  htmlContent = htmlContent.replace(
    /(?:src|href)=["'](?!https?:\/\/|chrome-extension:\/\/|moz-extension:\/\/)([^"']+)["']/g,
    (match, path) => {
      const fullPath = chrome.runtime.getURL(path);
      return match.replace(path, fullPath);
    }
  );

  // Parse HTML to extract stylesheets from <head>
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // Extract all stylesheet links from <head>
  const linkTags = doc.head.querySelectorAll('link[rel="stylesheet"]');
  const stylesheetUrls = Array.from(linkTags).map((link) =>
    link.getAttribute("href")
  );

  // Fetch all stylesheets in parallel
  const cssResponses = await Promise.all(
    stylesheetUrls.map((url) => fetch(url))
  );

  // Get all CSS content and concatenate
  const cssContents = await Promise.all(
    cssResponses.map((response) => response.text())
  );
  const cssContent = cssContents.join("\n\n");

  const ccIcon = chrome.runtime.getURL("assets/cc_icon.png");
  const popupBody = doc.body.innerHTML;
  const bodyClasses = doc.body.className || "";

  const modalHost = document.createElement("div");
  modalHost.id = MODAL_ID;
  document.body.appendChild(modalHost);

  const shadowRoot = modalHost.attachShadow({ mode: "open" });

  // Since the common styling `style.css` is found inside the <head> tag, and here we extract the popup's <body>
  // we need to inject it along with the styling of the modal itself.
  shadowRoot.innerHTML = `
        <style>
        ${cssContent}

        :host {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 2147483647;
            display: flex; justify-content: end; align-items: top;
            padding-top: 5px; padding-right: 40px;
            font-family: 'Inter', sans-serif;
        }
        .modal-content {
            pointer-events: auto;
            position: relative; width: 430px; overflow: hidden;
            border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .cc-icon {
            position: absolute; top: 10px; left: 10px;
            width: 24px; height: 24px;
        }
        .close-btn {
            position: absolute; top: 8px; right: 8px; border: none;
            aspect-ratio: 1; padding: 0 5px 2px; border-radius: 4px;
            background: none; font-size: 18px; font-weight: 200;
            cursor: pointer; color: #64748b;
        }
        .close-btn:hover {
            background: #1e293b;
        }
        </style>
        <div id="modal-overlay">
            <div class="modal-content">
                <img src="${ccIcon}" class="cc-icon" />
                <button class="close-btn" title="Close">&times;</button>
                <div id="cc-popup-body" class="${bodyClasses}" style="width: auto; padding-top: 45px" ${
                  queryString ? `data-query-params="${queryString}"` : ""
                }>
                    ${popupBody}
                </div>
            </div>
        </div>
    `;

  // The fallback modal won't load the scripts automatically, we need to load them within the extention's
  // environment (here) "manually"
  const scriptTags = doc.querySelectorAll("script");
  for (const scriptTag of scriptTags) {
    if (!scriptTag.src) {
      continue;
    }

    const scriptSrc = scriptTag.getAttribute("src");
    const module = await import(scriptSrc);

    // Call the initialize function if the module exports one
    if (module.initialize && typeof module.initialize === "function") {
      module.initialize();
    }
  }

  const closeModal = () => {
    // Remove the global listener to prevent memory leaks
    document.removeEventListener("click", handleOutsideClick);
    modalHost.remove();
  };

  const handleOutsideClick = (event) => {
    // If our modalHost is NOT in that path, the click was outside.
    if (!event.composedPath().includes(modalHost)) {
      closeModal();
    }
  };

  shadowRoot.querySelector(".close-btn").addEventListener("click", closeModal);

  // Add the global listener for clicks outside the modal
  // A small timeout ensures this listener is added after the current click event cycle is complete
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick);
  }, 10);
}
