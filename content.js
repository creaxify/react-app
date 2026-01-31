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

            // 3. Find Card Container (Visual Proximity Strategy)
            let container = a.parentElement;
            let bestContainer = null;

            // Go up until we find a block that looks like a card (has multiple children or is a list item)
            for (let i = 0; i < 6; i++) {
                if (!container || container.tagName === 'BODY') break;

                // If this element has an image AND text, it's a strong candidate
                if (container.querySelector('img') && container.innerText.length > 10) {
                    bestContainer = container;
                }

                // Special case: list items or articles are almost always the container
                if (container.tagName === 'LI' || container.tagName === 'ARTICLE' || container.style.border || container.style.boxShadow) {
                    bestContainer = container;
                    break;
                }

                container = container.parentElement;
            }

            // Fallback: Just use the 3rd parent (usually safe for grid layotus)
            if (!bestContainer && a.parentElement && a.parentElement.parentElement) {
                bestContainer = a.parentElement.parentElement.parentElement;
            }

            // 4. Extract Name (Aggressive Text Analysis)
            const genericTerms = ['join chat', 'join group', 'whatsapp group', 'link', 'group invite', 'follow'];
            const isGeneric = (n) => !n || genericTerms.some(term => n.toLowerCase().includes(term)) || n.length < 3;

            if (isGeneric(name) && bestContainer) {
                // Get all text nodes or block elements
                const lines = bestContainer.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                // Prioritize lines that:
                // 1. Are NOT the URL
                // 2. Are NOT generic terms
                // 3. Are reasonably short (likely a title)
                for (let line of lines) {
                    if (!line.includes('http') && !isGeneric(line) && line.length < 60) {
                        name = line;
                        break;
                    }
                }
            }

            // 5. Extract Image (Deep Search)
            let image = findImageInContainer(bestContainer);

            // 6. Last Resort: Look for ANY image near this link in the DOM tree
            if (!image && bestContainer) {
                // Check closest image relative to the link (up or down siblings)
                const allImages = [...document.querySelectorAll('img')];
                // Sort by distance in DOM
                const closest = allImages.sort((aImg, bImg) => {
                    const distA = Math.abs(aImg.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    const distB = Math.abs(bImg.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    return distA - distB;
                })[0];

                if (closest) {
                    // Only accept if it's visually close (within 300px)
                    const dist = Math.abs(closest.getBoundingClientRect().top - a.getBoundingClientRect().top);
                    if (dist < 300 && closest.width > 40) {
                        const src = closest.currentSrc || closest.src;
                        if (src) image = getAbsoluteUrl(src);
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
