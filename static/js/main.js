// static/js/main.js

// 1. INITIAL SETUP
document.addEventListener('DOMContentLoaded', () => {
    renderHistory();

    const searchInput = document.getElementById('history-search-input');
    const filterSelect = document.getElementById('history-filter-select');

    if (searchInput && filterSelect) {
        searchInput.addEventListener('input', () => filterHistoryItems());
        filterSelect.addEventListener('change', () => filterHistoryItems());
    }
});

// =========================================================
// 2. FORM SUBMIT (Highlighter Animation + Timer)
// =========================================================
const form = document.getElementById('analyzeForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        // A. FIND ELEMENTS
        const btnText = document.getElementById('btntext');
        const btnVid = document.getElementById('btnvid');
        const textInput = document.getElementById('userInput'); 
        const timerDisplay = document.getElementById('timer-display');
        
        let activeBtn = btnText;
        if (btnVid && btnVid.offsetParent !== null) {
            activeBtn = btnVid;
        }

        // B. START VISUAL EFFECTS
        const originalText = activeBtn ? activeBtn.innerText : "Analyze";
        let timerInterval = null;
        let startTime = Date.now();

        // 1. Change Button State
        if (activeBtn) {
            activeBtn.innerText = "Analyzing..."; // Changed text to match effect
            activeBtn.disabled = true;
            activeBtn.style.opacity = "0.7";
            activeBtn.style.cursor = "wait";
        }

        // 2. Trigger Highlighter Animation
        if (textInput) {
            textInput.classList.add('scanning'); 
        }

        // 3. Start Timer
        if (timerDisplay) {
            timerDisplay.style.display = 'block';
            timerDisplay.style.color = '#666'; 
            timerDisplay.innerText = "Reading content: 0.00s";
            
            timerInterval = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                timerDisplay.innerText = `Reading content: ${elapsed.toFixed(2)}s`;
            }, 50); 
        }

        const formData = new FormData(form);

        try {
            const response = await fetch(form.getAttribute('action'), {
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
            // C. RESET VISUAL EFFECTS

            // 1. Stop Timer
            if (timerInterval) clearInterval(timerInterval);
            if (timerDisplay) {
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                timerDisplay.innerText = `Analysis complete (${totalTime}s)`;
                timerDisplay.style.color = '#166534'; 
            }

            // 2. Restore Button
            if (activeBtn) {
                activeBtn.innerText = originalText;
                activeBtn.disabled = false;
                activeBtn.style.opacity = "1";
                activeBtn.style.cursor = "pointer";
            }
            
            // 3. Stop Highlighter
            if (textInput) {
                textInput.classList.remove('scanning');
            }
        }
    });
}

// =========================================================
// 3. DISPLAY RESULTS (Updated with Progress Bar)
// =========================================================
function displayAnalysis(data) {
    document.getElementById('results-placeholder').style.display = 'none';
    document.getElementById('results-area').style.display = 'block';

    const verdictLabel = document.getElementById('verdict-label');
    verdictLabel.innerText = data.score_label;
    
    document.getElementById('classification-text').innerText = data.classification_text;
    document.getElementById('confidence-score').innerText = data.model_confidence + "%";

    // --- NEW: Update Progress Bar ---
    const progressBar = document.getElementById('confidence-bar');
    if (progressBar) {
        // Reset width to 0 first to force animation on new searches
        progressBar.style.width = '0%';
        
        // Small delay to allow the browser to register the reset, then animate to target
        setTimeout(() => {
            progressBar.style.width = data.model_confidence + "%";
        }, 100);
    }
    // -------------------------------

    if (data.colors) {
        const scoreBox = document.getElementById('scoreBox');
        const classBox = document.getElementById('classifications');

        scoreBox.style.backgroundColor = data.colors.bg_color;
        scoreBox.style.border = `1px solid ${data.colors.accent_color}`;
        verdictLabel.style.color = data.colors.text_color;

        classBox.style.backgroundColor = data.colors.bg_color;
        classBox.style.borderLeft = `5px solid ${data.colors.accent_color}`;
        classBox.style.color = data.colors.text_color;

        // Apply color to the progress bar too!
        if (progressBar) {
            progressBar.style.backgroundColor = data.colors.text_color; // e.g. Dark Red or Dark Green
        }
    }

    // Influential Sentences / LIME Highlights
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
// 4. ADD TO HISTORY
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
        colors: data.colors,
        isFavorite: false 
    };

    history.unshift(snapshot);

    if (history.length > 20) {
        let indexToRemove = -1;
        for (let i = history.length - 1; i >= 0; i--) {
            if (!history[i].isFavorite) {
                indexToRemove = i;
                break;
            }
        }
        if (indexToRemove !== -1) {
            history.splice(indexToRemove, 1);
        } else {
            history.pop();
        }
    }

    localStorage.setItem('credibility_history', JSON.stringify(history));
    filterHistoryItems();
}

// =========================================================
// 5. FILTER LOGIC
// =========================================================
window.filterHistoryItems = function() {
    const searchInput = document.getElementById('history-search-input');
    const filterSelect = document.getElementById('history-filter-select');
    
    const keyword = searchInput ? searchInput.value.toLowerCase() : "";
    const category = filterSelect ? filterSelect.value : "all";

    let history = JSON.parse(localStorage.getItem('credibility_history')) || [];

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

    if (keyword.trim() !== "") {
        history = history.filter(item => 
            (item.score_label && item.score_label.toLowerCase().includes(keyword)) ||
            (item.input_text && item.input_text.toLowerCase().includes(keyword)) ||
            (item.timestamp && item.timestamp.toLowerCase().includes(keyword))
        );
    }

    renderHistory(history);
};

// =========================================================
// 6. RENDER HISTORY
// =========================================================
function renderHistory(itemsToRender = null) {
    const container = document.getElementById('history-list');
    if (!container) return;

    let history;
    if (itemsToRender) {
        history = itemsToRender;
    } else {
        history = JSON.parse(localStorage.getItem('credibility_history')) || [];
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
                    Save
                </button>
                <button onclick="deleteItem(event, ${item.id})" class="action-btn ${deleteClass}">
                    Delete
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

// =========================================================
// 7. ACTIONS
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
            supporting_articles: item.supporting_articles,
            colors: item.colors 
        };
        displayAnalysis(data);
        const inputBox = document.getElementById('userInput');
        if (inputBox) inputBox.value = item.input_text;
        
        document.getElementById('history-modal-overlay').classList.remove('modal-active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.toggleFavorite = function(event, id) {
    if(event) event.stopPropagation();
    let history = JSON.parse(localStorage.getItem('credibility_history')) || [];
    const index = history.findIndex(x => x.id === id);
    if (index !== -1) {
        history[index].isFavorite = !history[index].isFavorite;
        localStorage.setItem('credibility_history', JSON.stringify(history));
        filterHistoryItems(); 
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
    filterHistoryItems(); 
};