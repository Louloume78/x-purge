#!/usr/bin/env python3
"""
Met à jour le lien Bookmarklet dans index.html à partir de bulk-block.js.
"""
import urllib.parse
import re

def update():
    with open('bulk-block.js', 'r', encoding='utf-8') as f:
        js_code = f.read()

    encoded_js = 'javascript:' + urllib.parse.quote(js_code)

    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    pattern = r'(<a class="bookmark-btn" href=")[^"]*(")'
    new_html = re.sub(pattern, r'\g<1>' + encoded_js + r'\2', html)

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_html)

    print("index.html mis à jour avec le nouveau bookmarklet !")

if __name__ == '__main__':
    update()

