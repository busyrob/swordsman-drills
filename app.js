// Sword Practice Line Drill App
// Vanilla JS only, offline-capable from a local index.html launch.

(function () {
  'use strict';

  const legMoves = {
    basic: ['Forward', 'Backward', 'Front', 'Back'],
    advanced: [
      'Forward',
      'Backward',
      'Front',
      'Back',
      'Sidestep 90 degrees',
      'Sidestep 45 degrees',
      'Forward 45 degrees',
      'Backward 45 degrees'
    ]
  };

  const armMoves = [
    'Standing Thrust',
    'Short Thrust',
    'Long Thrust',
    'High Attack',
    'Mid Attack',
    'Low Attack',
    'High Block',
    'Side Block',
    'Low Block'
  ];

  const difficulties = {
    basic: { label: 'Basic', groups: 2, legs: legMoves.basic },
    intermediate: { label: 'Intermediate', groups: 3, legs: legMoves.advanced },
    advanced: { label: 'Advanced', groups: 4, legs: legMoves.advanced }
  };

  const state = {
    currentDifficulty: 'basic',
    currentSequence: [],
    screen: 'main',
    voiceStyle: 'female',
    speakingToken: 0,
    shouldListen: true,
    wakeLock: null
  };

  const els = {
    mainScreen: document.getElementById('main-screen'),
    drillScreen: document.getElementById('drill-screen'),
    movementDisplay: document.getElementById('movement-display'),
    difficultyLabel: document.getElementById('difficulty-label'),
    micStatus: document.getElementById('mic-status'),
    voiceStyle: document.getElementById('voice-style'),
    orientationLock: document.getElementById('orientation-lock')
  };

  // --- Utility helpers ---
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showScreen(name) {
    state.screen = name;
    els.mainScreen.classList.toggle('active', name === 'main');
    els.drillScreen.classList.toggle('active', name === 'drill');
  }

  function buildSequence(difficultyKey) {
    const spec = difficulties[difficultyKey];
    const result = [];

    for (let i = 0; i < spec.groups; i += 1) {
      result.push({
        leg: randomFrom(spec.legs),
        arm: randomFrom(armMoves)
      });
    }
    return result;
  }

  function renderSequence() {
    const lines = state.currentSequence
      .map((move, idx) => `<p class="move-line">${idx + 1}. ${move.leg} + ${move.arm}</p>`)
      .join('');
    els.movementDisplay.innerHTML = lines;
    els.difficultyLabel.textContent = `Difficulty: ${difficulties[state.currentDifficulty].label}`;
  }

  // --- Speech synthesis ---
  function chooseVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const targetGender = state.voiceStyle;
    const genderHints =
      targetGender === 'male'
        ? ['male', 'david', 'mark', 'alex', 'daniel']
        : ['female', 'samantha', 'victoria', 'zira', 'karen'];

    const lowerVoices = voices.map((v) => ({ ...v, lowerName: v.name.toLowerCase() }));
    const byHint = lowerVoices.find((v) => genderHints.some((hint) => v.lowerName.includes(hint)));
    return byHint || voices[0];
  }

  function speakText(text) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      const selectedVoice = chooseVoice();
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  async function speakSequence(repeatOnce) {
    const myToken = ++state.speakingToken;
    window.speechSynthesis.cancel();

    async function runOnePass() {
      for (let i = 0; i < state.currentSequence.length; i += 1) {
        if (myToken !== state.speakingToken) return;
        const move = state.currentSequence[i];
        await speakText(`${move.leg}. ${move.arm}.`);
        if (i < state.currentSequence.length - 1) {
          await delay(1500);
        }
      }
    }

    await runOnePass();
    if (myToken !== state.speakingToken || !repeatOnce) return;

    await delay(4000);
    if (myToken !== state.speakingToken) return;
    await runOnePass();
  }

  // --- Drill flows ---
  function generateNewDrill(difficultyKey) {
    state.currentDifficulty = difficultyKey;
    state.currentSequence = buildSequence(difficultyKey);
    showScreen('drill');
    renderSequence();
    speakSequence(true);
  }

  function repeatCurrent() {
    if (!state.currentSequence.length) return;
    speakSequence(false);
  }

  function nextCurrentDifficulty() {
    generateNewDrill(state.currentDifficulty);
  }

  function stopToMain() {
    state.speakingToken += 1;
    window.speechSynthesis.cancel();
    showScreen('main');
  }

  // --- Voice recognition (always listening) ---
  function normalizeTranscript(text) {
    return text.trim().replace(/[.?!]/g, '').toLowerCase();
  }

  function handleCommand(rawText) {
    const command = normalizeTranscript(rawText);
    const commandMap = {
      'new basic movement': () => generateNewDrill('basic'),
      'new intermediate movement': () => generateNewDrill('intermediate'),
      'new advanced movement': () => generateNewDrill('advanced'),
      next: () => nextCurrentDifficulty(),
      repeat: () => repeatCurrent(),
      stop: () => stopToMain()
    };

    const action = commandMap[command];
    if (action) action();
  }

  function setupRecognition() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      els.micStatus.textContent = 'Microphone: SpeechRecognition not supported in this browser.';
      return;
    }

    const recognition = new Rec();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      els.micStatus.textContent = 'Microphone: listening';
    };

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          handleCommand(event.results[i][0].transcript);
        }
      }
    };

    recognition.onerror = () => {
      els.micStatus.textContent = 'Microphone: trying to reconnect…';
    };

    recognition.onend = () => {
      if (!state.shouldListen) return;
      setTimeout(() => {
        try {
          recognition.start();
        } catch (err) {
          // If recognition was already starting, just keep app alive.
        }
      }, 300);
    };

    try {
      recognition.start();
    } catch (err) {
      els.micStatus.textContent = 'Microphone: blocked. Tap page and allow microphone access.';
    }
  }

  // --- Accessibility & behavior helpers ---
  function setupWakeLock() {
    async function requestWakeLock() {
      if (!('wakeLock' in navigator)) return;
      try {
        state.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        // Some platforms or permissions can block wake lock; fail silently.
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    });

    requestWakeLock();
  }

  function setupOrientationGuard() {
    function updateOrientationMessage() {
      const landscape = window.matchMedia('(orientation: landscape)').matches;
      els.orientationLock.hidden = !landscape;
    }

    window.addEventListener('resize', updateOrientationMessage);
    updateOrientationMessage();
  }

  function bindUI() {
    document.getElementById('run-basic').addEventListener('click', () => generateNewDrill('basic'));
    document
      .getElementById('run-intermediate')
      .addEventListener('click', () => generateNewDrill('intermediate'));
    document.getElementById('run-advanced').addEventListener('click', () => generateNewDrill('advanced'));

    document.getElementById('repeat-btn').addEventListener('click', repeatCurrent);
    document.getElementById('next-btn').addEventListener('click', nextCurrentDifficulty);
    document.getElementById('quit-btn').addEventListener('click', stopToMain);

    els.voiceStyle.addEventListener('change', (e) => {
      state.voiceStyle = e.target.value;
    });

    document.getElementById('theme-toggle').addEventListener('click', () => {
      document.body.classList.toggle('dark');
    });
  }

  function init() {
    bindUI();
    setupRecognition();
    setupWakeLock();
    setupOrientationGuard();

    // Keep voice list fresh for some browsers that load voices asynchronously.
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        chooseVoice();
      };
    }
  }

  init();
})();
