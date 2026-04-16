const tg = window.Telegram.WebApp;
tg.expand();

let banksData = {};
let currentQuestions = [];
let quizState = {
    index: 0,
    correct: 0,
    incorrect: 0,
    history: [], // For the 'Geri' button logic in navigation
    currentPath: null
};

// Elements
const content = document.getElementById('content');
const stats = document.getElementById('stats');
const backBtn = document.getElementById('back-btn');

// 1. Fetch the main index
async function init() {
    try {
        const response = await fetch('banks.json');
        banksData = await response.json();
        renderMenu(banksData, "Kateqoriya seçin");
    } catch (e) {
        content.innerHTML = `<div class="error">Xəta: Banks.json yüklənə bilmədi.</div>`;
    }
}

// 2. Render Menu (Categories/Subcategories/Banks)
function renderMenu(data, title) {
    document.getElementById('title').innerText = title;
    stats.classList.add('hidden');
    content.innerHTML = '';
    
    // If it's a string, it's a path to a question file
    if (typeof data === 'string') {
        startQuizSetup(data);
        return;
    }

    Object.keys(data).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.innerText = key;
        btn.onclick = () => {
            quizState.history.push({data: data, title: title});
            backBtn.classList.remove('hidden');
            renderMenu(data[key], key);
        };
        content.appendChild(btn);
    });
}

function goBack() {
    if (quizState.history.length > 0) {
        const prev = quizState.history.pop();
        if (quizState.history.length === 0) backBtn.classList.add('hidden');
        renderMenu(prev.data, prev.title);
    }
}

// 3. Setup Quiz (Shuffle preference)
function startQuizSetup(filePath) {
    quizState.currentPath = filePath;
    content.innerHTML = `
        <div class="setup-box">
            <p>Sualları qarışdırmaq istəyirsiniz?</p>
            <button class="menu-btn" onclick="loadQuestions(true)">Bəli, qarışdır</button>
            <button class="menu-btn" onclick="loadQuestions(false)">Xeyr</button>
        </div>
    `;
}

// 4. Load Question JSON
async function loadQuestions(shuffle) {
    content.innerHTML = 'Suallar yüklənir...';
    try {
        const response = await fetch(quizState.currentPath);
        const data = await response.json();
        currentQuestions = data.questions;
        
        if (shuffle) {
            currentQuestions.sort(() => Math.random() - 0.5);
        }

        quizState.index = 0;
        quizState.correct = 0;
        quizState.incorrect = 0;
        showQuestion();
    } catch (e) {
        content.innerHTML = 'Sual faylı tapılmadı.';
    }
}

// 5. Display Question
function showQuestion() {
    const q = currentQuestions[quizState.index];
    stats.classList.remove('hidden');
    updateStats();

    let optionsHtml = '';
    // Prepare options (shuffle them)
    let options = q.options.map((text, idx) => ({ text, isCorrect: idx === q.correct }));
    options.sort(() => Math.random() - 0.5);

    options.forEach((opt, i) => {
        optionsHtml += `<button class="opt-btn" onclick="checkAnswer(this, ${opt.isCorrect})">
            ${String.fromCharCode(65 + i)}) ${opt.text}
        </button>`;
    });

    content.innerHTML = `
        <div class="question-card">
            ${q.image ? `<img src="${q.image}" class="q-img">` : ''}
            <p class="q-text"><strong>${q.question}</strong></p>
            <div class="options-grid">${optionsHtml}</div>
        </div>
    `;
}

function checkAnswer(btn, isCorrect) {
    const allBtns = document.querySelectorAll('.opt-btn');
    allBtns.forEach(b => b.disabled = true);

    if (isCorrect) {
        btn.classList.add('correct');
        quizState.correct++;
    } else {
        btn.classList.add('wrong');
        quizState.incorrect++;
        // Highlight the correct one
        // (In a real app, you'd find the index of the correct answer)
    }

    setTimeout(() => {
        quizState.index++;
        if (quizState.index < currentQuestions.length) {
            showQuestion();
        } else {
            finishQuiz();
        }
    }, 1200);
}

function updateStats() {
    document.getElementById('progress').innerText = `Sual: ${quizState.index + 1}/${currentQuestions.length}`;
    document.getElementById('score').innerText = `Düz: ${quizState.correct} | Səhv: ${quizState.incorrect}`;
}

function finishQuiz() {
    content.innerHTML = `
        <div class="result-card">
            <h2>Test Bitdi!</h2>
            <p>Düzgün: ${quizState.correct}</p>
            <p>Səhv: ${quizState.incorrect}</p>
            <button class="menu-btn" onclick="location.reload()">Ana Səhifə</button>
        </div>
    `;
}

init();
