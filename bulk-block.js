// x-purge: Outil de blocage en masse pour X (Twitter) avec interface visuelle
// Usage: Coller dans la console du navigateur sur https://x.com, ou exécuter en Bookmarklet.

(function () {
  'use strict';

  // Check if an instance is already running
  if (document.getElementById('x-purge-root')) {
    alert('X-Purge est déjà ouvert sur cette page.');
    return;
  }

  // --- Configuration ---
  const CONFIG = {
    delayMin: 2000,
    delayMax: 5000,
    loadWait: 6500,
    clickWait: 600,
  };

  // State
  let state = {
    isRunning: false,
    isPaused: false,
    shouldStop: false,
    currentIndex: 0,
    usernames: [],
    stats: { success: 0, alreadyBlocked: 0, failed: 0 }
  };

  // Helper: Random Delay
  function randomDelay(min = CONFIG.delayMin, max = CONFIG.delayMax) {
    return Math.random() * (max - min) + min;
  }

  // Helper: SPA Navigation
  function navigateTo(urlPath) {
    const event = new CustomEvent('x-router-navigate', { detail: { url: urlPath } });
    window.dispatchEvent(event);

    if (window.location.pathname !== urlPath) {
      history.pushState(null, '', `https://x.com${urlPath}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  // Helper: Wait for Element
  function waitForElement(selector, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        const fallback = document.querySelector(selector);
        if (fallback) resolve(fallback);
        else reject(new Error(`Element ${selector} non trouvé (${timeout}ms)`));
      }, timeout);
    });
  }

  // Helper: Check pause/stop
  async function checkExecutionControl() {
    while (state.isPaused && !state.shouldStop) {
      await new Promise(r => setTimeout(r, 400));
    }
    if (state.shouldStop) {
      throw new Error('STOPPED_BY_USER');
    }
  }

  // Helper: Regex detectors for block / unblock multilingual strings
  const UNBLOCK_REGEX = /unblock|d[ée]bloqu|desbloqu|entblock|sblocc/i;
  const BLOCK_REGEX = /block|bloqu|sperr/i;

  function isUnblockText(str) {
    return UNBLOCK_REGEX.test(str || '');
  }

  function isBlockText(str) {
    const text = str || '';
    return BLOCK_REGEX.test(text) && !UNBLOCK_REGEX.test(text);
  }

  // Helper: Check if account is already blocked directly from profile view
  function checkProfileAlreadyBlocked() {
    // 1. Check for unblock buttons on profile header (e.g. data-testid="${userId}-unblock" or "unblock")
    const unblockBtn = document.querySelector('[data-testid$="-unblock"], [data-testid="unblock"]');
    if (unblockBtn) return true;

    // 2. Profile header buttons with "Blocked" / "Bloqué"
    const headerBtns = Array.from(document.querySelectorAll('[data-testid="primaryColumn"] button, [data-testid="UserProfileHeader_Items"] button'));
    for (const btn of headerBtns) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (text === 'bloqué' || text === 'blocked' || text === 'bloqueado' || text === 'blockiert' ||
          isUnblockText(text) || isUnblockText(aria) ||
          aria.includes('bloqué') || aria.includes('blocked') || aria.includes('bloqueado')) {
        return true;
      }
    }

    // 3. Check for empty state banner "You blocked @..." / "Vous avez bloqué @..."
    const emptyState = document.querySelector('[data-testid="emptyState"]');
    if (emptyState) {
      const text = (emptyState.textContent || '').toLowerCase();
      if (text.includes('bloqu') || text.includes('block') || text.includes('sperr')) {
        return true;
      }
    }

    return false;
  }

  // Core Blocking Routine
  async function blockUser(username, log) {
    navigateTo(`/${username}`);
    await checkExecutionControl();

    // Wait for the profile actions or blocked state to appear
    await waitForElement('[data-testid="userActions"], [data-testid$="-unblock"], [data-testid="emptyState"]', CONFIG.loadWait);
    await checkExecutionControl();

    // 1. Check if the user is already blocked directly from the profile page
    if (checkProfileAlreadyBlocked()) {
      log(`ℹ️ @${username} est déjà bloqué.`, 'info');
      state.stats.alreadyBlocked++;
      navigateTo('/home');
      await new Promise(r => setTimeout(r, 800));
      return 'ALREADY_BLOCKED';
    }

    const menuBtn = document.querySelector('[data-testid="userActions"]');
    if (!menuBtn) {
      if (checkProfileAlreadyBlocked()) {
        log(`ℹ️ @${username} est déjà bloqué.`, 'info');
        state.stats.alreadyBlocked++;
        navigateTo('/home');
        await new Promise(r => setTimeout(r, 800));
        return 'ALREADY_BLOCKED';
      }
      throw new Error('Bouton d\'actions utilisateur introuvable');
    }

    menuBtn.click();
    await new Promise(r => setTimeout(r, 300));

    let blockBtn = null;
    let isAlreadyBlocked = false;
    const menuStart = Date.now();

    while (Date.now() - menuStart < 3500) {
      // 1. Check if unblock button exists in menu or page
      const unblockEl = document.querySelector('[role="menu"] [data-testid$="unblock"], [role="menu"] [data-testid="unblock"], [data-testid$="-unblock"]');
      if (unblockEl) {
        isAlreadyBlocked = true;
        break;
      }

      // 2. Multilingual search on menu items
      const items = Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"], [role="menuitem"]'));
      if (items.length > 0) {
        // ALWAYS check for unblock FIRST
        const unblockItem = items.find(item => {
          const text = item.textContent.trim().toLowerCase();
          const testId = (item.getAttribute('data-testid') || '').toLowerCase();
          return isUnblockText(text) || testId.includes('unblock');
        });
        if (unblockItem) {
          isAlreadyBlocked = true;
          break;
        }

        // Only select block button if it does NOT match unblock
        const found = items.find(item => {
          const text = item.textContent.trim().toLowerCase();
          const testId = (item.getAttribute('data-testid') || '').toLowerCase();
          return (isBlockText(text) || testId === 'block') && !isUnblockText(text) && !testId.includes('unblock');
        });
        if (found) {
          blockBtn = found;
          break;
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (isAlreadyBlocked) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.body.click(); // Close dropdown
      log(`ℹ️ @${username} est déjà bloqué.`, 'info');
      state.stats.alreadyBlocked++;
      navigateTo('/home');
      await new Promise(r => setTimeout(r, 800));
      return 'ALREADY_BLOCKED';
    }

    if (!blockBtn) {
      if (checkProfileAlreadyBlocked()) {
        document.body.click();
        log(`ℹ️ @${username} est déjà bloqué.`, 'info');
        state.stats.alreadyBlocked++;
        navigateTo('/home');
        await new Promise(r => setTimeout(r, 800));
        return 'ALREADY_BLOCKED';
      }
      document.body.click();
      throw new Error('Bouton "Bloquer" introuvable dans le menu');
    }

    blockBtn.click();
    await new Promise(r => setTimeout(r, CONFIG.clickWait));
    await checkExecutionControl();

    // Confirm Block Modal
    let confirmBtn = null;
    let confirmModal = null;
    try {
      confirmBtn = await waitForElement('[data-testid="confirmationSheetConfirm"]', 4000);
      confirmModal = document.querySelector('[role="dialog"]') || confirmBtn.closest('[data-testid="sheetDialog"]') || document.body;
    } catch {
      confirmBtn = document.querySelector('[role="dialog"] button[data-testid*="Confirm"]') ||
                   Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => {
                     const t = b.textContent.toLowerCase();
                     return isBlockText(t) || t.includes('confirm');
                   });
      confirmModal = document.querySelector('[role="dialog"]') || document.body;
    }

    if (!confirmBtn) throw new Error('Bouton de confirmation introuvable');

    // CRITICAL SAFETY NET: Check if confirmation modal is actually asking to UNBLOCK
    const modalText = (confirmModal ? confirmModal.textContent : '').toLowerCase();
    const confirmBtnText = (confirmBtn.textContent || '').toLowerCase();

    if (isUnblockText(confirmBtnText) || isUnblockText(modalText)) {
      // Abort! Do NOT confirm unblock!
      const cancelBtn = document.querySelector('[data-testid="confirmationSheetCancel"]') ||
                        Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => {
                          const t = b.textContent.toLowerCase();
                          return t.includes('annuler') || t.includes('cancel');
                        });
      if (cancelBtn) cancelBtn.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      log(`ℹ️ @${username} est déjà bloqué (sécurité confirmation déclenchée).`, 'info');
      state.stats.alreadyBlocked++;
      navigateTo('/home');
      await new Promise(r => setTimeout(r, 800));
      return 'ALREADY_BLOCKED';
    }

    confirmBtn.click();
    await new Promise(r => setTimeout(r, 1200));

    log(`✅ @${username} bloqué avec succès.`, 'success');
    state.stats.success++;

    navigateTo('/home');
    await new Promise(r => setTimeout(r, 800));
    return 'SUCCESS';
  }

  // --- UI Creation (Shadow DOM) ---
  const host = document.createElement('div');
  host.id = 'x-purge-root';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 380px;
      max-height: 90vh;
      background: #0f1419;
      color: #f7f9f9;
      border: 1px solid #2f3336;
      border-radius: 16px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7);
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    .header {
      padding: 12px 16px;
      background: #16181c;
      border-bottom: 1px solid #2f3336;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      user-select: none;
    }
    .header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .close-btn {
      background: transparent;
      border: none;
      color: #71767b;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn:hover {
      color: #eff3f4;
      background: #272c30;
    }
    .body {
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow-y: auto;
      max-height: calc(90vh - 60px);
    }
    .dropzone {
      border: 2px dashed #38444d;
      border-radius: 10px;
      padding: 10px;
      text-align: center;
      cursor: pointer;
      background: #16181c;
      transition: border-color 0.2s, background 0.2s;
    }
    .dropzone:hover, .dropzone.dragover {
      border-color: #1d9bf0;
      background: rgba(29, 155, 240, 0.08);
    }
    .dropzone span {
      color: #1d9bf0;
      font-weight: 600;
    }
    textarea {
      width: 100%;
      height: 110px;
      background: #000;
      color: #fff;
      border: 1px solid #333639;
      border-radius: 8px;
      padding: 8px;
      font-size: 12px;
      resize: vertical;
      outline: none;
    }
    textarea:focus {
      border-color: #1d9bf0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .subtext {
      color: #71767b;
      font-size: 11px;
    }
    .input-number {
      width: 60px;
      background: #000;
      color: #fff;
      border: 1px solid #333639;
      border-radius: 6px;
      padding: 4px 6px;
      font-size: 12px;
      text-align: center;
    }
    .btn-group {
      display: flex;
      gap: 8px;
    }
    button.btn-primary {
      flex: 1;
      background: #1d9bf0;
      color: #fff;
      border: none;
      border-radius: 9999px;
      padding: 9px 14px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button.btn-primary:hover:not(:disabled) {
      background: #1a8cd8;
    }
    button.btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.btn-secondary {
      background: #272c30;
      color: #eff3f4;
      border: none;
      border-radius: 9999px;
      padding: 8px 14px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
    }
    button.btn-secondary:hover:not(:disabled) {
      background: #33383d;
    }
    button.btn-danger {
      background: rgba(244, 33, 46, 0.2);
      color: #f4212e;
      border: 1px solid #f4212e;
      border-radius: 9999px;
      padding: 8px 12px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
    }
    button.btn-danger:hover:not(:disabled) {
      background: rgba(244, 33, 46, 0.35);
    }
    .progress-bar-bg {
      width: 100%;
      height: 6px;
      background: #2f3336;
      border-radius: 9999px;
      overflow: hidden;
    }
    .progress-bar-fill {
      width: 0%;
      height: 100%;
      background: #1d9bf0;
      transition: width 0.3s ease;
    }
    .stats-row {
      display: flex;
      justify-content: space-around;
      background: #16181c;
      padding: 8px;
      border-radius: 8px;
      font-size: 11px;
      border: 1px solid #2f3336;
    }
    .stats-item {
      text-align: center;
    }
    .stats-value {
      font-weight: 700;
      font-size: 13px;
    }
    .logs {
      height: 105px;
      background: #000;
      border: 1px solid #2f3336;
      border-radius: 8px;
      padding: 6px 8px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .log-item.success { color: #00ba7c; }
    .log-item.info { color: #1d9bf0; }
    .log-item.error { color: #f4212e; }
    .log-item.warn { color: #ffd400; }
  `;
  shadow.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <div class="header">
      <h2>🛡️ X-Purge</h2>
      <button class="close-btn" id="closeBtn" title="Fermer">✕</button>
    </div>
    <div class="body">
      <div class="dropzone" id="dropzone">
        📁 Glissez un fichier .txt ici ou <span>cliquez pour choisir</span>
        <input type="file" id="fileInput" accept=".txt,.csv" style="display:none;" />
      </div>

      <div>
        <div class="row" style="margin-bottom: 4px;">
          <span style="font-weight:600;">Pseudos à bloquer :</span>
          <span class="subtext" id="countLabel">0 détecté(s)</span>
        </div>
        <textarea id="usernameInput" placeholder="Collez vos comptes ici (un par ligne, avec ou sans @)..."></textarea>
      </div>

      <div class="row">
        <label for="startIndex" class="subtext">Démarrer à l'index (reprise) :</label>
        <input type="number" id="startIndex" class="input-number" min="0" value="0" />
      </div>

      <div class="stats-row" id="statsRow" style="display:none;">
        <div class="stats-item"><div class="stats-value" style="color:#00ba7c;" id="statSuccess">0</div>Bloqués</div>
        <div class="stats-item"><div class="stats-value" style="color:#1d9bf0;" id="statAlready">0</div>Déjà faits</div>
        <div class="stats-item"><div class="stats-value" style="color:#f4212e;" id="statFailed">0</div>Erreurs</div>
      </div>

      <div id="progressContainer" style="display:none; flex-direction:column; gap:6px;">
        <div class="row">
          <span id="progressText" style="font-weight:600; font-size:11px;">En attente...</span>
          <span id="percentText" class="subtext">0%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="progressFill"></div>
        </div>
      </div>

      <div class="btn-group" id="mainActions">
        <button class="btn-primary" id="startBtn">Démarrer le blocage</button>
      </div>

      <div class="btn-group" id="controlActions" style="display:none;">
        <button class="btn-secondary" id="pauseBtn" style="flex:1;">⏸️ Pause</button>
        <button class="btn-danger" id="stopBtn">⏹️ Arrêter</button>
      </div>

      <div>
        <div class="row" style="margin-bottom: 4px;">
          <span style="font-weight:600; font-size:11px;">Journal d'activité :</span>
          <span class="subtext" id="clearLogs" style="cursor:pointer; text-decoration:underline;">Effacer</span>
        </div>
        <div class="logs" id="logBox">
          <div class="log-item info">Prêt. Entrez des comptes et cliquez sur Démarrer.</div>
        </div>
      </div>
    </div>
  `;
  shadow.appendChild(panel);

  // --- Element References ---
  const textarea = shadow.getElementById('usernameInput');
  const countLabel = shadow.getElementById('countLabel');
  const dropzone = shadow.getElementById('dropzone');
  const fileInput = shadow.getElementById('fileInput');
  const startIndexInput = shadow.getElementById('startIndex');
  const startBtn = shadow.getElementById('startBtn');
  const pauseBtn = shadow.getElementById('pauseBtn');
  const stopBtn = shadow.getElementById('stopBtn');
  const closeBtn = shadow.getElementById('closeBtn');
  const mainActions = shadow.getElementById('mainActions');
  const controlActions = shadow.getElementById('controlActions');
  const progressContainer = shadow.getElementById('progressContainer');
  const progressFill = shadow.getElementById('progressFill');
  const progressText = shadow.getElementById('progressText');
  const percentText = shadow.getElementById('percentText');
  const statsRow = shadow.getElementById('statsRow');
  const statSuccess = shadow.getElementById('statSuccess');
  const statAlready = shadow.getElementById('statAlready');
  const statFailed = shadow.getElementById('statFailed');
  const logBox = shadow.getElementById('logBox');
  const clearLogs = shadow.getElementById('clearLogs');

  // Logger helper
  function log(message, type = 'info') {
    const item = document.createElement('div');
    item.className = `log-item ${type}`;
    item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBox.appendChild(item);
    logBox.scrollTop = logBox.scrollHeight;
  }

  // Parse usernames from text (ignores comments #, //, empty lines, and supports full URLs)
  function parseUsernames(text) {
    return text
      .split(/[\r\n,]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'))
      .map(line => {
        const cleanLine = line.split('#')[0].trim();
        const withoutUrl = cleanLine.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '');
        const username = withoutUrl.split(/[/?#]/)[0].replace(/^@/, '').trim();
        return username;
      })
      .filter(u => u.length > 0 && !u.startsWith('#') && !u.startsWith('//'));
  }

  // Update Username Counter
  function updateCount() {
    const list = parseUsernames(textarea.value);
    countLabel.textContent = `${list.length} détecté(s)`;
    startBtn.disabled = list.length === 0;
  }

  textarea.addEventListener('input', updateCount);

  // File Upload Handlers
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
      const text = await e.target.files[0].text();
      textarea.value = text;
      updateCount();
      log(`Fichier importé avec succès.`, 'info');
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const text = await e.dataTransfer.files[0].text();
      textarea.value = text;
      updateCount();
      log(`Fichier déposé et importé.`, 'info');
    }
  });

  clearLogs.addEventListener('click', () => {
    logBox.innerHTML = '';
  });

  // Close Panel
  closeBtn.addEventListener('click', () => {
    if (state.isRunning) {
      if (!confirm('Le blocage est en cours. Voulez-vous vraiment fermer et arrêter ?')) return;
      state.shouldStop = true;
    }
    host.remove();
  });

  // Pause / Resume
  pauseBtn.addEventListener('click', () => {
    state.isPaused = !state.isPaused;
    if (state.isPaused) {
      pauseBtn.textContent = '▶️ Reprendre';
      log('⏸️ Processus mis en pause.', 'warn');
    } else {
      pauseBtn.textContent = '⏸️ Pause';
      log('▶️ Reprise du processus...', 'info');
    }
  });

  // Stop
  stopBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment arrêter le blocage ?')) {
      state.shouldStop = true;
      log('⏹️ Arrêt demandé par l\'utilisateur.', 'warn');
    }
  });

  // Main Blocking Process
  startBtn.addEventListener('click', async () => {
    const usernames = parseUsernames(textarea.value);
    if (usernames.length === 0) return;

    let startIndex = parseInt(startIndexInput.value, 10) || 0;
    if (startIndex >= usernames.length) {
      alert(`L'index de départ (${startIndex}) est supérieur au nombre d'éléments (${usernames.length}).`);
      return;
    }

    state.isRunning = true;
    state.isPaused = false;
    state.shouldStop = false;
    state.usernames = usernames;
    state.stats = { success: 0, alreadyBlocked: 0, failed: 0 };

    textarea.disabled = true;
    startIndexInput.disabled = true;
    mainActions.style.display = 'none';
    controlActions.style.display = 'flex';
    progressContainer.style.display = 'flex';
    statsRow.style.display = 'flex';

    log(`🚀 Démarrage : ${usernames.length - startIndex} comptes à traiter...`, 'info');

    for (let i = startIndex; i < usernames.length; i++) {
      if (state.shouldStop) {
        log(`Arrêté à l'index ${i}. Vous pouvez reprendre plus tard à cet index.`, 'warn');
        startIndexInput.value = i;
        break;
      }

      const user = usernames[i];
      const currentNum = i + 1;
      const total = usernames.length;
      const pct = Math.round((currentNum / total) * 100);

      progressFill.style.width = `${pct}%`;
      percentText.textContent = `${pct}%`;
      progressText.textContent = `[${currentNum}/${total}] @${user}`;

      statSuccess.textContent = state.stats.success;
      statAlready.textContent = state.stats.alreadyBlocked;
      statFailed.textContent = state.stats.failed;

      try {
        await blockUser(user, log);
      } catch (err) {
        if (err.message === 'STOPPED_BY_USER') {
          log(`Arrêté pendant le traitement de @${user}.`, 'warn');
          startIndexInput.value = i;
          break;
        }
        state.stats.failed++;
        log(`❌ Erreur sur @${user}: ${err.message}`, 'error');
        navigateTo('/home');
        await new Promise(r => setTimeout(r, 1000));
      }

      statSuccess.textContent = state.stats.success;
      statAlready.textContent = state.stats.alreadyBlocked;
      statFailed.textContent = state.stats.failed;

      // Random delay before next user if not finished
      if (i < usernames.length - 1 && !state.shouldStop) {
        const delay = randomDelay();
        log(`⏳ Pause de sécurité (~${Math.round(delay / 1000)}s)...`, 'info');
        const startWait = Date.now();
        while (Date.now() - startWait < delay) {
          if (state.shouldStop) break;
          await checkExecutionControl();
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }

    state.isRunning = false;
    textarea.disabled = false;
    startIndexInput.disabled = false;
    mainActions.style.display = 'flex';
    controlActions.style.display = 'none';

    if (!state.shouldStop) {
      log('🎉 Terminé ! Tous les comptes ont été traités.', 'success');
      progressText.textContent = 'Terminé avec succès !';
    } else {
      progressText.textContent = 'Arrêté.';
    }
  });

  // Initial count update
  updateCount();
})();
