// ─── Telegram WebApp init (single declaration) ───────────────────────────────
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ─── State ────────────────────────────────────────────────────────────────────
let banksData = {};
let currentQuestions = [];
let quizState = {
    index: 0,
    correct: 0,
    incorrect: 0,
    history: [],      // nav history: [{data, title}, ...]
    currentPath: null
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const ICONS = {
    folder: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-70"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-18.75 0a2.25 2.25 0 00-2.25 2.25v4.5A2.25 2.25 0 004.5 21.75h15a2.25 2.25 0 002.25-2.25v-4.5a2.25 2.25 0 00-2.25-2.25m-18.75 0V9a2.25 2.25 0 012.25-2.25h1.384a2.25 2.25 0 001.632-.833l1.157-1.157a2.25 2.25 0 011.632-.833h2.392a2.25 2.25 0 011.632.833l1.157 1.157a2.25 2.25 0 001.632.833H18a2.25 2.25 0 012.25 2.25V9" /></svg>`,
    file:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-500"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>`,
    check:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>`
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
    try {
        const res = await fetch('banks.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        banksData = await res.json();
        setupSearch();
        renderMenu(banksData, "Kateqoriyalar");
    } catch (e) {
        document.getElementById('content').innerHTML =
            `<div class="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-center">
                Xəta: Bank faylı yüklənə bilmədi.<br><small class="opacity-60">${e.message}</small>
             </div>`;
    }
}

// ─── Search ───────────────────────────────────────────────────────────────────
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.menu-item').forEach(item => {
            const text = item.querySelector('span')?.innerText?.toLowerCase() ?? '';
            item.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });
}

// ─── Menu / Navigation ────────────────────────────────────────────────────────
function renderMenu(data, title) {
    const container        = document.getElementById('content');
    const searchContainer  = document.getElementById('search-container');
    document.getElementById('title').innerText = title;
    document.getElementById('stats-bar').classList.add('hidden');

    // Leaf node → quiz file path
    if (typeof data === 'string') {
        searchContainer.classList.add('hidden');
        startQuizSetup(data);
        return;
    }

    // Clear search input on new menu render
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    searchContainer.classList.remove('hidden');
    container.innerHTML = '';

    Object.keys(data).forEach(key => {
        const isFile = typeof data[key] === 'string';
        const btn = document.createElement('button');
        btn.className =
            "menu-item w-full flex items-center justify-between p-4 " +
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 " +
            "rounded-xl mb-2 active:scale-95 transition-all";
        btn.innerHTML = `
            <div class="flex items-center gap-3">
                ${isFile ? ICONS.file : ICONS.folder}
                <span class="font-medium text-left">${key}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke-width="2" stroke="currentColor" class="w-4 h-4 opacity-30 flex-none">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
            </svg>`;
        btn.onclick = () => {
            // Deep-copy so goBack() restores original object
            quizState.history.push({ data: JSON.parse(JSON.stringify(data)), title });
            document.getElementById('back-btn').classList.remove('hidden');
            renderMenu(data[key], key);
        };
        container.appendChild(btn);
    });
}

function goBack() {
    if (quizState.history.length === 0) return;
    const prev = quizState.history.pop();
    if (quizState.history.length === 0) {
        document.getElementById('back-btn').classList.add('hidden');
    }
    // Reset quiz state on navigate back so counts don't bleed
    resetQuizState();
    renderMenu(prev.data, prev.title);
}

// ─── Quiz Setup ───────────────────────────────────────────────────────────────
function startQuizSetup(path) {
    quizState.currentPath = path;
    document.getElementById('content').innerHTML = `
        <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center animate-in">
            <h2 class="text-xl font-bold mb-2 text-blue-600">Hazırsınız?</h2>
            <p class="text-sm text-slate-400 mb-6">Başlamaq üçün rejim seçin</p>
            <div class="grid gap-3">
                <button onclick="loadQuiz(true)"
                    class="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
                    Suallar qarışdırılsın
                </button>
                <button onclick="loadQuiz(false)"
                    class="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold active:scale-95 transition-transform">
                    Suallar sıralı olsun
                </button>
            </div>
        </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function shuffleOptions(q) {
    const correctText = q.options[q.correct];
    const shuffled = [...q.options];
    shuffleArray(shuffled);
    return { ...q, options: shuffled, correct: shuffled.indexOf(correctText) };
}

function resetQuizState() {
    quizState.index     = 0;
    quizState.correct   = 0;
    quizState.incorrect = 0;
    currentQuestions    = [];
}

// ─── Load Quiz ────────────────────────────────────────────────────────────────
async function loadQuiz(shuffle) {
    // Show loading state
    document.getElementById('content').innerHTML =
        `<div class="flex flex-col items-center gap-3 py-12 text-slate-400">
            <svg class="animate-spin w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span class="text-sm">Suallar yüklənir...</span>
         </div>`;

    try {
        const res = await fetch(quizState.currentPath);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        let questions = [...data.questions];
        if (shuffle) shuffleArray(questions);

        // Reset FIRST, then assign — resetQuizState() clears currentQuestions
        resetQuizState();
        currentQuestions = questions.map(q => shuffleOptions(q));
        showQuestion();
    } catch (e) {
        document.getElementById('content').innerHTML =
            `<div class="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-center">
                Sual faylı yüklənmədi!<br><small class="opacity-60">${e.message}</small>
             </div>`;
    }
}

// ─── Show Question ────────────────────────────────────────────────────────────
function showQuestion() {
    const q = currentQuestions[quizState.index];
    document.getElementById('stats-bar').classList.remove('hidden');
    updateStats();

    const container = document.getElementById('content');
    container.innerHTML = `
        <div class="space-y-4 animate-in">
            ${q.image ? `<img src="${q.image}" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 object-cover">` : ''}
            <div class="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <p class="text-base font-semibold leading-relaxed">${q.question}</p>
            </div>
            <div class="grid gap-2" id="options-box"></div>
            <div id="action-area" class="pt-2 hidden">
                <button onclick="nextStep()"
                    class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all">
                    NÖVBƏTİ SUAL →
                </button>
            </div>
        </div>`;

    const optionsBox = document.getElementById('options-box');
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className =
            "option-btn flex items-start gap-3 w-full p-4 bg-white dark:bg-slate-900 " +
            "border border-slate-200 dark:border-slate-800 rounded-xl text-left " +
            "transition-all active:bg-blue-50 dark:active:bg-blue-900/20";
        btn.innerHTML = `
            <span class="flex-none flex items-center justify-center w-6 h-6 rounded-full
                         bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500">
                ${String.fromCharCode(65 + idx)}
            </span>
            <span class="flex-1 text-sm md:text-base">${opt}</span>`;
        btn.onclick = () => selectOption(btn, idx);
        optionsBox.appendChild(btn);
    });
}

// ─── Select Option ────────────────────────────────────────────────────────────
function selectOption(selectedBtn, selectedIdx) {
    const q       = currentQuestions[quizState.index];
    const allBtns = document.querySelectorAll('.option-btn');
    const actionArea = document.getElementById('action-area');

    // Disable all options immediately
    allBtns.forEach(b => { b.disabled = true; b.style.cursor = 'default'; });

    if (selectedIdx === q.correct) {
        selectedBtn.classList.add('!border-green-500', '!bg-green-50', 'dark:!bg-green-900/20');
        quizState.correct++;
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        selectedBtn.classList.add('!border-red-500', '!bg-red-50', 'dark:!bg-red-900/20');
        // Highlight the correct answer
        allBtns[q.correct].classList.add(
            '!border-green-500', '!bg-green-50',
            'dark:!bg-green-900/20', 'animate-pulse'
        );
        quizState.incorrect++;
        tg.HapticFeedback.notificationOccurred('error');
    }

    updateStats();
    actionArea.classList.remove('hidden');
}

// ─── Next / Results ───────────────────────────────────────────────────────────
function nextStep() {
    quizState.index++;
    if (quizState.index < currentQuestions.length) {
        showQuestion();
    } else {
        showResults();
    }
}

function updateStats() {
    document.getElementById('progress').innerText =
        `${quizState.index + 1}/${currentQuestions.length}`;
    document.getElementById('score-correct').innerText = quizState.correct;
    document.getElementById('score-wrong').innerText   = quizState.incorrect;
}

function showResults() {
    document.getElementById('stats-bar').classList.add('hidden');
    const total      = currentQuestions.length;
    const pct        = Math.round((quizState.correct / total) * 100);
    const emoji      = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';

    document.getElementById('content').innerHTML = `
        <div class="bg-white dark:bg-slate-900 p-8 rounded-3xl text-center border border-slate-200 dark:border-slate-800 zoom-in shadow-sm">
            <div class="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                ${ICONS.check}
            </div>
            <p class="text-4xl mb-2">${emoji}</p>
            <h2 class="text-2xl font-bold mb-1">Test Bitdi!</h2>
            <p class="text-slate-400 text-sm mb-6">${pct}% düzgün cavab</p>
            <div class="grid grid-cols-2 gap-4 mb-8">
                <div class="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                    <p class="text-3xl font-black text-green-600">${quizState.correct}</p>
                    <p class="text-xs uppercase tracking-wide opacity-60 mt-1">Düzgün</p>
                </div>
                <div class="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <p class="text-3xl font-black text-red-600">${quizState.incorrect}</p>
                    <p class="text-xs uppercase tracking-wide opacity-60 mt-1">Səhv</p>
                </div>
            </div>
            <div class="grid gap-3">
                <button onclick="loadQuiz(true)"
                    class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
                    Yenidən
                </button>
                <button onclick="returnToHome()"
                    class="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold active:scale-95 transition-transform">
                    Ana Səhifə
                </button>
            </div>
        </div>`;

    tg.HapticFeedback.notificationOccurred('warning');
}

// ─── Return home without page reload ─────────────────────────────────────────
function returnToHome() {
    quizState.history = [];
    resetQuizState();
    document.getElementById('back-btn').classList.add('hidden');
    renderMenu(banksData, "Kateqoriyalar");
}

// ─── Jump to Question ─────────────────────────────────────────────────────────
function jumpToQuestion() {
    const modal = document.getElementById('jump-modal');
    const input = document.getElementById('jump-input');
    const hint  = document.getElementById('jump-hint');
    const total = currentQuestions.length;

    if (!modal || !input || total === 0) return;

    input.value       = '';
    input.placeholder = `1 – ${total}`;
    if (hint) hint.textContent = `1 ilə ${total} arasında rəqəm daxil edin`;

    modal.classList.remove('hidden');
    // Small delay so the modal is visible before focusing
    setTimeout(() => input.focus(), 120);
}

function closeJumpModal() {
    const modal = document.getElementById('jump-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmJump() {
    const input = document.getElementById('jump-input');
    const total = currentQuestions.length;
    if (!input) return;

    const num = parseInt(input.value, 10);

    if (!isNaN(num) && num >= 1 && num <= total) {
        quizState.index = num - 1;
        closeJumpModal();
        showQuestion();
        tg.HapticFeedback.impactOccurred('medium');
    } else {
        input.classList.add('animate-shake');
        tg.HapticFeedback.notificationOccurred('error');
        setTimeout(() => input.classList.remove('animate-shake'), 400);
    }
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();