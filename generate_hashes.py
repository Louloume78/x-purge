#!/usr/bin/env python3
"""
Générateur d'empreintes SHA-256 pour les comptes protégés dans X-Purge.

Usage :
  python generate_hashes.py                      # Lit protected_accounts.txt ou saisie interactive
  python generate_hashes.py compte1 @compte2     # Pseudos directs
  python generate_hashes.py --file liste.txt      # Depuis un fichier personnalisé
  python generate_hashes.py --apply              # Met à jour directement bulk-block.js et index.html !
"""

import sys
import hashlib
import re
import urllib.parse
from pathlib import Path

def normalize_username(username: str) -> str:
    """Nettoie le pseudo : minuscules, sans espaces, sans @ initial."""
    u = username.strip().lower()
    if u.startswith('@'):
        u = u[1:]
    if 'x.com/' in u or 'twitter.com/' in u:
        u = u.split('/')[-1].split('?')[0].split('#')[0]
    return u

def get_hash(username: str) -> str:
    """Calcule l'empreinte SHA-256 du pseudo."""
    clean = normalize_username(username)
    return hashlib.sha256(clean.encode('utf-8')).hexdigest()

def apply_to_files(hashes: list):
    """Met à jour automatiquement bulk-block.js et index.html."""
    js_path = Path('bulk-block.js')
    html_path = Path('index.html')

    if not js_path.exists():
        print("[-] Erreur : bulk-block.js introuvable.")
        return

    # 1. Mise à jour de bulk-block.js
    with open(js_path, 'r', encoding='utf-8') as f:
        js_code = f.read()

    hash_lines = "\n".join([f'    "{h}",' for h in hashes])
    replacement = f"const PROTECTED_HASHES = new Set([\n{hash_lines}\n  ]);"

    pattern = r"const PROTECTED_HASHES = new Set\(\[[\s\S]*?\]\);"
    if not re.search(pattern, js_code):
        print("[-] Impossible de localiser 'const PROTECTED_HASHES' dans bulk-block.js.")
        return

    new_js = re.sub(pattern, replacement, js_code, count=1)
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(new_js)
    print("[+] bulk-block.js mis à jour avec les nouveaux hashes.")

    # 2. Mise à jour du bookmarklet dans index.html
    if html_path.exists():
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()

        encoded_js = 'javascript:' + urllib.parse.quote(new_js)
        html_pattern = r'(<a class="bookmark-btn" href=")[^"]*(")'
        new_html = re.sub(html_pattern, r'\g<1>' + encoded_js + r'\2', html)

        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(new_html)
        print("[+] index.html mis à jour (Bookmarklet synchronisé).")

def main():
    usernames = []
    apply_mode = False

    args = sys.argv[1:]
    if '--apply' in args:
        apply_mode = True
        args.remove('--apply')

    if len(args) >= 2 and args[0] == '--file':
        file_path = Path(args[1])
        if not file_path.exists():
            print(f"Erreur : le fichier '{file_path}' n'existe pas.")
            sys.exit(1)
        with open(file_path, 'r', encoding='utf-8') as f:
            usernames = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    elif len(args) > 0:
        usernames = args
    else:
        default_file = Path("protected_accounts.txt")
        if default_file.exists():
            print(f"[*] Lecture automatique du fichier '{default_file}'...")
            with open(default_file, 'r', encoding='utf-8') as f:
                usernames = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        else:
            print("=== Générateur de hashes X-Purge ===")
            print("Entrez les pseudos à protéger (un par ligne). Terminez par une ligne vide :")
            try:
                while True:
                    line = input("> ").strip()
                    if not line:
                        break
                    usernames.append(line)
            except (KeyboardInterrupt, EOFError):
                print()

    clean_list = []
    seen = set()
    for u in usernames:
        norm = normalize_username(u)
        if norm and norm not in seen:
            seen.add(norm)
            clean_list.append(norm)

    if not clean_list:
        print("Aucun compte valide détecté.")
        sys.exit(0)

    hashes = [get_hash(u) for u in clean_list]

    print(f"\n[+] {len(clean_list)} compte(s) converti(s) en hashes SHA-256.")

    if apply_mode:
        apply_to_files(hashes)
        print("[OK] Tout est synchronisé avec succès !")
    else:
        print("\n" + "=" * 60)
        print("// Copiez-collez ce bloc dans bulk-block.js (section PROTECTED_HASHES) :")
        print("=" * 60)
        print("  const PROTECTED_HASHES = new Set([")
        for h in hashes:
            print(f'    "{h}",')
        print("  ]);")
        print("=" * 60)
        print("\nAstuce : Lancez 'python generate_hashes.py --apply' pour mettre à jour automatiquement bulk-block.js et index.html !")

if __name__ == '__main__':
    main()
