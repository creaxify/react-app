document.getElementById('grabBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.textContent = "Scanning...";

    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
        status.textContent = "Error: No active tab.";
        return;
    }

    // Inject content script if not already present (failsafe)
    // or just try to send message. We'll try scripting.executeScript first
    // to ensure content.js functionality is available.

    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });

        // After injection, we can ask it to scrape effectively
        // But content.js injection essentially runs the file. 
        // We updated content.js to define a function but not auto-run it 
        // unless named strictly.
        // Actually, let's use sendMessage for cleaner communication 
        // if we assume content script acts as a listener.
        // However, executeScript returns the result of the last expression too.
        // Let's modify content.js to just RETURN the links if we rely on executeScript return value
        // OR we use sendMessage. 

        // Approach: Send message. content.js listener handles it.
        chrome.tabs.sendMessage(tab.id, { action: "scrape_links" }, (response) => {
            // Handle connection error (if script wasn't ready)
            if (chrome.runtime.lastError) {
                // If message fails, maybe script wasn't there?
                // executeScript above should have placed it.
                status.textContent = "Error: " + chrome.runtime.lastError.message;
                return;
            }

            if (response && response.links) {
                const newLinks = response.links;
                const count = newLinks.length;

                if (count === 0) {
                    status.textContent = "No WhatsApp links found.";
                } else {
                    // Save to storage
                    chrome.storage.local.get(['whatsappLinks'], (result) => {
                        const existing = result.whatsappLinks || [];
                        // Simple de-duplication by URL
                        const existingUrls = new Set(existing.map(l => l.url));
                        const uniqueNew = newLinks.filter(l => !existingUrls.has(l.url));

                        const updated = [...existing, ...uniqueNew];

                        chrome.storage.local.set({ whatsappLinks: updated }, () => {
                            status.textContent = `Found ${count} links! (${uniqueNew.length} new)`;
                        });
                    });
                }
            } else {
                status.textContent = "Unknown response.";
            }
        });

    } catch (err) {
        status.textContent = "Error: " + err.message;
    }
});

document.getElementById('openDashboard').addEventListener('click', () => {
    // Open the React App (index.html) in a new tab
    chrome.tabs.create({ url: 'index.html' });
});
