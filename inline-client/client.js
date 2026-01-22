// Search related elements
const queryInput = document.getElementById("queryInput");
const resultsDiv = document.querySelector(".results");
const searchBtn = document.getElementById("searchBtn");

const API = "http://localhost:64707";

function renderResults(items) {
    resultsDiv.innerHTML = "";
    const ul = document.createElement("ul");
    for (const item in items) {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
    }
    resultsDiv.appendChild(ul);
}

async function getResultsArray() {
    const query = queryInput.value.trim();
    if (!query) {
        alert("Please enter a search query.");
        return;
    }
    searchBtn.disabled = true;
    try {
        const res = await fetch(`${API}/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ query })
        })

        if (!res.ok) {
            throw new Error(`Server error: ${res.statusText}`);
        }

        const data = await res.json();
        renderResults(data);

    } catch (err) {
        renderResults([err.message ?? "Something went wrong"]);
    } finally {
        searchBtn.disabled = false;
    }
}

searchBtn.addEventListener("click", getResultsArray);
queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        getResultsArray();
    }
})
