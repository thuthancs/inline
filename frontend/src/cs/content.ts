// Inline the destination key to avoid ES module imports (content scripts don't support modules)
const DEST_KEY = "inline_destination_v1";

type SWMessage =
    | {
        type: "SAVE_HIGHLIGHT";
        payload: {
            text: string;
            pageUrl: string;
            pageTitle?: string;
            images?: string[];
        };
    }
    | {
        type: "SAVE_IMAGE";
        payload: {
            imageUrl: string;
            pageUrl: string;
            pageTitle?: string;
        };
    }
    | {
        type: "COMMENT_HIGHLIGHT";
        payload: {
            text: string;
            comment: string;
            pageUrl: string;
            pageTitle?: string;
        };
    };

// Track if destination is set (controls whether UI shows)
let hasDestination = false;

// Load and check destination from storage
async function checkDestination() {
    try {
        const store = await chrome.storage.local.get(DEST_KEY);
        hasDestination = !!store[DEST_KEY];
    } catch (e) {
        hasDestination = false;
    }
}

// Listen for storage changes (when destination is set or cleared)
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[DEST_KEY]) {
        hasDestination = !!changes[DEST_KEY].newValue;
        // If destination was cleared, remove any visible tooltip
        if (!hasDestination) {
            removeTooltip();
        }
    }
});

// Check destination on script load
checkDestination();

// Check if extension context is still valid
function isExtensionContextValid(): boolean {
    try {
        // This will throw if context is invalidated
        return !!chrome.runtime?.id;
    } catch {
        return false;
    }
}

// Helper to send messages to service worker with retry logic
// This handles the case where the SW is sleeping and needs to wake up
function sendMessageWithRetry(
    msg: SWMessage,
    callback: (response: any) => void,
    retries = 2
) {
    // Check if extension context is still valid before attempting to send
    if (!isExtensionContextValid()) {
        console.error('[CONTENT] Extension context invalidated - page reload required');
        // Return a special error that indicates reload is needed
        callback({ ok: false, error: "EXTENSION_RELOADED" });
        return;
    }

    console.log(`[CONTENT] Sending message (retries left: ${retries}):`, msg.type);

    try {
        chrome.runtime.sendMessage(msg, (resp) => {
            // Check for errors that indicate SW connection issues
            if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message || "";
                console.warn(`[CONTENT] sendMessage error: ${errorMsg}`);

                // Check for extension context invalidation errors
                if (errorMsg.includes("Extension context invalidated") ||
                    errorMsg.includes("Receiving end does not exist")) {
                    // Extension was updated - no point retrying
                    callback({ ok: false, error: "EXTENSION_RELOADED" });
                    return;
                }

                // If we have retries left and it's a transient connection error, retry
                if (retries > 0 && errorMsg.includes("disconnected")) {
                    console.log(`[CONTENT] Retrying in 500ms...`);
                    setTimeout(() => {
                        sendMessageWithRetry(msg, callback, retries - 1);
                    }, 500);
                    return;
                }
            }

            // Call the original callback with whatever we got
            callback(resp);
        });
    } catch (e: any) {
        console.error('[CONTENT] sendMessage threw:', e);
        // If sendMessage itself throws, context is likely invalidated
        callback({ ok: false, error: "EXTENSION_RELOADED" });
    }
}

let shadowHost: HTMLDivElement | null = null;
let tooltip: HTMLDivElement | null = null;
let commentBox: HTMLDivElement | null = null;
let tooltipCreatedAt: number = 0; // Timestamp when tooltip was created
let lastSelectionText = "";
let savedRange: Range | null = null; // Store the range for later use
let imageOverlay: HTMLButtonElement | null = null;
let activeImage: HTMLImageElement | null = null;
let overlayHover = false;

// Add hover listeners to all images on the page
function initImageHoverHandlers() {
    // Only add handlers if a destination is set
    if (!hasDestination) return;

    document.querySelectorAll('img').forEach(img => {
        // Skip if already has handler
        if (img.hasAttribute('data-inline-handled')) return;

        img.setAttribute('data-inline-handled', 'true');

        img.addEventListener('mouseenter', () => {
            if (!isValidImage(img)) return;
            showImageOverlay(img);
        });

        img.addEventListener('mouseleave', () => {
            setTimeout(() => {
                if (!overlayHover) hideImageOverlay();
            }, 100);
        });
    });
}

// Show a toast notification
function showToast(message: string, type: 'success' | 'info' | 'error' = 'info') {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 4px;
        font-family: system-ui;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Add CSS animations to the page
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(styleSheet);

// Initialize on page load and when new content is added
initImageHoverHandlers();
const observer = new MutationObserver(() => initImageHoverHandlers());
observer.observe(document.body, { childList: true, subtree: true });

function removeTooltip() {
    const now = Date.now();
    const timeSinceCreation = now - tooltipCreatedAt;

    // Don't remove tooltip if it was just created (within 200ms)
    // This prevents mousedown events from immediately removing it
    if (timeSinceCreation < 200) {
        return;
    }

    if (shadowHost) shadowHost.remove();
    shadowHost = null;
    tooltip = null;
    commentBox = null;
    tooltipCreatedAt = 0;
}

function isValidImage(img: HTMLImageElement): boolean {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:') || !src.startsWith('http')) return false;
    return img.width >= 100 && img.height >= 100;
}

function ensureImageOverlay() {
    if (imageOverlay) return;

    imageOverlay = document.createElement('button');
    imageOverlay.textContent = 'Save image';
    imageOverlay.style.cssText = `
        position: fixed;
        padding: 6px 10px;
        background: #0066cc;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-family: system-ui;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        display: none;
    `;

    imageOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!imageOverlay || !activeImage) return;
        const src = activeImage.currentSrc || activeImage.src;
        if (!src) return;

        // OPTIMISTIC UI: Change button to green with checkmark immediately
        const originalText = imageOverlay.textContent;
        const originalBackground = imageOverlay.style.background;
        imageOverlay.textContent = '✓ Saved';
        imageOverlay.style.background = '#4caf50';
        imageOverlay.style.cursor = 'default';
        imageOverlay.disabled = true;

        const msg: SWMessage = {
            type: "SAVE_IMAGE",
            payload: {
                imageUrl: src,
                pageUrl: location.href,
                pageTitle: document.title,
            },
        };

        sendMessageWithRetry(msg, (resp) => {
            if (!imageOverlay) return;

            if (chrome.runtime.lastError) {
                // Revert button on error
                imageOverlay.textContent = originalText;
                imageOverlay.style.background = originalBackground;
                imageOverlay.style.cursor = 'pointer';
                imageOverlay.disabled = false;
                showToast(`Save failed: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }
            if (resp?.ok) {
                // Keep green checkmark on success
                showToast('Image saved to Notion ✓', 'success');
                // Hide button after a short delay
                setTimeout(() => {
                    hideImageOverlay();
                }, 1500);
            } else {
                // Revert button on error
                imageOverlay.textContent = originalText;
                imageOverlay.style.background = originalBackground;
                imageOverlay.style.cursor = 'pointer';
                imageOverlay.disabled = false;
                showToast(`Save failed: ${resp?.error || 'unknown'}`, 'error');
            }
        });
    });

    imageOverlay.addEventListener('mouseenter', () => {
        overlayHover = true;
    });

    imageOverlay.addEventListener('mouseleave', () => {
        overlayHover = false;
        hideImageOverlay();
    });

    document.body.appendChild(imageOverlay);
}

function showImageOverlay(img: HTMLImageElement) {
    ensureImageOverlay();
    if (!imageOverlay) return;

    activeImage = img;
    const rect = img.getBoundingClientRect();

    // Reset button state when showing for a new image
    imageOverlay.textContent = 'Save image';
    imageOverlay.style.background = '#0066cc';
    imageOverlay.style.cursor = 'pointer';
    imageOverlay.disabled = false;

    imageOverlay.style.left = `${Math.min(rect.right - 90, window.innerWidth - 110)}px`;
    imageOverlay.style.top = `${Math.max(rect.top + 6, 8)}px`;
    imageOverlay.style.display = 'block';
}

function hideImageOverlay() {
    if (!imageOverlay) return;
    imageOverlay.style.display = 'none';
    activeImage = null;

    // Reset button state when hiding
    imageOverlay.textContent = 'Save image';
    imageOverlay.style.background = '#0066cc';
    imageOverlay.style.cursor = 'pointer';
    imageOverlay.disabled = false;
}

function getSelectionText(): string {
    const sel = window.getSelection();
    const text = sel?.toString() ?? "";
    const trimmed = text.trim();


    return trimmed;
}

function highlightSelectedText(color: string = "#fff59d") {
    const selection = window.getSelection();
    if (!selection) return;

    // If we have a saved range, restore it first
    if (savedRange) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
    }

    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Create a span to wrap the selected text
    const span = document.createElement("span");
    span.style.backgroundColor = color;
    span.style.borderRadius = "2px";
    span.style.padding = "2px 0";
    span.setAttribute("data-notion-highlight", "true");

    try {
        // Wrap the selected content
        range.surroundContents(span);
    } catch (e) {
        // If surroundContents fails (e.g., partial element selection),
        // use a different approach
        console.warn("Could not highlight selection:", e);

        // Alternative: extract contents and re-insert with highlighting
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        } catch (err) {
            console.error("Failed to highlight:", err);
        }
    }
}

function showCommentBox() {
    if (!tooltip || !shadowHost) return;

    // Save the current selection range before it's lost
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
    }

    // Hide the tooltip buttons
    tooltip.style.display = "none";

    // Create comment box
    commentBox = document.createElement("div");
    commentBox.className = "comment-box";

    const input = document.createElement("textarea");
    input.placeholder = "Add your comment...";
    input.className = "comment-input";

    const btnContainer = document.createElement("div");
    btnContainer.className = "comment-buttons";

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit";
    submitBtn.className = "submit-btn";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "cancel-btn";

    // Submit comment
    submitBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const comment = input.value.trim();
        if (comment) {
            // Prefer current selection if available, otherwise use lastSelectionText
            const currentSelectionText = getSelectionText();
            const textToSave = (currentSelectionText && currentSelectionText.trim().length > 0)
                ? currentSelectionText.trim()
                : lastSelectionText;

            const msg: SWMessage = {
                type: "COMMENT_HIGHLIGHT",
                payload: {
                    text: textToSave,
                    comment: comment,
                    pageUrl: location.href,
                    pageTitle: document.title,
                },
            };

            // OPTIMISTIC UI: Close immediately, process in background
            // Highlight was already applied when clicking "Add Comment"
            showToast('Saving comment...', 'success');
            removeTooltip();
            window.getSelection()?.removeAllRanges();
            savedRange = null;

            // Process in background - show error only if it fails
            sendMessageWithRetry(msg, (resp) => {
                if (chrome.runtime.lastError) {
                    console.error("sendMessage failed:", chrome.runtime.lastError.message);
                    showToast(`Save failed: ${chrome.runtime.lastError.message}`, 'error');
                    return;
                }

                if (!resp?.ok) {
                    let errorMsg: string;
                    if (resp?.error === "NO_DESTINATION") {
                        errorMsg = "No destination set. Open the side panel to set one.";
                    } else if (resp?.error === "EXTENSION_RELOADED") {
                        errorMsg = "Extension was updated. Please reload this page.";
                    } else {
                        errorMsg = `Save failed: ${resp?.error || 'unknown'}`;
                    }
                    showToast(errorMsg, 'error');
                    return;
                }

                // Update toast to confirm success
                showToast('Saved with comment ✓', 'success');
            });
        }
    });

    // Cancel - go back to tooltip
    cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (tooltip) tooltip.style.display = "flex";
        if (commentBox) commentBox.remove();
        commentBox = null;
        savedRange = null;
    });

    // Submit on Enter key
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            submitBtn.click();
        } else if (e.key === "Escape") {
            cancelBtn.click();
        }
    });

    btnContainer.appendChild(submitBtn);
    btnContainer.appendChild(cancelBtn);
    commentBox.appendChild(input);
    commentBox.appendChild(btnContainer);

    const shadow = shadowHost.shadowRoot!;
    shadow.appendChild(commentBox);

    // Focus the input
    setTimeout(() => input.focus(), 0);
}

function makeTooltip(x: number, y: number) {
    console.log('[INLINE] makeTooltip called at:', x, y, 'hasDestination:', hasDestination);
    if (!hasDestination) {
        console.log('[INLINE] No destination set, not showing tooltip');
        return;
    }
    removeTooltip();

    // Create shadow host
    shadowHost = document.createElement("div");
    shadowHost.style.position = "fixed";
    shadowHost.style.left = `${x}px`;
    shadowHost.style.top = `${y}px`;
    shadowHost.style.zIndex = "2147483647"; // Maximum safe z-index value
    shadowHost.style.pointerEvents = "auto"; // Ensure it can receive clicks

    // Attach shadow DOM
    const shadow = shadowHost.attachShadow({ mode: "open" });

    // Add styles inside shadow DOM
    const style = document.createElement("style");
    style.textContent = `
        .tooltip {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            display: flex;
            gap: 6px;
            font-family: system-ui;
            font-size: 12px;
        }
        button {
            padding: 4px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 12px;
        }
        button:hover {
            background: #f5f5f5;
        }
        .comment-box {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            font-family: system-ui;
            font-size: 12px;
            min-width: 300px;
            min-height: 120px;
        }
        .comment-input {
            width: 100%;
            height: 80px;
            padding: 6px 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            font-family: system-ui;
            box-sizing: border-box;
            margin-bottom: 6px;
            resize: vertical;
        }
        .comment-input:focus {
            outline: none;
            border-color: #0066cc;
        }
        .comment-buttons {
            display: flex;
            gap: 6px;
            justify-content: flex-end;
        }
        .submit-btn {
            background: #0066cc;
            color: white;
            border: none;
        }
        .submit-btn:hover {
            background: #0052a3;
        }
        .cancel-btn {
            background: white;
        }
    `;
    shadow.appendChild(style);

    tooltip = document.createElement("div");
    tooltip.className = "tooltip";

    tooltip.addEventListener("mousedown", (e) => e.preventDefault());
    tooltip.addEventListener("click", (e) => e.stopPropagation());
    tooltip.addEventListener("mouseup", (e) => e.stopPropagation());

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";

    saveBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    saveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log("🔵 CONTENT: Save button clicked");

        // Prefer current selection if available, otherwise use lastSelectionText
        // This ensures we capture the most recent selection, not a stale one
        const currentSelectionText = getSelectionText();
        const textToSave = (currentSelectionText && currentSelectionText.trim().length > 0)
            ? currentSelectionText.trim()
            : lastSelectionText;

        const msg: SWMessage = {
            type: "SAVE_HIGHLIGHT",
            payload: {
                text: textToSave,
                pageUrl: location.href,
                pageTitle: document.title,
            },
        };

        // OPTIMISTIC UI: Show success immediately, highlight, and close
        highlightSelectedText("#fff59d"); // Light yellow for saves
        showToast('Saving to Notion...', 'success');
        removeTooltip();
        window.getSelection()?.removeAllRanges();
        savedRange = null;

        // Process in background - show error only if it fails
        sendMessageWithRetry(msg, (resp) => {
            if (chrome.runtime.lastError) {
                console.error("🔴 CONTENT: sendMessage failed:", chrome.runtime.lastError.message);
                showToast(`Save failed: ${chrome.runtime.lastError.message}`, 'error');
                return;
            }

            if (!resp?.ok) {
                let errorMsg: string;
                if (resp?.error === "NO_DESTINATION") {
                    errorMsg = "No destination set. Open the side panel to set one.";
                } else if (resp?.error === "EXTENSION_RELOADED") {
                    errorMsg = "Extension was updated. Please reload this page.";
                } else {
                    errorMsg = `Save failed: ${resp?.error || 'unknown'}`;
                }
                showToast(errorMsg, 'error');
                return;
            }

            // Update toast to confirm success
            showToast('Saved to Notion ✓', 'success');
        });
    });

    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.textContent = "Comment";

    commentBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    commentBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Highlight immediately when user clicks "Add Comment"
        highlightSelectedText("#b3e5fc"); // Light blue for comments
        showCommentBox();
    });

    tooltip.appendChild(saveBtn);
    tooltip.appendChild(commentBtn);
    shadow.appendChild(tooltip);
    document.body.appendChild(shadowHost);

    // Set creation timestamp to prevent immediate removal
    tooltipCreatedAt = Date.now();

}

// Handle text selection
function handleTextSelection(e: MouseEvent) {
    // Only show UI if a destination is set
    if (!hasDestination) return;

    if (shadowHost && e.target instanceof Node && shadowHost.contains(e.target)) return;

    const text = getSelectionText();
    if (!text) {
        removeTooltip();
        return;
    }

    lastSelectionText = text;
    makeTooltip(e.clientX + 8, e.clientY + 8);
}

document.addEventListener("mouseup", handleTextSelection, true);

// Keyboard shortcut: Ctrl/Cmd + Shift + S to save selection
document.addEventListener("keydown", (e) => {
    if (!hasDestination) return;

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const text = getSelectionText();
        if (text) {
            lastSelectionText = text;
            // Show tooltip at center of viewport
            makeTooltip(window.innerWidth / 2, 100);
        }
    }
}, true);

// Also use selectionchange event as backup
document.addEventListener("selectionchange", () => {
    if (!hasDestination) return;

    const text = getSelectionText();
    if (text && text !== lastSelectionText) {
        lastSelectionText = text;
    }
});

document.addEventListener("mousedown", (e) => {
    // Don't remove tooltip if clicking on tooltip itself
    if (shadowHost && e.target instanceof Node && shadowHost.contains(e.target)) return;

    removeTooltip();
}, true);