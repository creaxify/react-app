// content.js - Creaxify WhatsApp Scraper
// Refactored for cleaner logic and better image detection

function getAbsoluteUrl(url) {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    try {
        return new URL(url, document.baseURI).href;
    } catch (e) {
        return null;
    }
}

function findImageInContainer(container) {
    if (!container) return null;

    // Strategy 1: Look for images with 'profile', 'avatar', 'group' or large size
    const imgs = container.querySelectorAll('img');
    for (let img of imgs) {
        // Skip tiny icons (often status icons)
        if (img.width < 40 || img.height < 40) continue;

        // Prioritize lazy loaded sources
        const src = img.getAttribute('data-src') || img.getAttribute('data-original') || img.currentSrc || img.src;

        if (src && !src.includes('svg') && !src.startsWith('data:')) {
            return getAbsoluteUrl(src);
        }
    }

    // Strategy 2: Look for background images
    const elements = [container, ...container.querySelectorAll('div, span, a')];
    for (let el of elements) {
        const style = window.getComputedStyle(el);
        if (style.backgroundImage && style.backgroundImage !== 'none') {
            const match = style.backgroundImage.match(/url\(["']?([^"']*)["']?\)/);
            if (match && match[1]) {
                return getAbsoluteUrl(match[1]);
            }
        }
    }

    return null;
}

function scrapeWhatsAppLinks() {
    const anchors = document.querySelectorAll('a');
    const links = [];
    const seenUrls = new Set();

    anchors.forEach((a) => {
        let url = a.href;

        // 1. Resolve Redirects (Facebook/Instagram wrappers)
        if (url.includes('l.facebook.com') || url.includes('l.instagram.com')) {
            try {
                const target = new URL(url).searchParams.get('u');
                if (target) url = decodeURIComponent(target);
            } catch (e) { }
        }

        // 2. Filter for WhatsApp Group Links
        if (url.includes('chat.whatsapp.com') && !seenUrls.has(url)) {
            seenUrls.add(url);

            let name = a.innerText.trim();
            if (!name || name.includes('http') || name.includes('whatsapp.com')) {
                name = "WhatsApp Group";
            }

            // 3. Find Card Container (Heuristic: Look up 4 levels)
            let container = a.parentElement;
            let bestContainer = null;

            for (let i = 0; i < 4; i++) {
                if (!container) break;
                const cls = (container.className || "").toString().toLowerCase();
                const tag = container.tagName.toLowerCase();

                // High confidence markers
                if (cls.includes('card') || cls.includes('item') || cls.includes('box') || tag === 'li' || tag === 'article') {
                    bestContainer = container;
                    break;
                }
                container = container.parentElement;
            }

            // Fallback to a mid-level parent if no marker found
            if (!bestContainer && a.parentElement && a.parentElement.parentElement) {
                bestContainer = a.parentElement.parentElement;
            }

            // 4. Extract Image
            let image = findImageInContainer(bestContainer);

            // 5. Fallback: Check previous sibling (common in lists: [Img] [Details])
            if (!image && bestContainer && bestContainer.previousElementSibling) {
                image = findImageInContainer(bestContainer.previousElementSibling);
            }

            links.push({
                url: url,
                name: name,
                image: image,
                scrapedAt: new Date().toISOString()
            });
        }
    });

    console.log(`[Scraper] Found ${links.length} links. Images: ${links.filter(l => l.image).length}`);
    return links;
}

// Popup Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape_links") {
        sendResponse({ links: scrapeWhatsAppLinks() });
    }
});

// Handshake for Web Dashboard
window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "REQUEST_EXTENSION_DATA") {
        const allowed = ['creaxify.github.io', 'localhost', '127.0.0.1'];
        if (allowed.some(domain => location.href.includes(domain))) {
            chrome.storage.local.get(['whatsappLinks'], (result) => {
                if (result.whatsappLinks) {
                    window.postMessage({ type: "EXTENSION_DATA", links: result.whatsappLinks }, "*");
                }
            });
        }
    }
});
