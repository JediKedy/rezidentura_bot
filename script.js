// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM WEBAPP INIT
// ═══════════════════════════════════════════════════════════════════════════════
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════
let banksData        = {};
let currentQuestions = [];
let timerInterval    = null;
let lastShuffle      = true;
let currentFetch     = null; // FIX #3 — AbortController üçün

const TIMER_SECONDS  = 30;

let quizState = {
    index:        0,
    correct:      0,
    incorrect:    0,
    skipped:      0, // FIX #4 — skipped suallar
    history:      [],
    currentPath:  null,
    currentTitle: '',
    wrongIndices: [],
    bookmarks:    new Set(),
    answered:     {},
    timerLeft:    TIMER_SECONDS,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIX #1 — XSS SANITIZER
// innerHTML-ə yazılmadan əvvəl bütün user/data məlumatları bu funksiyadən keçir
// ═══════════════════════════════════════════════════════════════════════════════
function sanitize(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLOUD STORAGE  (graceful fallback to localStorage)
// ═══════════════════════════════════════════════════════════════════════════════
const CS = {
    get(key) {
        return new Promise(resolve => {
            try {
                tg.CloudStorage.getItem(key, (err, val) => resolve(err ? null : val));
            } catch (e) {
                // FIX #5 — xəta log edilir, itmir
                console.warn('CloudStorage.get fallback:', e);
                resolve(localStorage.getItem(key));
            }
        });
    },
    set(key, value) {
        return new Promise(resolve => {
            try {
                tg.CloudStorage.setItem(key, value, () => resolve());
            } catch (e) {
                // FIX #5 — xəta log edilir, itmir
                console.warn('CloudStorage.set fallback:', e);
                localStorage.setItem(key, value);
                resolve();
            }
        });
    },
    async getJSON(key, fallback = null) {
        const raw = await CS.get(key);
        try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
    },
    setJSON(key, val) { return CS.set(key, JSON.stringify(val)); }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════════
const ICONS = {
    folder:      `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 opacity-70"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-18.75 0a2.25 2.25 0 00-2.25 2.25v4.5A2.25 2.25 0 004.5 21.75h15a2.25 2.25 0 002.25-2.25v-4.5a2.25 2.25 0 00-2.25-2.25m-18.75 0V9a2.25 2.25 0 012.25-2.25h1.384a2.25 2.25 0 001.632-.833l1.157-1.157a2.25 2.25 0 011.632-.833h2.392a2.25 2.25 0 011.632.833l1.157 1.157a2.25 2.25 0 001.632.833H18a2.25 2.25 0 012.25 2.25V9"/></svg>`,
    file:        `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-blue-500"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`,
    check:       `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-8 h-8"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>`,
    bookmark:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/></svg>`,
    bookmarkFill:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-yellow-500"><path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clip-rule="evenodd"/></svg>`,
    clock:       `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════════════════
async function init() {
    setupOfflineBanner();
    tg.BackButton.onClick(handleBackButton);

    const user = tg.initDataUnsafe?.user;
    if (user?.first_name) {
        // sanitize istifadəçi adına da tətbiq edilir
        document.getElementById('user-greeting').textContent = `Salam, ${sanitize(user.first_name)}! 👋`;
    }

    try {
        const res = await fetch('banks.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        banksData = await res.json();
        setupSearch();
        await renderMenu(banksData, "Kateqoriyalar");
    } catch (e) {
        document.getElementById('content').innerHTML =
            `<div class="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-center">
                Xəta: banks.json yüklənə bilmədi.<br><small class="opacity-60">${sanitize(e.message)}</small>
             </div>`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM BACK BUTTON
// ═══════════════════════════════════════════════════════════════════════════════
function handleBackButton() {
    tg.HapticFeedback.impactOccurred('light');
    goBack();
}

function syncTgBackButton() {
    quizState.history.length > 0 ? tg.BackButton.show() : tg.BackButton.hide();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM MAIN BUTTON
// FIX #6 — onClick çoxlu qeydiyyatının qarşısı alınır
// ═══════════════════════════════════════════════════════════════════════════════
function showTgMainButton(text, callback) {
    tg.MainButton.offClick();         // FIX #6 — əvvəlki handler silinir
    tg.MainButton.setText(text);
    tg.MainButton.onClick(callback);
    tg.MainButton.show();
}

function hideTgMainButton() {
    tg.MainButton.offClick();         // FIX #6 — burada da təmizlə
    tg.MainButton.hide();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.menu-item').forEach(item => {
            const text = item.querySelector('.item-label')?.innerText?.toLowerCase() ?? '';
            item.style.display = text.includes(term) ? 'flex' : 'none';
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLOUD STORAGE — STATS / FAVORITES / RECENTS
// ═══════════════════════════════════════════════════════════════════════════════
async function loadStats()            { return await CS.getJSON('quiz_stats', {}); }
async function loadFavorites()        { return await CS.getJSON('quiz_favorites', []); }
async function saveFavorites(favs)    { await CS.setJSON('quiz_favorites', favs); }
async function loadRecents()          { return await CS.getJSON('quiz_recents', []); }

async function saveResult(path, correct, total) {
    const stats = await loadStats();
    if (!stats[path]) stats[path] = { attempts: 0, best: 0, totalCorrect: 0, totalQ: 0 };
    const s = stats[path];
    s.attempts++;
    s.totalCorrect += correct;
    s.totalQ       += total;
    s.best          = Math.max(s.best, Math.round((correct / total) * 100));
    await CS.setJSON('quiz_stats', stats);
    return s;
}

async function addRecent(path, title) {
    let recents = await loadRecents();
    recents = recents.filter(r => r.path !== path);
    recents.unshift({ path, title, ts: Date.now() });
    if (recents.length > 5) recents = recents.slice(0, 5);
    await CS.setJSON('quiz_recents', recents);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MENU / NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════
async function renderMenu(data, title) {
    const container       = document.getElementById('content');
    const searchContainer = document.getElementById('search-container');
    document.getElementById('title').innerText = title;
    document.getElementById('stats-bar').classList.add('hidden');
    document.getElementById('user-greeting').classList.toggle('hidden', quizState.history.length > 0);
    stopTimer();
    syncTgBackButton();
    hideTgMainButton();

    if (typeof data === 'string') {
        searchContainer.classList.add('hidden');
        await startQuizSetup(data, title);
        return;
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    searchContainer.classList.remove('hidden');
    container.innerHTML = '';

    // ── Home screen: Favorites + Recents ─────────────────────────────────────
    if (quizState.history.length === 0) {
        const [recents, favs] = await Promise.all([loadRecents(), loadFavorites()]);

        if (favs.length > 0) {
            container.insertAdjacentHTML('beforeend',
                `<p class="text-xs font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">⭐ Sevimlilər</p>`);
            favs.forEach(fav => container.appendChild(makeQuickCard(fav, '⭐')));
            container.insertAdjacentHTML('beforeend', `<div class="mb-2"></div>`);
        }

        if (recents.length > 0) {
            container.insertAdjacentHTML('beforeend',
                `<p class="text-xs font-bold uppercase tracking-widest text-slate-400 px-1 mb-2">🕐 Son baxılanlar</p>`);
            recents.forEach(r => container.appendChild(makeQuickCard(r, '🕐')));
            container.insertAdjacentHTML('beforeend',
                `<p class="text-xs font-bold uppercase tracking-widest text-slate-400 px-1 mb-2 mt-4">📂 Bütün kateqoriyalar</p>`);
        }
    }

    // ── Menu items with best-score badge ─────────────────────────────────────
    const stats = await loadStats();
    Object.keys(data).forEach(key => {
        const isFile     = typeof data[key] === 'string';
        const filePath   = isFile ? data[key] : null;
        const pathStat   = filePath ? stats[filePath] : null;
        const bestBadge  = pathStat
            ? `<span class="text-xs px-2 py-0.5 rounded-full flex-none ${
                pathStat.best >= 80
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
              }">${pathStat.best}%</span>`
            : '';

        const btn = document.createElement('button');
        btn.className =
            "menu-item w-full flex items-center justify-between p-4 " +
            "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 " +
            "rounded-xl mb-2 active:scale-95 transition-all";
        // FIX #1 — key sanitize edilir
        btn.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                ${isFile ? ICONS.file : ICONS.folder}
                <span class="item-label font-medium text-left truncate">${sanitize(key)}</span>
            </div>
            <div class="flex items-center gap-2 flex-none ml-2">
                ${bestBadge}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     stroke-width="2" stroke="currentColor" class="w-4 h-4 opacity-30">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                </svg>
            </div>`;
        btn.onclick = () => {
            quizState.history.push({ data: JSON.parse(JSON.stringify(data)), title });
            syncTgBackButton();
            renderMenu(data[key], key);
        };
        container.appendChild(btn);
    });
}

function makeQuickCard(item, icon) {
    const btn = document.createElement('button');
    btn.className =
        "menu-item w-full flex items-center justify-between p-3 " +
        "bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 " +
        "rounded-xl mb-2 active:scale-95 transition-all";
    // FIX #1 — title sanitize edilir
    btn.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
            ${ICONS.file}
            <span class="item-label text-sm font-medium text-left truncate">${sanitize(item.title)}</span>
        </div>
        <span class="text-lg flex-none">${icon}</span>`;
    btn.onclick = () => {
        quizState.history.push({ data: JSON.parse(JSON.stringify(banksData)), title: 'Kateqoriyalar' });
        syncTgBackButton();
        startQuizSetup(item.path, item.title);
    };
    return btn;
}

function goBack() {
    if (quizState.history.length === 0) return;
    stopTimer();
    const prev = quizState.history.pop();
    resetQuizState();
    syncTgBackButton();
    renderMenu(prev.data, prev.title);
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ SETUP  (with per-quiz stats + favorite toggle)
// ═══════════════════════════════════════════════════════════════════════════════
async function startQuizSetup(path, title) {
    quizState.currentPath  = path;
    quizState.currentTitle = title || path;

    const [stats, favs] = await Promise.all([loadStats(), loadFavorites()]);
    const s    = stats[path];
    const isFav = favs.some(f => f.path === path);

    const statHtml = s
        ? `<div class="grid grid-cols-3 gap-2 mb-5 text-center">
               <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                   <p class="text-lg font-black">${s.attempts}</p>
                   <p class="text-xs opacity-50">Cəhd</p>
               </div>
               <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                   <p class="text-lg font-black text-green-500">${s.best}%</p>
                   <p class="text-xs opacity-50">Ən yaxşı</p>
               </div>
               <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                   <p class="text-lg font-black">${s.totalQ > 0 ? Math.round(s.totalCorrect / s.totalQ * 100) : 0}%</p>
                   <p class="text-xs opacity-50">Ortalama</p>
               </div>
           </div>`
        : `<p class="text-sm text-slate-400 mb-5">İlk dəfə açılır 🆕</p>`;

    // FIX #2 — onclick inline string əvəzinə data-atributları istifadə edilir
    const container = document.getElementById('content');
    container.innerHTML = `
        <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center animate-in">
            <div class="flex items-center justify-between mb-1">
                <h2 class="text-xl font-bold text-blue-600 flex-1 text-center">Hazırsınız?</h2>
                <button id="fav-toggle-btn"
                    class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Sevimlilərə əlavə et">
                    ${isFav ? ICONS.bookmarkFill : ICONS.bookmark}
                </button>
            </div>
            <p class="text-sm text-slate-400 mb-4">${sanitize(quizState.currentTitle)}</p>
            ${statHtml}
            <div class="grid gap-3">
                <button id="shuffle-start-btn"
                    class="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-transform shadow-lg shadow-blue-500/20">
                    🔀 Qarışdıraraq başla
                </button>
                <button id="seq-start-btn"
                    class="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold active:scale-95 transition-transform">
                    📋 Ardıcıllıqla başla
                </button>
            </div>
        </div>`;

    // FIX #2 — data-atributlardan oxuyaraq təhlükəsiz şəkildə handler qoşulur
    document.getElementById('fav-toggle-btn').addEventListener('click', () => {
        toggleFavorite(quizState.currentPath, quizState.currentTitle);
    });
    document.getElementById('shuffle-start-btn').addEventListener('click', () => loadQuiz(true));
    document.getElementById('seq-start-btn').addEventListener('click', () => loadQuiz(false));

    await addRecent(path, quizState.currentTitle);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function shuffleOptions(q) {
    const correctText = q.options[q.correct];
    const shuffled    = [...q.options];
    shuffleArray(shuffled);
    return { ...q, options: shuffled, correct: shuffled.indexOf(correctText) };
}

function resetQuizState() {
    quizState.index        = 0;
    quizState.correct      = 0;
    quizState.incorrect    = 0;
    quizState.skipped      = 0; // FIX #4
    quizState.wrongIndices = [];
    quizState.bookmarks    = new Set();
    quizState.answered     = {};
    quizState.timerLeft    = TIMER_SECONDS;
    currentQuestions       = [];
    stopTimer();
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD QUIZ
// FIX #3 — AbortController ilə köhnə fetch ləğv edilir
// ═══════════════════════════════════════════════════════════════════════════════
async function loadQuiz(shuffle, questionsOverride = null) {
    lastShuffle = shuffle;
    stopTimer();

    // FIX #3 — əvvəlki fetch varsa ləğv et
    if (currentFetch) {
        currentFetch.abort();
        currentFetch = null;
        cacheQuizFile(quizState.currentPath);
    }

    document.getElementById('content').innerHTML =
        `<div class="flex flex-col items-center gap-3 py-12 text-slate-400">
            <svg class="animate-spin w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span class="text-sm">Suallar yüklənir...</span>
         </div>`;

    try {
        let questions;
        if (questionsOverride) {
            questions = [...questionsOverride];
        } else {
            // FIX #3 — AbortController yaradılır
            const ctrl = new AbortController();
            currentFetch = ctrl;
            const res = await fetch(quizState.currentPath, { signal: ctrl.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            questions = [...data.questions];
            currentFetch = null;
        }

        if (shuffle) shuffleArray(questions);
        resetQuizState();
        currentQuestions = questions.map(q => shuffleOptions(q));
        showQuestion();
    } catch (e) {
        // FIX #3 — abort xətası normal xəta kimi göstərilmir
        if (e.name === 'AbortError') return;
        document.getElementById('content').innerHTML =
            `<div class="p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-center">
                Sual faylı yüklənmədi!<br><small class="opacity-60">${sanitize(e.message)}</small>
             </div>`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════════════════════════
function startTimer() {
    stopTimer();
    quizState.timerLeft = TIMER_SECONDS;
    updateTimerUI();
    timerInterval = setInterval(() => {
        quizState.timerLeft--;
        updateTimerUI();
        if (quizState.timerLeft <= 0) { stopTimer(); timeUp(); }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerUI() {
    const el  = document.getElementById('timer-display');
    const bar = document.getElementById('timer-bar');
    if (!el) return;
    const t = quizState.timerLeft;
    el.textContent = t;
    const color = t <= 10 ? 'text-red-500' : t <= 20 ? 'text-yellow-500' : 'text-blue-500';
    el.className   = `font-bold tabular-nums transition-colors ${color}`;
    if (bar) {
        bar.style.width = `${(t / TIMER_SECONDS) * 100}%`;
        bar.className   = `h-1 rounded-full transition-all duration-1000 ${
            t <= 10 ? 'bg-red-500' : t <= 20 ? 'bg-yellow-500' : 'bg-blue-500'
        }`;
    }
}

function timeUp() {
    tg.HapticFeedback.notificationOccurred('error');
    const q       = currentQuestions[quizState.index];
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => { b.disabled = true; b.style.cursor = 'default'; });
    if (allBtns[q.correct]) {
        allBtns[q.correct].classList.add('!border-green-500', '!bg-green-50', 'dark:!bg-green-900/20');
    }
    quizState.incorrect++;
    quizState.wrongIndices.push(quizState.index);
    // FIX #4 — skipped kimi qeyd edilir (vaxt bitib cavablanmayan)
    quizState.skipped++;
    quizState.answered[quizState.index] = 'skipped';

    const actionArea = document.getElementById('action-area');
    if (actionArea) {
        actionArea.innerHTML = `
            <p class="text-center text-red-500 font-bold mb-3 animate-in">⏰ Vaxt bitdi!</p>
            <button id="time-up-next-btn"
                class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all">
                NÖVBƏTİ SUAL →
            </button>`;
        // FIX #2 — onclick inline əvəzinə addEventListener
        document.getElementById('time-up-next-btn').addEventListener('click', nextStep);
        actionArea.classList.remove('hidden');
    }
    tg.MainButton.enable();
    tg.MainButton.color = '#2563EB';
    updateStats();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHOW QUESTION
// ═══════════════════════════════════════════════════════════════════════════════
function showQuestion() {
    const q            = currentQuestions[quizState.index];
    const isBookmarked = quizState.bookmarks.has(quizState.index);
    document.getElementById('stats-bar').classList.remove('hidden');
    updateStats();

    document.getElementById('content').innerHTML = `
        <div class="space-y-3 animate-in">
            ${q.image ? `<img src="${sanitize(q.image)}" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 object-cover">` : ''}

            <!-- Progress bar / timer -->
            <div class="bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div id="timer-bar" class="h-1.5 rounded-full bg-blue-500 transition-all duration-1000" style="width:100%"></div>
            </div>

            <!-- Question card -->
            <div class="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div class="flex items-start justify-between gap-3">
                    <p class="text-base font-semibold leading-relaxed flex-1">${sanitize(q.question)}</p>
                    <button id="bookmark-btn"
                        class="flex-none p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        ${isBookmarked ? ICONS.bookmarkFill : ICONS.bookmark}
                    </button>
                </div>
                <div class="flex items-center gap-1 text-xs text-slate-400 mt-3">
                    ${ICONS.clock}
                    <span id="timer-display" class="font-bold tabular-nums text-blue-500">${TIMER_SECONDS}</span>
                    <span>saniyə</span>
                </div>
            </div>

            <!-- Options -->
            <div class="grid gap-2" id="options-box"></div>

            <!-- Action area -->
            <div id="action-area" class="pt-1 hidden">
                <button id="next-question-btn"
                    class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all">
                    NÖVBƏTİ SUAL →
                </button>
            </div>
        </div>`;

    // FIX #2 — bookmark üçün addEventListener
    document.getElementById('bookmark-btn').addEventListener('click', toggleBookmark);
    // FIX #2 — next button üçün addEventListener
    document.getElementById('next-question-btn').addEventListener('click', nextStep);

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
            <span class="flex-1 text-sm md:text-base">${sanitize(opt)}</span>`;
        btn.addEventListener('click', () => selectOption(btn, idx));
        optionsBox.appendChild(btn);
    });

    // Telegram MainButton — disabled until answered
    showTgMainButton('NÖVBƏTİ SUAL →', nextStep);
    tg.MainButton.disable();
    tg.MainButton.color = '#94a3b8';

    startTimer();
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKMARK
// ═══════════════════════════════════════════════════════════════════════════════
function toggleBookmark() {
    const idx = quizState.index;
    if (quizState.bookmarks.has(idx)) {
        quizState.bookmarks.delete(idx);
        tg.HapticFeedback.impactOccurred('light');
    } else {
        quizState.bookmarks.add(idx);
        tg.HapticFeedback.impactOccurred('medium');
    }
    const btn = document.getElementById('bookmark-btn');
    if (btn) btn.innerHTML = quizState.bookmarks.has(idx) ? ICONS.bookmarkFill : ICONS.bookmark;
    updateStats();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT OPTION
// ═══════════════════════════════════════════════════════════════════════════════
function selectOption(selectedBtn, selectedIdx) {
    stopTimer();
    const q          = currentQuestions[quizState.index];
    const allBtns    = document.querySelectorAll('.option-btn');
    const actionArea = document.getElementById('action-area');

    allBtns.forEach(b => { b.disabled = true; b.style.cursor = 'default'; });

    if (selectedIdx === q.correct) {
        selectedBtn.classList.add('!border-green-500', '!bg-green-50', 'dark:!bg-green-900/20');
        quizState.correct++;
        quizState.answered[quizState.index] = true;
        tg.HapticFeedback.notificationOccurred('success');
    } else {
        selectedBtn.classList.add('!border-red-500', '!bg-red-50', 'dark:!bg-red-900/20');
        allBtns[q.correct].classList.add('!border-green-500', '!bg-green-50', 'dark:!bg-green-900/20', 'animate-pulse');
        quizState.incorrect++;
        quizState.wrongIndices.push(quizState.index);
        quizState.answered[quizState.index] = false;
        tg.HapticFeedback.notificationOccurred('error');
    }

    updateStats();
    actionArea.classList.remove('hidden');

    tg.MainButton.enable();
    tg.MainButton.color = '#2563EB';
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEXT / RESULTS
// ═══════════════════════════════════════════════════════════════════════════════
function nextStep() {
    quizState.index++;
    if (quizState.index < currentQuestions.length) showQuestion();
    else showResults();
}

function updateStats() {
    const total   = currentQuestions.length;
    const current = Math.min(quizState.index + 1, total);
    document.getElementById('progress').innerText      = `${current}/${total}`;
    document.getElementById('score-correct').innerText = quizState.correct;
    document.getElementById('score-wrong').innerText   = quizState.incorrect;
    const bmEl = document.getElementById('bookmark-count');
    if (bmEl) bmEl.textContent = quizState.bookmarks.size > 0 ? ` 🔖${quizState.bookmarks.size}` : '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS SCREEN
// FIX #4 — skipped suallar ayrıca göstərilir
// ═══════════════════════════════════════════════════════════════════════════════
async function showResults() {
    stopTimer();
    hideTgMainButton();
    document.getElementById('stats-bar').classList.add('hidden');

    const total   = currentQuestions.length;
    const pct     = Math.round((quizState.correct / total) * 100);
    const emoji   = pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪';
    const stars   = pct >= 80 ? '⭐⭐⭐' : pct >= 60 ? '⭐⭐' : pct >= 40 ? '⭐' : '';

    // FIX #4 — skipped count hesablanır
    const skippedCount = Object.values(quizState.answered)
        .filter(v => v === 'skipped').length;

    const stat     = await saveResult(quizState.currentPath, quizState.correct, total);
    const hasWrong = quizState.wrongIndices.length > 0;
    const hasBM    = quizState.bookmarks.size > 0;

    // FIX #4 — skipped bloku şərtli göstərilir
    const skippedHtml = skippedCount > 0
        ? `<div class="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/30">
               <p class="text-3xl font-black text-yellow-500">${skippedCount}</p>
               <p class="text-xs uppercase tracking-wide opacity-60 mt-1">Keçildi ⏰</p>
           </div>`
        : '';

    document.getElementById('content').innerHTML = `
        <div class="bg-white dark:bg-slate-900 p-7 rounded-3xl text-center border border-slate-200 dark:border-slate-800 zoom-in shadow-sm space-y-4">
            <div class="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                ${ICONS.check}
            </div>
            <div>
                <p class="text-4xl mb-1">${emoji}</p>
                <h2 class="text-2xl font-bold">Test Bitdi!</h2>
                ${stars ? `<p class="text-xl mt-1">${stars}</p>` : ''}
                <p class="text-slate-400 text-sm mt-1">${pct}% düzgün cavab</p>
            </div>

            <div class="grid grid-cols-${skippedCount > 0 ? '3' : '2'} gap-3">
                <div class="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30">
                    <p class="text-3xl font-black text-green-600">${quizState.correct}</p>
                    <p class="text-xs uppercase tracking-wide opacity-60 mt-1">Düzgün</p>
                </div>
                <div class="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <p class="text-3xl font-black text-red-600">${quizState.incorrect - skippedCount}</p>
                    <p class="text-xs uppercase tracking-wide opacity-60 mt-1">Səhv</p>
                </div>
                ${skippedHtml}
            </div>

            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p class="text-base font-black">${stat.attempts}</p>
                    <p class="text-xs opacity-50">Cəhd</p>
                </div>
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p class="text-base font-black text-green-500">${stat.best}%</p>
                    <p class="text-xs opacity-50">Ən yaxşı</p>
                </div>
                <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p class="text-base font-black">${Math.round(stat.totalCorrect / stat.totalQ * 100)}%</p>
                    <p class="text-xs opacity-50">Ortalama</p>
                </div>
            </div>

            <div class="grid gap-2">
                <button id="show-review-btn"
                    class="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold active:scale-95 transition-transform text-sm">
                    📋 Cavabları göstər
                </button>
                ${hasWrong ? `
                <button id="retry-wrong-btn"
                    class="w-full py-3 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl font-bold active:scale-95 transition-transform text-sm">
                    🔁 Səhvləri təkrar et (${quizState.wrongIndices.length})
                </button>` : ''}
                ${hasBM ? `
                <button id="retry-bm-btn"
                    class="w-full py-3 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-2xl font-bold active:scale-95 transition-transform text-sm">
                    🔖 İşarələnənləri təkrar et (${quizState.bookmarks.size})
                </button>` : ''}
                <button id="share-btn"
                    class="w-full py-3 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl font-bold active:scale-95 transition-transform text-sm">
                    📤 Nəticəni paylaş
                </button>
                <button id="restart-btn"
                    class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
                    🔀 Yenidən
                </button>
                <button id="home-btn"
                    class="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold active:scale-95 transition-transform">
                    🏠 Ana Səhifə
                </button>
            </div>
        </div>`;

    // FIX #2 — bütün onclick-lər addEventListener ilə əvəz edilir
    document.getElementById('show-review-btn').addEventListener('click', showReview);
    if (hasWrong) document.getElementById('retry-wrong-btn').addEventListener('click', retryWrong);
    if (hasBM)    document.getElementById('retry-bm-btn').addEventListener('click', retryBookmarks);
    document.getElementById('share-btn').addEventListener('click', () => shareResult(pct, quizState.correct, total));
    document.getElementById('restart-btn').addEventListener('click', () => loadQuiz(true));
    document.getElementById('home-btn').addEventListener('click', returnToHome);

    tg.HapticFeedback.notificationOccurred('warning');
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEW — all questions with correct answers highlighted
// ═══════════════════════════════════════════════════════════════════════════════
function showReview() {
    document.getElementById('title').innerText = 'Cavablar';
    const container = document.getElementById('content');
    container.innerHTML = '';

    currentQuestions.forEach((q, idx) => {
        const ans         = quizState.answered[idx];
        const wasSkipped  = ans === 'skipped';
        const wasAnswered = ans !== undefined && !wasSkipped;
        const wasCorrect  = ans === true;
        // FIX #4 — skipped ayrıca ikonu var
        const statusIcon  = wasSkipped ? '⏰' : !wasAnswered ? '➖' : wasCorrect ? '✅' : '❌';

        const card = document.createElement('div');
        card.className =
            "p-4 bg-white dark:bg-slate-900 border rounded-2xl mb-3 " +
            (wasCorrect  ? 'border-green-200 dark:border-green-900/40' :
             wasSkipped  ? 'border-yellow-200 dark:border-yellow-900/40' :
             wasAnswered ? 'border-red-200 dark:border-red-900/40' :
                           'border-slate-200 dark:border-slate-800');
        card.innerHTML = `
            <p class="text-xs text-slate-400 mb-1 font-medium">${statusIcon} Sual ${idx + 1}</p>
            <p class="font-semibold text-sm mb-3 leading-snug">${sanitize(q.question)}</p>
            ${q.options.map((opt, i) => `
                <div class="flex items-center gap-2 text-sm py-1.5 px-3 rounded-xl mb-1 ${
                    i === q.correct
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-semibold'
                        : 'opacity-40'
                }">
                    <span class="w-5 h-5 flex-none flex items-center justify-center rounded-full
                                 bg-slate-100 dark:bg-slate-800 text-xs font-bold">
                        ${String.fromCharCode(65 + i)}
                    </span>
                    ${sanitize(opt)}${i === q.correct ? ' ✓' : ''}
                </div>`).join('')}`;
        container.appendChild(card);
    });

    const backBtn = document.createElement('button');
    backBtn.className = "w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold active:scale-95 transition-transform mt-2 mb-6";
    backBtn.textContent = '← Nəticəyə qayıt';
    backBtn.addEventListener('click', showResults);
    container.appendChild(backBtn);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY WRONG / BOOKMARKED
// ═══════════════════════════════════════════════════════════════════════════════
function retryWrong() {
    const wrongQs = quizState.wrongIndices.map(i => currentQuestions[i]);
    loadQuiz(lastShuffle, wrongQs);
}

function retryBookmarks() {
    const bookmarkedQs = [...quizState.bookmarks].map(i => currentQuestions[i]);
    loadQuiz(lastShuffle, bookmarkedQs);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARE RESULT
// ═══════════════════════════════════════════════════════════════════════════════
function shareResult(pct, correct, total) {
    const stars = pct >= 80 ? '⭐⭐⭐' : pct >= 60 ? '⭐⭐' : pct >= 40 ? '⭐' : '';
    const text  = `${stars} Rezidentura testini bitirdim!\n📚 ${quizState.currentTitle}\n✅ ${correct}/${total} düzgün (${pct}%)\n\n#Rezidentura #Quiz`;
    try {
        tg.openTelegramLink(`https://t.me/share/url?text=${encodeURIComponent(text)}`);
    } catch (e) {
        console.warn('Share failed', e);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAVORITES
// ═══════════════════════════════════════════════════════════════════════════════
async function toggleFavorite(path, title) {
    let favs    = await loadFavorites();
    const idx   = favs.findIndex(f => f.path === path);
    if (idx >= 0) {
        favs.splice(idx, 1);
        tg.HapticFeedback.impactOccurred('light');
    } else {
        favs.unshift({ path, title });
        tg.HapticFeedback.impactOccurred('medium');
    }
    await saveFavorites(favs);
    await startQuizSetup(path, title);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETURN HOME
// ═══════════════════════════════════════════════════════════════════════════════
function returnToHome() {
    quizState.history = [];
    resetQuizState();
    syncTgBackButton();
    hideTgMainButton();
    renderMenu(banksData, "Kateqoriyalar");
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUMP TO QUESTION
// ═══════════════════════════════════════════════════════════════════════════════
function jumpToQuestion() {
    const modal = document.getElementById('jump-modal');
    const input = document.getElementById('jump-input');
    const hint  = document.getElementById('jump-hint');
    const total = currentQuestions.length;
    if (!modal || !input || total === 0) return;

    input.value       = '';
    input.placeholder = `1 – ${total}`;
    if (hint) hint.textContent = `1 ilə ${total} arasında`;

    modal.classList.remove('hidden');
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

function setupOfflineBanner() {
    // Banner elementini HTML-də yarat (bir dəfə)
    const existing = document.getElementById('offline-banner');
    if (existing) return;
 
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.cssText = `
        display: none;
        position: sticky; top: 0; z-index: 100;
        background: #854F0B; color: #FAEEDA;
        text-align: center; font-size: 13px; font-weight: 500;
        padding: 8px 16px; border-radius: 0 0 12px 12px;
        margin: -16px -16px 8px -16px;
    `;
    banner.textContent = '📵 Offline rejimdəsiniz — keşlənmiş suallar mövcuddur';
 
    // max-w-md div-in içinə ilk element kimi əlavə et
    const container = document.querySelector('.max-w-md');
    if (container) container.prepend(banner);
 
    // Online/offline event-lər
    function updateBanner() {
        banner.style.display = navigator.onLine ? 'none' : 'block';
    }
 
    window.addEventListener('online',  updateBanner);
    window.addEventListener('offline', updateBanner);
    updateBanner(); // başlanğıc vəziyyəti
}

function cacheQuizFile(path) {
    if (!navigator.serviceWorker?.controller) return;
    navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_QUIZ',
        path: path
    });
}

function showUpdateBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: sticky; top: 0; z-index: 101;
        background: #185FA5; color: #E6F1FB;
        display: flex; align-items: center; justify-content: space-between;
        font-size: 13px; padding: 8px 16px;
        border-radius: 0 0 12px 12px;
        margin: -16px -16px 8px -16px;
    `;
    banner.innerHTML = `
        <span>🔄 Yeni versiya mövcuddur</span>
        <button style="background:#0C447C;color:#E6F1FB;border:none;
                       border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer"
            onclick="location.reload()">Yenilə</button>
    `;
    const container = document.querySelector('.max-w-md');
    if (container) container.prepend(banner);
}


// ═══════════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════════
init();