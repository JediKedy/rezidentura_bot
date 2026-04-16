const tg = window.Telegram.WebApp;
tg.ready();
tg.expand(); // Tətbiqi tam ekrana yayır

let banksData = {};
let currentQuestions = [];
let quizState = { index: 0, correct: 0, incorrect: 0, history: [], currentPath: null };

const ICONS = {
    folder: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-70"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-18.75 0a2.25 2.25 0 00-2.25 2.25v4.5A2.25 2.25 0 004.5 21.75h15a2.25 2.25 0 002.25-2.25v-4.5a2.25 2.25 0 00-2.25-2.25m-18.75 0V9a2.25 2.25 0 012.25-2.25h1.384a2.25 2.25 0 001.632-.833l1.157-1.157a2.25 2.25 0 011.632-.833h2.392a2.25 2.25 0 011.632.833l1.157 1.157a2.25 2.25 0 001.632.833H18a2.25 2.25 0 012.25 2.25V9" /></svg>`,
    file: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-500"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>`
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

function goBack() {
    const prev = quizState.history.pop();
    if (quizState.history.length === 0) document.getElementById('back-btn').classList.add('hidden');
    renderMenu(prev.data, prev.title);
}

function startQuizSetup(path) {
    quizState.currentPath = path;
    document.getElementById('content').innerHTML = `
        <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <h2 class="text-lg font-bold mb-4">Hazırsınız?</h2>
            <div class="grid gap-3">
                <button onclick="loadQuiz(true)" class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold">Qarışdıraraq başla</button>
                <button onclick="loadQuiz(false)" class="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-semibold text-slate-600 dark:text-slate-300">Ardıcıllıqla başla</button>
            </div>
        </div>
    `;
}

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

function updateStats() {
    document.getElementById('progress').innerText = `${quizState.index + 1}/${currentQuestions.length}`;
    document.getElementById('score-correct').innerText = quizState.correct;
    document.getElementById('score-wrong').innerText = quizState.incorrect;
}

function showResults() {
    document.getElementById('content').innerHTML = `
        <div class="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl text-center border border-slate-200 dark:border-slate-800">
            <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                ${ICONS.check}
            </div>
            <h2 class="text-2xl font-bold mb-2">Nəticə</h2>
            <div class="flex justify-center gap-6 my-6">
                <div><p class="text-2xl font-bold text-green-500">${quizState.correct}</p><p class="text-xs opacity-60">Düzgün</p></div>
                <div><p class="text-2xl font-bold text-red-500">${quizState.incorrect}</p><p class="text-xs opacity-60">Səhv</p></div>
            </div>
            <button onclick="location.reload()" class="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-bold">Yenidən Başla</button>
        </div>
    `;
}

init();