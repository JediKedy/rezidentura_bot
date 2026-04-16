const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); // Tətbiqi tam ekrana yayır

let banksData = {};
let currentQuestions = [];
let quizState = { index: 0, correct: 0, incorrect: 0, history: [], currentPath: null };

const ICONS = {
    folder: `<svg ... >`, // Əvvəlki folder ikonu
    file: `<svg ... >`,   // Əvvəlki file ikonu
    check: `<svg ... >`   // Əvvəlki check ikonu
};

async function init() {
    try {
        const res = await fetch('banks.json');
        banksData = await res.json();
        setupSearch();
        renderMenu(banksData, "Kateqoriyalar");
    } catch (e) {
        document.getElementById('content').innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded-lg text-center">Fayllar yüklənmədi.</div>`;
    }
}

// 🔎 Axtarış Funksiyası
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.menu-item');
        items.forEach(item => {
            const text = item.querySelector('span').innerText.toLowerCase();
            item.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });
}

function renderMenu(data, title) {
    const container = document.getElementById('content');
    const searchContainer = document.getElementById('search-container');
    
    document.getElementById('title').innerText = title;
    document.getElementById('stats-bar').classList.add('hidden');
    
    // Əgər quiz başlayıbsa axtarışı gizlə
    searchContainer.classList.toggle('hidden', typeof data === 'string');
    container.innerHTML = '';

    if (typeof data === 'string') {
        startQuizSetup(data);
        return;
    }

    Object.keys(data).forEach(key => {
        const isFile = typeof data[key] === 'string';
        const btn = document.createElement('button');
        btn.className = "menu-item w-full flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm mb-2 active:scale-[0.98] transition-all";
        btn.innerHTML = `
            <div class="flex items-center gap-3">
                ${isFile ? ICONS.file : ICONS.folder}
                <span class="font-medium">${key}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4 opacity-30"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        `;
        btn.onclick = () => {
            quizState.history.push({data: data, title: title});
            document.getElementById('back-btn').classList.remove('hidden');
            document.getElementById('search-input').value = ''; // Axtarışı sıfırla
            renderMenu(data[key], key);
        };
        container.appendChild(btn);
    });
}

// ... goBack() və startQuizSetup() funksiyaları eyni qalır ...

function showQuestion() {
    const q = currentQuestions[quizState.index];
    document.getElementById('stats-bar').classList.remove('hidden');
    document.getElementById('search-container').classList.add('hidden'); // Quiz zamanı axtarışı bağla
    updateStats();

    const container = document.getElementById('content');
    container.innerHTML = `
        <div class="space-y-4 animate-in fade-in duration-300">
            ${q.image ? `<img src="${q.image}" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800">` : ''}
            <div class="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p class="text-lg font-medium leading-relaxed">${q.question}</p>
            </div>
            <div class="grid gap-2" id="options-box"></div>
            <div id="action-area" class="pt-4 hidden">
                <button onclick="nextStep()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                    Növbəti sual
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
            </div>
        </div>
    `;

    const optionsBox = document.getElementById('options-box');
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "option-btn flex items-start gap-3 w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left transition-all";
        btn.innerHTML = `
            <span class="flex-none flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold">${String.fromCharCode(65+idx)}</span>
            <span class="flex-1 text-sm md:text-base">${opt}</span>
        `;
        btn.onclick = () => selectOption(btn, idx);
        optionsBox.appendChild(btn);
    });
}

function selectOption(selectedBtn, selectedIdx) {
    const q = currentQuestions[quizState.index];
    const allBtns = document.querySelectorAll('.option-btn');
    const actionArea = document.getElementById('action-area');
    
    allBtns.forEach(b => b.disabled = true);

    if (selectedIdx === q.correct) {
        // DÜZGÜN
        selectedBtn.classList.add('!border-green-500', '!bg-green-50', 'dark:!bg-green-900/20');
        quizState.correct++;
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        // SƏHV
        selectedBtn.classList.add('!border-red-500', '!bg-red-50', 'dark:!bg-red-900/20');
        // Düzgün olanı göstər
        allBtns[q.correct].classList.add('!border-green-500', 'dark:!border-green-500/40', 'animate-pulse');
        quizState.incorrect++;
        tg.HapticFeedback.notificationOccurred('error');
    }

    // Növbəti düyməsini göstər
    actionArea.classList.remove('hidden');
}

function nextStep() {
    quizState.index++;
    if (quizState.index < currentQuestions.length) {
        showQuestion();
    } else {
        showResults();
    }
}

// ... updateStats() və showResults() eyni qalır ...

init();