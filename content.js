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

            // Go up until we find a block that looks like a card
            for (let i = 0; i < 6; i++) {
                if (!container || container.tagName === 'BODY') break;

                // A container usually determines layout (grid/flex) or has a border/shadow
                const style = window.getComputedStyle(container);
                if (container.tagName === 'LI' || container.tagName === 'ARTICLE' ||
                    style.borderWidth !== '0px' || style.boxShadow !== 'none' ||
                    style.display === 'grid' || (style.display === 'flex' && container.innerText.length > 50)) {
                    bestContainer = container;
                    // Keep going up one more level just in case we are in a 'content wrapper' inside the card
                    // But if this one has an image, it's likely the one
                    if (container.querySelector('img')) break;
                }
                container = container.parentElement;
            }

            // Fallback: Use 3rd parent
            if (!bestContainer && a.parentElement && a.parentElement.parentElement) {
                bestContainer = a.parentElement.parentElement.parentElement;
            }

            // 4. Extract Name (Visual Dominance Strategy)
            // The Group Name is likely the text with the LARGEST font size in the container
            if (bestContainer) {
                const allElements = bestContainer.querySelectorAll('*');
                let maxFontSize = 0;
                let bestNameCandidates = [];

                // generic terms to ignore
                const genericTerms = ['join', 'chat', 'group', 'whatsapp', 'link', 'invite', 'share', 'follow'];

                allElements.forEach(el => {
                    // Skip hidden or non-text elements
                    if (!el.innerText || el.innerText.trim().length < 3) return;
                    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'NOSCRIPT') return;

                    // Check direct text content of this node (approximate)
                    const text = el.childNodes[0] && el.childNodes[0].nodeType === 3 ? el.childNodes[0].nodeValue.trim() : "";
                    if (!text) return;

                    if (genericTerms.some(t => text.toLowerCase().includes(t)) || text.includes('http')) return;

                    const style = window.getComputedStyle(el);
                    const fontSize = parseFloat(style.fontSize);

                    if (fontSize > maxFontSize) {
                        maxFontSize = fontSize;
                        bestNameCandidates = [text];
                    } else if (fontSize === maxFontSize) {
                        bestNameCandidates.push(text);
                    }
                });

                if (bestNameCandidates.length > 0) {
                    name = bestNameCandidates[0]; // Take the first largest text
                }
            }

            // 5. Extract Image (Visual Dominance Strategy)
            // The preview image is likely the LARGEST image in the container
            let image = null;
            if (bestContainer) {
                const imgs = bestContainer.querySelectorAll('img');
                let maxArea = 0;

                imgs.forEach(img => {
                    const rect = img.getBoundingClientRect();
                    const area = rect.width * rect.height;

                    // Skip tiny icons (must be at least 40x40)
                    if (rect.width < 40 || rect.height < 40) return;

                    if (area > maxArea) {
                        const src = img.currentSrc || img.src || img.getAttribute('data-src');
                        if (src && !src.includes('svg') && !src.startsWith('data:')) {
                            maxArea = area;
                            image = getAbsoluteUrl(src);
                        }
                    }
                });

                // Fallback: Background Image with largest area? 
                // (Harder to calc area for BG, so we stick to 'has BG image')
                if (!image) {
                    const elems = [bestContainer, ...bestContainer.querySelectorAll('div, span, a')];
                    for (let el of elems) {
                        const style = window.getComputedStyle(el);
                        if (style.backgroundImage && style.backgroundImage !== 'none') {
                            const match = style.backgroundImage.match(/url\(["']?([^"']*)["']?\)/);
                            if (match && match[1] && !match[1].includes('gradient')) {
                                image = getAbsoluteUrl(match[1]);
                                break;
                            }
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
