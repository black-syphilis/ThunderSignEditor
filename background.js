// When the extension icon is clicked, open a popup window
browser.browserAction.onClicked.addListener(() => {
  browser.windows.create({
    url: browser.runtime.getURL("popup.html"), // Open the popup HTML file
    type: "popup",
    width: 600,
    height: 500
  });
});

// Listener for messages from the popup or other scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle identity list request
  if (message.action === "getIdentities") {
    browser.identities.list().then(identities => {
      sendResponse({ success: true, identities: identities }); // Return identity list
    }).catch(error => {
      sendResponse({ success: false, error: error.message }); // Return error message
    });
    return true; // Keep the message channel open
  }

  // Handle identity signature update
  if (message.action === "updateSignature") {
    browser.identities.update(
      message.id,
      { signature: message.html, signatureIsPlainText: false }
    ).then(() => {
      sendResponse({ success: true }); // Signature updated successfully
    }).catch(error => {
      sendResponse({ success: false, error: error.message }); // Error during update
    });
    return true; // Keep the message channel open
  }
});
