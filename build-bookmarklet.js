const fs = require('fs');

// 1. Lire bulk-block.js et générer bookmarklet.txt
const jsSource = fs.readFileSync('bulk-block.js', 'utf8');
const cleaned = jsSource
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('//'))
  .join('\n');

const bookmarkletCode = 'javascript:' + encodeURI(cleaned);
fs.writeFileSync('bookmarklet.txt', bookmarkletCode, 'utf8');
console.log('✅ bookmarklet.txt généré (' + bookmarkletCode.length + ' octets).');

// 2. Générer index.html (sobre, moderne, 100% neutre et conforme)
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>X-Purge - Outil de blocage en masse pour X</title>
  <style>
    :root {
      --bg: #0f1419;
      --card-bg: #16181c;
      --border: #2f3336;
      --text: #e7e9ea;
      --text-muted: #8b98a5;
      --accent: #1d9bf0;
      --accent-hover: #1a8cd8;
      --success: #00ba7c;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      max-width: 760px;
      margin: 0 auto;
      padding: 32px 16px;
      line-height: 1.55;
    }
    h1 {
      font-size: 2rem;
      margin: 0 0 8px 0;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      font-size: 12px;
      background: #202327;
      color: var(--text-muted);
      padding: 3px 8px;
      border-radius: 9999px;
      border: 1px solid var(--border);
      vertical-align: middle;
      font-weight: 500;
    }
    p.lead {
      color: var(--text-muted);
      font-size: 15px;
      margin-bottom: 24px;
    }
    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 20px;
    }
    .section h2 {
      font-size: 1.25rem;
      color: #fff;
      margin-top: 0;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    /* Bookmarklet Box */
    .bookmark-box {
      background: #000;
      border: 1px dashed var(--accent);
      border-radius: 8px;
      padding: 24px 16px;
      text-align: center;
      margin: 16px 0 12px 0;
    }
    .bookmark-btn {
      display: inline-block;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      padding: 12px 28px;
      border-radius: 9999px;
      font-size: 16px;
      cursor: grab;
      user-select: none;
      transition: background 0.2s, transform 0.1s;
      box-shadow: 0 4px 12px rgba(29, 155, 240, 0.25);
    }
    .bookmark-btn:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }
    .hint {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 12px;
    }
    /* Code example box */
    .sample-box {
      background: #000;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 16px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 13px;
      color: #71767b;
      margin: 10px 0;
    }
    .sample-box span.active {
      color: var(--success);
    }
    ol {
      margin: 0;
      padding-left: 20px;
      color: #cfd9de;
    }
    li {
      margin-bottom: 10px;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .feature-item {
      background: #1d1f23;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 13px;
    }
    .feature-item strong {
      color: #fff;
      display: block;
      margin-bottom: 4px;
    }
    footer {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    footer a {
      color: var(--accent);
      text-decoration: none;
    }
    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>

  <h1>🛡️ X-Purge <span class="badge">Open Source</span></h1>
  <p class="lead">Outil d'automatisation de blocage pour X (Twitter) — sans extension, sans clé API, 100% exécuté localement dans votre navigateur.</p>

  <!-- Étape 1 : Le bookmarklet -->
  <div class="section">
    <h2>1. Installer le Bookmarklet</h2>
    <p>Affichez la barre de favoris de votre navigateur (<strong>Ctrl + Maj + B</strong> sous Windows ou <strong>Cmd + Maj + B</strong> sous Mac), puis <strong>glissez-déposez</strong> ce bouton directement dedans :</p>
    
    <div class="bookmark-box">
      <a class="bookmark-btn" href="${bookmarkletCode.replace(/"/g, '&quot;')}" draggable="true" title="Glissez ce bouton vers votre barre de favoris">
        🛡️ X-Purge
      </a>
      <div class="hint">👆 Glissez ce bouton vers votre barre de favoris</div>
    </div>
  </div>

  <!-- Étape 2 : Format des listes personnelles -->
  <div class="section">
    <h2>2. Préparez votre liste personnelle</h2>
    <p>X-Purge fonctionne avec vos propres listes de comptes. Vous pouvez coller du texte directement ou importer un fichier <code>.txt</code> respectant ce format simple :</p>

    <div class="sample-box">
      # Les lignes commençant par # ou vides sont ignorées<br>
      <span class="active">pseudo1</span><br>
      <span class="active">@pseudo2</span><br>
      <span class="active">autre_compte</span>
    </div>

    <p style="font-size:13px; color:var(--text-muted); margin-bottom:0;">
      ✓ Un compte par ligne<br>
      ✓ Le caractère <code>@</code> est facultatif (pris en charge automatiquement)<br>
      ✓ Vous pouvez reprendre l'exécution à tout moment grâce à l'index de départ
    </p>
  </div>

  <!-- Étape 3 : Mode d'emploi -->
  <div class="section">
    <h2>3. Mode d'emploi</h2>
    <ol>
      <li>Connectez-vous sur votre compte sur <a href="https://x.com" target="_blank" style="color:var(--accent);">x.com</a>.</li>
      <li>Cliquez sur votre favori <strong>🛡️ X-Purge</strong> : le panneau de contrôle s'ouvre directement sur la page.</li>
      <li>Glissez votre fichier <code>.txt</code> dans la zone prévue (ou collez votre liste de pseudos).</li>
      <li>Cliquez sur <strong>Démarrer le blocage</strong>. Vous pouvez mettre en pause ou arrêter à tout moment.</li>
    </ol>
  </div>

  <!-- Étape 4 : Confidentialité & Sécurité -->
  <div class="section">
    <h2>4. Confidentialité & Fonctionnement local</h2>
    <div class="feature-grid">
      <div class="feature-item">
        <strong>🔒 100% Local</strong>
        Tout s'exécute côté client dans votre propre navigateur. Aucune donnée n'est collectée ni envoyée.
      </div>
      <div class="feature-item">
        <strong>⚡ Zéro extension requise</strong>
        Fonctionne via un simple bookmarklet JavaScript sans installer d'extension tierce.
      </div>
      <div class="feature-item">
        <strong>📂 Vos propres listes</strong>
        L'outil est strictement neutre : vous restez seul maître des comptes que vous choisissez de bloquer.
      </div>
    </div>
  </div>

  <footer>
    <div>
      Code source : <a href="https://github.com/Louloume78/x-purge" target="_blank">Louloume78/x-purge</a>
    </div>
    <div>
      Basé sur <a href="https://github.com/MehdiHadizadeh/x-bulk-blocker" target="_blank">Mehdi Hadizadeh</a> · Licence <a href="https://github.com/Louloume78/x-purge/blob/main/LICENSE" target="_blank">MIT</a>
    </div>
  </footer>

</body>
</html>`;

fs.writeFileSync('index.html', html, 'utf8');
console.log('✅ index.html généré.');
