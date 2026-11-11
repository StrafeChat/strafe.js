/* global document, localStorage, matchMedia, navigator, MouseEvent */
// The API reference's top bar, made to match the guide's (docs/.vitepress/theme). Runs in the
// browser at the end of every TypeDoc page, before TypeDoc's own deferred script; TypeDoc keeps the
// page hidden until that one has run, so nothing here flashes. plugin.js copies this file into the
// output's assets and adds the <script> tag.
//
// - Wordmark: "strafe" + a green ".js" + an "API" micro-label, like the guide's "Docs". A hidden
//   space keeps the link's accessible name two words.
// - Search: TypeDoc's 36px icon becomes a field next to the title, "Search the API" with its
//   Ctrl K / Cmd K shortcut (TypeDoc's own), at the x where the guide's field starts.
// - Theme: a light/dark switch beside the links, like the guide's. It writes both sites' keys
//   (`tsd-theme`, `vitepress-theme-appearance`) so the choice carries across the two halves, and
//   follows TypeDoc's own select in Settings.
// - GitHub: drawn as the same icon the guide's bar uses; the word stays for screen readers.
// - Escape closes the phone menu, as it does in the guide.
(function () {
  var root = document.documentElement;

  function hidden(text) {
    var span = document.createElement('span');
    span.className = 'strafe-sr';
    span.textContent = text;
    return span;
  }

  // One inline wrapper, as VitePress renders the guide's: the title is a flex box, and separate flex
  // items would be read with a space between them ("strafe .js").
  var title = document.querySelector('.tsd-toolbar-contents > .title');
  if (title && title.textContent === 'strafe.js') {
    var word = document.createElement('span');
    word.textContent = 'strafe';
    var dot = document.createElement('span');
    dot.className = 'strafe-dot';
    dot.textContent = '.js';
    var tag = document.createElement('span');
    tag.className = 'strafe-tag';
    tag.textContent = 'API';
    word.append(dot, hidden('\u00a0'), tag);
    title.textContent = '';
    title.append(word);
  }

  var trigger = document.getElementById('tsd-search-trigger');
  if (trigger) {
    var label = document.createElement('span');
    label.className = 'strafe-search-label';
    label.textContent = 'Search the API';
    var keys = document.createElement('span');
    keys.className = 'strafe-search-keys';
    keys.setAttribute('aria-hidden', 'true');
    var mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    [mac ? '⌘' : 'Ctrl', 'K'].forEach(function (key) {
      var kbd = document.createElement('kbd');
      kbd.textContent = key;
      keys.append(kbd);
    });
    trigger.append(label, keys);
  }

  var links = document.getElementById('tsd-toolbar-links');
  var github = links && links.querySelector('a[href*="github.com"]');
  if (github) {
    github.classList.add('strafe-github');
    github.textContent = '';
    github.append(hidden('GitHub'));
  }

  function isDark() {
    var theme = root.dataset.theme;
    return theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  if (links) {
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'strafe-switch';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', 'Dark theme');
    toggle.innerHTML =
      '<span class="strafe-switch-check"><span class="strafe-switch-icon sun"></span><span class="strafe-switch-icon moon"></span></span>';
    var sync = function () {
      var dark = isDark();
      toggle.setAttribute('aria-checked', String(dark));
      toggle.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    };
    toggle.addEventListener('click', function () {
      var value = isDark() ? 'light' : 'dark';
      try {
        localStorage.setItem('tsd-theme', value);
        localStorage.setItem('vitepress-theme-appearance', value);
      } catch {
        // Storage can be blocked; the switch still works for this page.
      }
      root.dataset.theme = value;
      var select = document.getElementById('tsd-theme');
      if (select) select.value = value;
      sync();
    });
    document.addEventListener('change', function (event) {
      if (event.target && event.target.id === 'tsd-theme') sync();
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync);
    links.insertBefore(toggle, github || null);
    sync();
  }

  // TypeDoc closes its menu on a press outside it; Escape sends it one, so its own state stays right.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !root.classList.contains('has-menu')) return;
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    var menu = document.getElementById('tsd-toolbar-menu-trigger');
    if (menu) menu.focus();
  });
})();
