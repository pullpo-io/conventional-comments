// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Validate sender is this chrome extension
  if (sender.id !== chrome.runtime.id) {
    return false; // Ignore this message
  }

  // Assume all messages contain at least the 'type' field

  switch (request.type) {
    case "OPEN_POPUP":
      handleOpenPopup(request).then(sendResponse);
      return true;
    case "GET_GITHUB_ORG_ID":
      handleGetGithubOrgId(request).then(sendResponse);
      return true;
    case "GET_PR_SLACK_STATUS":
      handleGetPrSlackStatus(request).then(sendResponse);
      return true;
    case "GET_SLACK_REDIRECT_URL":
      handleGetSlackRedirectUrl(request).then(sendResponse);
      return true;
    default:
      sendResponse({ error: "Unrecognized message" });
      return true;
  }
});

async function handleOpenPopup(request) {
  return new Promise((resolve) => {
    chrome.action.setPopup({ popup: request.path }, () => {
      try {
        chrome.action.openPopup({}, () => {
          setTimeout(() => {
            // Reset popup to default behavior after small delay, ensuring new popup has time to render
            chrome.action.setPopup({ popup: "popups/default.html" });
          }, 300);
          resolve({ success: true });
        });
      } catch {
        // Reset popup to default behavior immediately
        chrome.action.setPopup({ popup: "popups/default.html" });
        resolve({ error: "API_UNAVAILABLE" });
      }
    });
  });
}

async function handleGetGithubOrgId(request) {
  const apiUrl = `https://api.github.com/orgs/${request.slug}`;

  try {
    const data = await fetch(apiUrl).then((response) => response.json());
    if (data.id) {
      return { id: data.id };
    } else {
      return { error: "Organization not found or API error" };
    }
  } catch (error) {
    return { error: error.message };
  }
}

async function handleGetPrSlackStatus(request) {
  const apiUrl =
    "https://api.pullpo.io/ext/conventional-comments/slack-status" +
    `?domain=${request.domain}` +
    `&organization=${request.organization}` +
    `&repository=${request.repository}` +
    `&number=${request.number}` +
    `&requester_id=${request.requester_id}`;

  try {
    const data = await fetch(apiUrl).then((response) => response.json());
    return { status: data.status, key: data.key };
  } catch (error) {
    return { error: error.message };
  }
}

async function handleGetSlackRedirectUrl(request) {
  const apiUrl =
    "https://api.pullpo.io/ext/conventional-comments/slack-redirect" +
    `?key=${request.key}` +
    `&thread_id=${request.thread_id}` +
    `&requester_id=${request.requester_id}`;

  try {
    const data = await fetch(apiUrl).then((response) => response.json());
    return { redirect_url: data.redirect_url };
  } catch (error) {
    return { error: error.message };
  }
}
