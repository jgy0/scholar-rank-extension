chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "srfFetchJson") return false;

  fetch(message.url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

  return true;
});
