// Search related elements
const queryInput = document.getElementById("queryInput");
const resultsDiv = document.querySelector(".results");
const searchBtn = document.getElementById("searchBtn");

// NOTE: consider moving this into an env/config step later.
// For now keep it explicit for extension dev.
const API = "http://localhost:64707";

/**
 * Basic guard so we fail loudly if the DOM isn't wired correctly.
 * This prevents silent "nothing happens" bugs.
 */
if (!queryInput) throw new Error('Missing element: #queryInput');
if (!resultsDiv) throw new Error('Missing element: .results');
if (!searchBtn) throw new Error('Missing element: #searchBtn');

function clearResults() {
    resultsDiv.innerHTML = "";
}

function renderMessage(message, { kind = "info" } = {}) {
    clearResults();
    const p = document.createElement("p");
    p.textContent = message;

    // tiny styling hooks if you want to add CSS later
    p.dataset.kind = kind;

    resultsDiv.appendChild(p);
}

function normalizeType(type) {
    const t = String(type || "").trim();
    return t ? t : "unknown";
}

function normalizeTitle(title) {
    const t = String(title || "").trim();
    return t ? t : "(Untitled)";
}

function isProbablyValidUrl(url) {
    if (!url) return false;
    try {
        // URL constructor will throw for invalid urls
        // (supports absolute URLs; Notion URLs are absolute)
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function createTypeBadge(type) {
    const badge = document.createElement("span");
    badge.className = "type-badge";
    badge.dataset.type = type;
    badge.textContent = type;

    // minimal inline style so you don't need to touch CSS yet
    badge.style.marginLeft = "8px";
    badge.style.fontSize = "0.75em";
    badge.style.padding = "2px 6px";
    badge.style.borderRadius = "999px";
    badge.style.background = "#eee";
    badge.style.color = "#333";
    badge.style.verticalAlign = "middle";

    return badge;
}

function renderResults(items) {
    clearResults();

    if (!Array.isArray(items) || items.length === 0) {
        renderMessage("No results.", { kind: "empty" });
        return;
    }

    const ul = document.createElement("ul");

    for (const item of items) {
        const li = document.createElement("li");

        const title = normalizeTitle(item?.title);
        const url = String(item?.url || "").trim();
        const type = normalizeType(item?.type);

        li.dataset.type = type;

        // Title/link
        if (isProbablyValidUrl(url)) {
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.rel = "noreferrer";
            a.textContent = title;
            li.appendChild(a);
        } else {
            // No URL available: render title as plain text
            const span = document.createElement("span");
            span.textContent = title;
            li.appendChild(span);
        }

        // ✅ Visible type badge
        li.appendChild(createTypeBadge(type));

        ul.appendChild(li);
    }

    resultsDiv.appendChild(ul);
}

async function getResultsArray() {
    const query = queryInput.value.trim();
    if (!query) {
        renderMessage("Please enter a search query.", { kind: "error" });
        queryInput.focus();
        return;
    }

    // UI state: loading
    searchBtn.disabled = true;
    queryInput.disabled = true;
    renderMessage("Searching…", { kind: "loading" });

    try {
        const res = await fetch(`${API}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
        });

        if (!res.ok) {
            // Try to surface server-provided error details (if any)
            let details = "";
            try {
                const maybeJson = await res.json();
                if (maybeJson?.error) details = ` (${maybeJson.error})`;
            } catch {
                // ignore json parse errors
            }
            throw new Error(`Server error: ${res.status} ${res.statusText}${details}`);
        }

        const data = await res.json();

        // Expecting: [{ id, title, url, type }, ...]
        renderResults(data);
    } catch (err) {
        const msg =
            (err && typeof err === "object" && "message" in err && err.message) ||
            "Something went wrong";
        renderMessage(String(msg), { kind: "error" });
    } finally {
        searchBtn.disabled = false;
        queryInput.disabled = false;
    }
}

// Events
searchBtn.addEventListener("click", getResultsArray);
queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") getResultsArray();
});
