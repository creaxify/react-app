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
            let container = null;
            let attempts = 0;

            // 1. Identify a likely container (Card, Item, or List Element)
            while (parent && attempts < 6) {
                const tag = parent.tagName.toLowerCase();
                const cls = parent.className ? parent.className.toString().toLowerCase() : "";

                // Common container markers
                if (tag === 'article' || tag === 'li' ||
                    cls.includes('card') || cls.includes('item') || cls.includes('box') ||
                    cls.includes('entry') || cls.includes('post') ||
                    (parent.style.border && parent.style.border !== 'none') ||
                    (parent.style.boxShadow && parent.style.boxShadow !== 'none')) {
                    container = parent;
                    break;
                }
                parent = parent.parentElement;
                attempts++;
            }

            // Fallback: if no specific container found, use the 3rd parent (heuristic)
            if (!container && a.parentElement && a.parentElement.parentElement) {
                container = a.parentElement.parentElement.parentElement;
            } else if (!container) {
                container = a.parentElement; // Worst case
            }

            // 2. Search for images within the container
            if (container) {
                // Check all images
                const imgs = container.querySelectorAll('img');
                for (let img of imgs) {
                    // Check various sources for lazy loading
                    const src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original');

                    if (src && !src.includes('data:image/svg') && !src.includes('base64')) {
                        // Accept if reasonable size OR if it looks like a profile/group icon
                        if ((img.width > 30 && img.height > 30) || (img.className.includes('avatar') || img.className.includes('icon'))) {
                            image = src;
                            break;
                        }
                    }
                }

                // Check background image on container or children
                if (!image) {
                    const elems = [container, ...container.querySelectorAll('div, span, a')];
                    for (let el of elems) {
                        const style = window.getComputedStyle(el);
                        if (style.backgroundImage && style.backgroundImage !== 'none') {
                            const match = style.backgroundImage.match(/url\(["']?([^"']*)["']?\)/);
                            if (match && match[1] && !match[1].includes('gradient')) {
                                image = match[1];
                                break;
                            }
                        }
                    }
                }
            }

            // Ensure absolute URL
            if (image && !image.startsWith('http') && !image.startsWith('data:')) {
                try {
                    image = new URL(image, document.baseURI).href;
                } catch (e) {
                    image = null;
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

    console.log(`[Scraper] Found ${links.length} links. Images found: ${links.filter(l => l.image).length}`);
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
