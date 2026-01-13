// static/js/main.js

// 1. INITIAL SETUP
document.addEventListener('DOMContentLoaded', () => {
    // Initial Load
    renderHistory();

    // Attach Search & Filter Listeners
    const searchInput = document.getElementById('history-search-input');
    const filterSelect = document.getElementById('history-filter-select');

    if (searchInput && filterSelect) {
        // Typing in Search Bar
        searchInput.addEventListener('input', () => {
            filterHistoryItems();
        });

        // Changing Dropdown
        filterSelect.addEventListener('change', () => {
            filterHistoryItems();
        });
    }
});

// =========================================================
// 2. FORM SUBMIT (Stop Page Reload)
// =========================================================
const form = document.getElementById('analyzeForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        document.getElementById('loading').style.display = 'block';
        document.querySelector('.detector-btn').disabled = true;

        const formData = new FormData(form);

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error("Network response was not ok");

            const data = await response.json();
            
            displayAnalysis(data);
            addToHistory(data);

        } catch (error) {
            console.error("Error:", error);
            alert("An error occurred. Please check the console.");
        } finally {
            document.getElementById('loading').style.display = 'none';
            document.querySelector('.detector-btn').disabled = false;
        }
    });
}

// =========================================================
// 3. DISPLAY RESULTS
// =========================================================
function displayAnalysis(data) {
    document.getElementById('results-placeholder').style.display = 'none';
    document.getElementById('results-area').style.display = 'block';

    document.getElementById('verdict-label').innerText = data.score_label;
    document.getElementById('classification-text').innerText = data.classification_text;
    document.getElementById('confidence-score').innerText = data.model_confidence + "%";

    const highlightBox = document.getElementById('result-container');
    if (data.lime_html) {
        highlightBox.innerHTML = data.lime_html;
    } else {
        highlightBox.innerHTML = "<p>No text analysis available.</p>";
    }

    const sourcesList = document.getElementById('sources-list');
    sourcesList.innerHTML = ''; 

    if (data.supporting_articles && data.supporting_articles.length > 0) {
        data.supporting_articles.forEach(article => {
            const div = document.createElement('div');
            div.className = 'source-item';
            div.style.marginBottom = "15px"; 
            div.style.padding = "10px";
            div.style.border = "1px solid #eee";
            div.style.borderRadius = "5px";

            div.innerHTML = `
                <a href="${article.link}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: none;">
                    ${article.title}
                </a>
                <p style="font-size: 0.85rem; color: #666; margin: 5px 0;">${article.displayLink}</p>
            `;
            sourcesList.appendChild(div);
        });
    } else {
        sourcesList.innerHTML = '<p class="text-muted">No supporting articles found.</p>';
    }
}

// =========================================================
// 4. ADD TO HISTORY (Now calls Filter immediately)
// =========================================================
function addToHistory(data) {
    let history = JSON.parse(localStorage.getItem('credibility_history')) || [];

    let itemType = 'text';
    const content = data.input_text || data.news_text || "";
    if (content.trim().startsWith('http') && (content.includes('youtube') || content.includes('youtu.be'))) {
        itemType = 'video';
    }

    const snapshot = {
        id: Date.now(),
        timestamp: data.timestamp || new Date().toLocaleString(),
        type: itemType,
        input_text: content,
        score_label: data.score_label,
        classification_text: data.classification_text,
        model_confidence: data.model_confidence,
        lime_html: data.lime_html,
        supporting_articles: data.supporting_articles,
        isFavorite: false 
    };

    history.unshift(snapshot);
    if (history.length > 20) history.pop(); 

    localStorage.setItem('credibility_history', JSON.stringify(history));
    
    // REFRESH THE VIEW (Respecting current filters)
    filterHistoryItems();
}

// =========================================================
// 5. THE FILTER LOGIC (Global Scope - Fixes your bug)
// =========================================================
window.filterHistoryItems = function() {
    // Get current values from UI
    const searchInput = document.getElementById('history-search-input');
    const filterSelect = document.getElementById('history-filter-select');
    
    const keyword = searchInput ? searchInput.value.toLowerCase() : "";
    const category = filterSelect ? filterSelect.value : "all";

    let history = JSON.parse(localStorage.getItem('credibility_history')) || [];

    // 1. FILTER BY DROPDOWN CATEGORY
    if (category !== 'all') {
        history = history.filter(item => {
            const label = (item.score_label || "").toLowerCase();
            const type = (item.type || "text").toLowerCase();

            if (category === 'saved') return item.isFavorite === true;
            if (category === 'real') return label.includes('high') || label.includes('real') || label.includes('credible');
            if (category === 'fake') return label.includes('low') || label.includes('fake');
            if (category === 'uncertain') return label.includes('uncertain');
            if (category === 'text') return type === 'text';
            if (category === 'video') return type === 'video';
            return true;
        });
    }

    // 2. FILTER BY SEARCH KEYWORD
    if (keyword.trim() !== "") {
        history = history.filter(item => 
            // Search in the Verdict Label (e.g. "High Credibility")
            (item.score_label && item.score_label.toLowerCase().includes(keyword)) ||
            // Search in the Article Text (e.g. "Marcos", "Vape")
            (item.input_text && item.input_text.toLowerCase().includes(keyword)) ||
            // Search in the Date (e.g. "2026")
            (item.timestamp && item.timestamp.toLowerCase().includes(keyword))
        );
    }

    // Render the filtered list
    renderHistory(history);
};

// =========================================================
// 6. RENDER HISTORY (Handles display)
// =========================================================
function renderHistory(itemsToRender = null) {
    const container = document.getElementById('history-list');
    if (!container) return;

    // Use passed list OR load full list if null
    let history;
    if (itemsToRender) {
        history = itemsToRender;
    } else {
        history = JSON.parse(localStorage.getItem('credibility_history')) || [];
        // Only sort by favorite if we are showing the full default list
        history.sort((a, b) => (b.isFavorite === true) - (a.isFavorite === true));
    }

    container.innerHTML = '';

    if (history.length === 0) {
        const msg = itemsToRender ? "No matches found." : "No history yet.";
        container.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">${msg}</p>`;
        return;
    }

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        const isLocked = item.isFavorite;
        const starClass = isLocked ? 'star-active' : 'star-inactive';
        const deleteClass = isLocked ? 'delete-disabled' : 'delete-btn';
        
        div.onclick = () => restoreSession(item.id);

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex: 1; min-width: 0; padding-right: 10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong style="color:#333;">${item.score_label}</strong>
                        ${isLocked ? '<span style="font-size:12px;">⭐</span>' : ''}
                    </div>
                    <div style="font-size:0.75rem; color:#888; margin-top:4px;">${item.timestamp}</div>
                    <div style="font-size:0.8rem; color:#555; margin-top:4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${item.input_text.substring(0, 50)}...
                    </div>
                </div>
                
                <span style="font-size:0.8rem; background:#eee; padding:2px 6px; border-radius:4px; height:fit-content; white-space:nowrap;">
                    ${item.model_confidence}%
                </span>
            </div>

            <div class="history-actions" style="margin-top:10px; display:flex; gap:10px; border-top:1px solid #eee; padding-top:8px;">
                <button onclick="toggleFavorite(event, ${item.id})" class="action-btn ${starClass}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    ${isLocked ? 'Saved' : 'Save'}
                </button>
                <button onclick="deleteItem(event, ${item.id})" class="action-btn ${deleteClass}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Delete
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

// =========================================================
// 7. RESTORE, FAVORITE, DELETE ACTIONS
// =========================================================
window.restoreSession = function(id) {
    const history = JSON.parse(localStorage.getItem('credibility_history')) || [];
    const item = history.find(x => x.id === id);

    if (item) {
        const data = {
            score_label: item.score_label,
            classification_text: item.classification_text,
            model_confidence: item.model_confidence,
            lime_html: item.lime_html,
            supporting_articles: item.supporting_articles
        };
        displayAnalysis(data);
        const inputBox = document.getElementById('userInput');
        if (inputBox) inputBox.value = item.input_text;
        
        document.getElementById('history-modal-overlay').classList.remove('modal-active');
    }
};

window.toggleFavorite = function(event, id) {
    if(event) event.stopPropagation();
    let history = JSON.parse(localStorage.getItem('credibility_history')) || [];
    const index = history.findIndex(x => x.id === id);
    if (index !== -1) {
        history[index].isFavorite = !history[index].isFavorite;
        localStorage.setItem('credibility_history', JSON.stringify(history));
        filterHistoryItems(); // Refresh view
    }
};

window.deleteItem = function(event, id) {
    if(event) event.stopPropagation();
    let history = JSON.parse(localStorage.getItem('credibility_history')) || [];
    const item = history.find(x => x.id === id);
    if (item && item.isFavorite) {
        alert("This item is saved! Unsave it first if you want to delete it.");
        return; 
    }
    if(!confirm("Delete this analysis?")) return;
    history = history.filter(x => x.id !== id);
    localStorage.setItem('credibility_history', JSON.stringify(history));
    filterHistoryItems(); // Refresh view
};