// MA GUINÉE - logique du jeu
(function () {
  "use strict";

  const QUESTION_TIME = 20; // secondes par question
  const LAST_CHANCE_TIME = 10; // secondes supplementaires accordees une fois
  const STORAGE_KEY = "maguinee_scores_v1";

  const el = (id) => document.getElementById(id);
  const screens = {
    home: el("screen-home"),
    quiz: el("screen-quiz"),
    results: el("screen-results"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- SCORES PERSISTANTS ----------
  function loadScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveScore(catKey, percent) {
    const scores = loadScores();
    const prev = scores[catKey] || 0;
    if (percent > prev) scores[catKey] = percent;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  // ---------- ACCUEIL ----------
  const categoryGrid = el("category-grid");
  const scoreboard = el("scoreboard");
  const selectLength = el("select-length");

  function renderHome() {
    categoryGrid.innerHTML = "";
    Object.keys(QUESTIONS).forEach((key) => {
      const cat = QUESTIONS[key];
      const btn = document.createElement("button");
      btn.className = "category-btn";
      btn.style.background = cat.color;
      btn.innerHTML =
        '<span class="cat-icon">' + cat.icon + "</span>" +
        "<span>" + cat.label + "</span>" +
        '<span class="cat-count">' + cat.items.length + " questions</span>";
      btn.addEventListener("click", () => startGame(key));
      categoryGrid.appendChild(btn);
    });
    renderScoreboard();
  }

  function renderScoreboard() {
    const scores = loadScores();
    const entries = Object.keys(scores);
    if (entries.length === 0) {
      scoreboard.innerHTML = "";
      return;
    }
    let html = '<div class="score-row"><span>Meilleurs scores</span><span></span></div>';
    entries.forEach((key) => {
      const label = key === "mixte" ? "Mode Mixte" : (QUESTIONS[key] ? QUESTIONS[key].label : key);
      html += '<div class="score-row"><span>' + label + "</span><strong>" + scores[key] + "%</strong></div>";
    });
    scoreboard.innerHTML = html;
  }

  el("btn-mixte").addEventListener("click", () => startGame("mixte"));

  // ---------- ÉTAT DU JEU ----------
  let state = {
    catKey: null,
    questions: [],
    index: 0,
    score: 0,
    answered: false,
    timerId: null,
    timeLeft: QUESTION_TIME,
    lastChanceUsed: false,
    review: [],
  };

  function buildQuestionSet(catKey, length) {
    let pool = [];
    if (catKey === "mixte") {
      Object.keys(QUESTIONS).forEach((key) => {
        QUESTIONS[key].items.forEach((item) => pool.push({ ...item, catKey: key }));
      });
    } else {
      pool = QUESTIONS[catKey].items.map((item) => ({ ...item, catKey }));
    }
    pool = shuffle(pool).slice(0, Math.min(length, pool.length));
    // mélange aussi les choix de réponse, en conservant la bonne réponse
    return pool.map((item) => {
      const choicesWithIndex = item.choices.map((c, i) => ({ text: c, correct: i === item.answer }));
      const shuffled = shuffle(choicesWithIndex);
      return {
        q: item.q,
        explain: item.explain || "",
        catKey: item.catKey,
        choices: shuffled.map((c) => c.text),
        answerIndex: shuffled.findIndex((c) => c.correct),
      };
    });
  }

  function startGame(catKey) {
    const length = parseInt(selectLength.value, 10) || 15;
    state = {
      catKey,
      questions: buildQuestionSet(catKey, length),
      index: 0,
      score: 0,
      answered: false,
      timerId: null,
      timeLeft: QUESTION_TIME,
      lastChanceUsed: false,
      review: [],
    };
    showScreen("quiz");
    renderQuestion();
  }

  // ---------- ÉCRAN QUIZ ----------
  const progressFill = el("progress-fill");
  const progressLabel = el("progress-label");
  const timerEl = el("timer");
  const categoryTagEl = el("quiz-category-tag");
  const questionTextEl = el("question-text");
  const choicesEl = el("choices");
  const explainEl = el("explain");
  const scoreLiveEl = el("score-live");
  const btnNext = el("btn-next");
  const lastChanceEl = el("last-chance");

  function renderQuestion() {
    const total = state.questions.length;
    const q = state.questions[state.index];
    state.answered = false;
    state.timeLeft = QUESTION_TIME;
    state.lastChanceUsed = false;
    lastChanceEl.classList.add("hidden");

    progressFill.style.width = Math.round((state.index / total) * 100) + "%";
    progressLabel.textContent = "Question " + (state.index + 1) + "/" + total;
    scoreLiveEl.textContent = "Score : " + state.score;

    const cat = QUESTIONS[q.catKey];
    categoryTagEl.textContent = cat.icon + " " + cat.label;
    categoryTagEl.style.background = cat.color;
    categoryTagEl.style.color = "#fff";

    questionTextEl.textContent = q.q;
    explainEl.classList.add("hidden");
    explainEl.textContent = "";
    btnNext.disabled = true;

    choicesEl.innerHTML = "";
    q.choices.forEach((choiceText, i) => {
      const b = document.createElement("button");
      b.className = "choice-btn";
      b.textContent = choiceText;
      b.addEventListener("click", () => selectAnswer(i));
      choicesEl.appendChild(b);
    });

    startTimer();
  }

  function startTimer() {
    clearInterval(state.timerId);
    timerEl.textContent = state.timeLeft;
    timerEl.classList.remove("low");
    state.timerId = setInterval(() => {
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        if (!state.lastChanceUsed) {
          // Dernière chance : on accorde du temps supplémentaire, une seule fois.
          state.lastChanceUsed = true;
          state.timeLeft = LAST_CHANCE_TIME;
          lastChanceEl.classList.remove("hidden");
          timerEl.textContent = state.timeLeft;
          timerEl.classList.add("low");
          return;
        }
        clearInterval(state.timerId);
        timerEl.textContent = "⏱";
        selectAnswer(-1);
        return;
      }
      timerEl.textContent = state.timeLeft;
      if (state.timeLeft <= 5) timerEl.classList.add("low");
    }, 1000);
  }

  function selectAnswer(choiceIndex) {
    if (state.answered) return;
    state.answered = true;
    clearInterval(state.timerId);
    lastChanceEl.classList.add("hidden");

    const q = state.questions[state.index];
    const buttons = choicesEl.querySelectorAll(".choice-btn");
    const isCorrect = choiceIndex === q.answerIndex;

    buttons.forEach((b, i) => {
      b.classList.add("disabled");
      if (i === q.answerIndex) b.classList.add("correct");
      else if (i === choiceIndex) b.classList.add("wrong");
    });

    if (isCorrect) {
      state.score += 10;
      scoreLiveEl.textContent = "Score : " + state.score;
    }

    if (q.explain) {
      explainEl.textContent = "💡 " + q.explain;
      explainEl.classList.remove("hidden");
    }

    state.review.push({
      q: q.q,
      yourAnswer: choiceIndex === -1 ? "⏱ Temps écoulé" : q.choices[choiceIndex],
      correctAnswer: q.choices[q.answerIndex],
      ok: isCorrect,
    });

    btnNext.disabled = false;
  }

  function goToNext() {
    state.index += 1;
    if (state.index >= state.questions.length) {
      finishGame();
    } else {
      renderQuestion();
    }
  }

  btnNext.addEventListener("click", goToNext);

  el("btn-quit").addEventListener("click", () => {
    clearInterval(state.timerId);
    showScreen("home");
    renderHome();
  });

  // ---------- RÉSULTATS ----------
  const resultBadge = el("result-badge");
  const resultTitle = el("result-title");
  const resultScore = el("result-score");
  const resultMessage = el("result-message");
  const reviewList = el("review-list");

  function finishGame() {
    const total = state.questions.length;
    const percent = Math.round((state.score / (total * 10)) * 100);
    saveScore(state.catKey, percent);

    let badge, title, message;
    if (percent >= 100) { badge = "🇬🇳"; title = "Félicitations !"; message = "La Guinée est fière de toi !"; }
    else if (percent >= 90) { badge = "🏆"; title = "Excellent !"; message = "Tu connais vraiment bien la Guinée !"; }
    else if (percent >= 70) { badge = "🥇"; title = "Très bien !"; message = "Belle maîtrise de la culture guinéenne."; }
    else if (percent >= 50) { badge = "🥈"; title = "Pas mal !"; message = "Continue à apprendre sur ton pays."; }
    else { badge = "🥉"; title = "Continue tes efforts !"; message = "Rejoue pour améliorer ton score."; }

    resultBadge.textContent = badge;
    resultTitle.textContent = title;
    resultScore.textContent = state.score + " / " + total * 10 + " pts (" + percent + "%)";
    resultMessage.textContent = message;

    reviewList.innerHTML = "";
    state.review.forEach((r) => {
      const div = document.createElement("div");
      div.className = "review-item " + (r.ok ? "ok" : "ko");
      div.innerHTML =
        '<div class="q">' + r.q + "</div>" +
        '<div class="a">Ta réponse : ' + r.yourAnswer + (r.ok ? "" : " — Bonne réponse : " + r.correctAnswer) + "</div>";
      reviewList.appendChild(div);
    });

    state.lastPercent = percent;
    state.lastTotalPts = total * 10;
    showScreen("results");
  }

  el("btn-share").addEventListener("click", () => {
    const catLabel = state.catKey === "mixte" ? "Mode Mixte" : QUESTIONS[state.catKey].label;
    const text =
      "J'ai fait " + state.lastPercent + "% (" + state.score + "/" + state.lastTotalPts + " pts) sur MA GUINÉE 🇬🇳 en " +
      catLabel + " ! Teste tes connaissances sur la Guinée : https://ma-guinee.vercel.app";

    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        alert("Score copié ! Tu peux le coller dans WhatsApp ou ailleurs.");
      }).catch(() => {
        window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
      });
    }
  });

  el("btn-replay").addEventListener("click", () => startGame(state.catKey));
  el("btn-home").addEventListener("click", () => {
    showScreen("home");
    renderHome();
  });

  // ---------- PWA ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // ---------- INIT ----------
  renderHome();
  showScreen("home");
})();
