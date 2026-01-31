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

            // 1. Look for direct images or background images in ancestry
            while (parent && attempts < 5) {
                // Check direct img tags
                const imgs = parent.querySelectorAll('img');
                for (let img of imgs) {
                    // Skip tiny icons, look for decent size
                    if (img.width > 40 && img.height > 40) {
                        image = img.src;
                        break;
                    }
                }

                // Check background images
                if (!image) {
                    const style = window.getComputedStyle(parent);
                    if (style.backgroundImage && style.backgroundImage !== 'none') {
                        const match = style.backgroundImage.match(/url\(["']?([^"']*)["']?\)/);
                        if (match) image = match[1];
                    }
                }

                if (image) break;
                parent = parent.parentElement;
                attempts++;
            }

            // 2. If still no image, look for images in previous sibling (common in list layouts)
            if (!image && a.parentElement) {
                let sibling = a.parentElement.previousElementSibling;
                if (sibling) {
                    const siblingImgs = sibling.querySelectorAll('img');
                    for (let img of siblingImgs) {
                        if (img.width > 40 && img.height > 40) {
                            image = img.src;
                            break;
                        }
                    }
                }
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
