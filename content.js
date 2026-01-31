// content.js
// Scrapes WhatsApp group links from the current page

function scrapeWhatsAppLinks() {
    // Grab all links to check for redirects too
    const anchors = document.querySelectorAll('a');
    const links = [];

    anchors.forEach((a) => {
        let url = a.href;

        // Handle Facebook/Instagram redirects
        if (url.includes('l.facebook.com') || url.includes('l.instagram.com')) {
            try {
                const urlObj = new URL(url);
                const target = urlObj.searchParams.get('u');
                if (target) {
                    url = decodeURIComponent(target);
                }
            } catch (e) {
                // ignore parsing errors
            }
        }

        // Only proceed if it is a WhatsApp group link
        if (url.includes('chat.whatsapp.com')) {
            let name = a.innerText.trim();
            // If name is just the URL or empty, use default
            if (!name || name.includes('http') || name.includes('whatsapp.com')) {
                name = "WhatsApp Group";
            }

            // Try to find a preview image near the link
            let image = null;
            let parent = a.parentElement;
            let attempts = 0;
            // Search up to 6 levels up to find a container
            while (parent && attempts < 6) {
                // Check for img tags
                const imgs = parent.querySelectorAll('img');
                for (let img of imgs) {
                    if (img.width > 30 && img.height > 30) {
                        image = img.src;
                        break;
                    }
                }
                // Check for divs with background image
                if (!image) {
                    const divs = parent.querySelectorAll('div, span');
                    for (let div of divs) {
                        const style = window.getComputedStyle(div);
                        if (style.backgroundImage && style.backgroundImage !== 'none') {
                            // Extract url(...)
                            const match = style.backgroundImage.match(/url\(["']?([^"']*)["']?\)/);
                            if (match) {
                                image = match[1];
                                break;
                            }
                        }
                    }
                }

                if (image) break;
                parent = parent.parentElement;
                attempts++;
            }

            links.push({
                url: url,
                name: name,
                image: image,
                scrapedAt: new Date().toISOString()
            });
        }
    });

    return links;
}

// Msg listener to trigger scrape from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape_links") {
        const links = scrapeWhatsAppLinks();
        sendResponse({ links: links });
    }
});

// Handshake: Listen for website request
window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "REQUEST_EXTENSION_DATA") {
        if (location.href.includes('creaxify.github.io') || location.href.includes('localhost')) {
            chrome.storage.local.get(['whatsappLinks'], (result) => {
                if (result.whatsappLinks) {
                    window.postMessage({ type: "EXTENSION_DATA", links: result.whatsappLinks }, "*");
                }
            });
        }
    }
});
