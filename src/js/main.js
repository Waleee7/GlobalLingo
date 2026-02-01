// =========================
// GLOBAL LINGO - main.js
// =========================

// ----- STARTUP SCREEN -----
const startBtn = document.querySelector('.pixel-button');
const startupScreen = document.querySelector('.startup-screen');
const mainApp = document.querySelector('.main-app');

startBtn.addEventListener('click', () => {
  startupScreen.style.display = 'none';
  mainApp.style.display = 'grid';
  navigator.vibrate?.(50); // Haptic feedback for mobile
});

// ----- DOM ELEMENTS -----
const inputText = document.querySelector('.text-area');
const languageSelect = document.querySelector('.language-select');
const translateBtn = document.querySelector('.pixel-button');
const outputSection = document.querySelector('.result-section');
const outputText = document.querySelector('.result-section .result-title');
const logSection = document.querySelector('.log-section');

const xpValueEl = document.querySelector('.xp-value');
const streakValueEl = document.querySelector('.streak-value');

// ----- INITIAL STATS -----
let streak = 0;
let xp = 0;

// ----- SAMPLE DICTIONARY -----
const dictionary = {
  hello: { spanish: 'hola', french: 'bonjour', japanese: 'こんにちは' },
  goodbye: { spanish: 'adiós', french: 'au revoir', japanese: 'さようなら' },
  thankyou: { spanish: 'gracias', french: 'merci', japanese: 'ありがとう' },
};

// ----- TRANSLATE FUNCTION -----
function translate(text, language) {
  const key = text.toLowerCase().replace(/\s+/g, '');
  if (dictionary[key] && dictionary[key][language]) {
    return dictionary[key][language];
  }
  return 'Translation not found';
}

// ----- UPDATE REWARDS -----
function updateRewards(success) {
  if (success) {
    streak++;
    xp += 10;
  } else {
    streak = 0;
  }

  streakValueEl.innerText = streak;
  xpValueEl.innerText = xp;

  // XP gained animation
  if (success) {
    const xpDisplay = document.createElement('div');
    xpDisplay.className = 'xp-gained';
    xpDisplay.innerText = '+10 XP';
    document.body.appendChild(xpDisplay);
    setTimeout(() => xpDisplay.remove(), 1000);
  }
}

// ----- LOG TRANSLATIONS -----
function logTranslation(input, output) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <div class="log-date">${new Date().toLocaleString()}</div>
    <div class="log-translation">Input: ${input} → Output: ${output}</div>
  `;
  logSection.appendChild(entry);
}

// ----- TRANSLATE BUTTON CLICK -----
translateBtn.addEventListener('click', () => {
  const input = inputText.value.trim();
  const language = languageSelect.value;

  if (!input) return;

  const result = translate(input, language);
  outputText.innerText = result;
  outputSection.classList.add('active');

  updateRewards(result !== 'Translation not found');
  logTranslation(input, result);

  navigator.vibrate?.(30); // small haptic feedback
});

// ----- ENTER KEY TO TRANSLATE -----
inputText.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    translateBtn.click();
  }
});

// ----- MODAL OPEN/CLOSE -----
const modal = document.querySelector('.modal');
const settingsBtn = document.querySelector('.settings-button');
const closeBtn = document.querySelector('.close-button');

settingsBtn.addEventListener('click', () => modal.classList.add('active'));
closeBtn.addEventListener('click', () => modal.classList.remove('active'));

// ----- GLOBE BUTTON ANIMATION -----
const globeBtn = document.querySelector('.globe-button');
if (globeBtn) {
  globeBtn.addEventListener('click', () => {
    globeBtn.classList.add('spinning');
    setTimeout(() => globeBtn.classList.remove('spinning'), 1200);
    navigator.vibrate?.(50);
  });
}

// ----- INIT -----
mainApp.style.display = 'none';


