/* ============================================================
   Study Live — pages/vault.js  (V5)
   School passwords & accounts manager.
   Gated: first visit = create a 4-digit PIN + a hint; later
   visits require the PIN. Re-locks when leaving the page or
   reloading. PIN is stored hashed (non-plaintext). The hint
   (entered in Profile) is the ONLY way to change the PIN.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;
  var t = function (k, v) {
    return SL.i18n.t(k, v);
  };

  var unlocked = false; // session-memory only — re-locks on reload

  function icon(name, size) {
    return SL.ui.icon(name, size);
  }

  /* Only allow http/https links in the vault — blocks javascript: etc. */
  function safeUrl(url) {
    var s = String(url || '').trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }

  /* ---------- PIN boxes widget ---------- */

  function pinBoxes(host, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'pin-boxes';
    var inputs = [];
    for (var i = 0; i < 4; i++) {
      (function (idx) {
        var inp = document.createElement('input');
        inp.type = 'password';
        inp.inputMode = 'numeric';
        inp.maxLength = 1;
        inp.autocomplete = 'off';
        inp.className = 'pin-digit';
        inp.setAttribute('aria-label', t('v.pin') + ' ' + (idx + 1));
        inp.addEventListener('input', function () {
          inp.value = inp.value.replace(/\D/g, '').slice(-1);
          if (inp.value && idx < 3) inputs[idx + 1].focus();
        });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1].focus();
        });
        inp.addEventListener('paste', function (e) {
          var text = (e.clipboardData || root.clipboardData).getData('text') || '';
          var digits = text.replace(/\D/g, '').slice(0, 4);
          if (digits.length) {
            e.preventDefault();
            for (var d = 0; d < digits.length && idx + d < 4; d++) {
              inputs[idx + d].value = digits[d];
            }
            inputs[Math.min(idx + digits.length, 3)].focus();
          }
        });
        inputs.push(inp);
        wrap.appendChild(inp);
      })(i);
    }
    host.appendChild(wrap);
    return {
      value: function () {
        return inputs
          .map(function (x) {
            return x.value;
          })
          .join('');
      },
      clear: function () {
        inputs.forEach(function (x) {
          x.value = '';
        });
        inputs[0].focus();
      },
      focus: function () {
        inputs[0].focus();
      },
    };
  }

  function getValue(root2, sel) {
    var el = root2.querySelector(sel);
    return el ? el.value : '';
  }

  /* ---------- first-run: create lock ---------- */

  function renderSetup(root2) {
    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('v.title')) + '</h1>' +
      '<div class="card card-pad vault-hero">' +
      icon('lock', 34) +
      '<div class="e-title" style="margin-top:8px">' + u.esc(t('v.setupTitle')) + '</div>' +
      '<p class="hint-line" style="margin-top:6px">' + u.esc(t('v.setupHint')) + '</p>' +
      '<div class="field" style="margin-top:14px"><label>' + u.esc(t('v.pin')) + '</label><div data-host="pin1"></div></div>' +
      '<div class="field"><label>' + u.esc(t('v.pinConfirm')) + '</label><div data-host="pin2"></div></div>' +
      '<div class="field"><label for="vp-hint">' + u.esc(t('v.hint')) + '</label>' +
      '<input class="input" id="vp-hint" placeholder="' + u.esc(t('v.hintPh')) + '">' +
      '<span class="field-error" role="alert" data-host="err" hidden></span></div>' +
      '<button class="btn btn-primary btn-block" data-act="create">' + icon('lock', 17) + u.esc(t('v.create')) + '</button>' +
      '<p class="hint-line" style="margin-top:12px">' + icon('lock', 12) + ' ' + u.esc(t('v.security')) + '</p>' +
      '</div>';

    var pin1 = pinBoxes(root2.querySelector('[data-host="pin1"]'));
    var pin2 = pinBoxes(root2.querySelector('[data-host="pin2"]'));
    var err = root2.querySelector('[data-host="err"]');
    pin1.focus();

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
    }

    root2.querySelector('[data-act="create"]').addEventListener('click', function () {
      var p1 = pin1.value();
      var p2 = pin2.value();
      if (!/^\d{4}$/.test(p1) || !/^\d{4}$/.test(p2)) {
        fail(t('v.need4'));
        return;
      }
      if (p1 !== p2) {
        fail(t('v.pinMismatch'));
        return;
      }
      var hint = getValue(root2, '#vp-hint');
      SL.store.vaultSetup(p1, hint).then(function (res) {
        if (!res.ok) {
          fail(res.error === 'hint' ? t('v.hint') : t('v.need4'));
          return;
        }
        unlocked = true;
        render(root2, true);
        SL.router.updateFab(SL.pages.vault); // show the add FAB after unlocking
        SL.ui.toast(t('toast.saved'));
      });
    });
  }

  /* ---------- locked: enter PIN ---------- */

  function fmtLockout(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m > 0 ? (m + ':' + (s < 10 ? '0' : '') + s) : String(s);
  }

  function renderLocked(root2) {
    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('v.title')) + '</h1>' +
      '<div class="card card-pad vault-hero">' +
      icon('lock', 34) +
      '<div class="e-title" style="margin-top:8px">' + u.esc(t('v.unlockTitle')) + '</div>' +
      '<p class="hint-line" style="margin-top:6px">' + u.esc(t('v.unlockSub')) + '</p>' +
      '<div style="margin-top:14px" data-host="pin"></div>' +
      '<span class="field-error" role="alert" data-host="err" hidden></span>' +
      '<button class="btn btn-primary btn-block" data-act="unlock" style="margin-top:12px">' + icon('lock', 17) + u.esc(t('v.unlock')) + '</button>' +
      '</div>';

    var pin = pinBoxes(root2.querySelector('[data-host="pin"]'));
    var err = root2.querySelector('[data-host="err"]');
    var unlockBtn = root2.querySelector('[data-act="unlock"]');
    pin.focus();

    function showLockout() {
      var secs = SL.store.vaultLockoutSeconds();
      if (secs > 0) {
        err.textContent = t('v.lockedOut').replace('{time}', fmtLockout(secs));
        err.hidden = false;
        pin.clear();
        unlockBtn.disabled = true;
        var timer = setInterval(function () {
          var s2 = SL.store.vaultLockoutSeconds();
          if (!SL.store.vaultIsLockedOut()) {
            clearInterval(timer);
            unlockBtn.disabled = false;
            err.hidden = true;
          } else {
            err.textContent = t('v.lockedOut').replace('{time}', fmtLockout(s2));
          }
        }, 1000);
        return true;
      }
      return false;
    }

    function attempt() {
      if (SL.store.vaultIsLockedOut()) {
        showLockout();
        return;
      }
      SL.store.verifyVaultPin(pin.value()).then(function (ok) {
        if (ok) {
          unlocked = true;
          SL.router.refresh();
          render(root2, true);
          SL.router.updateFab(SL.pages.vault); // show the add FAB after unlocking
        } else {
          SL.store.vaultFailAttempt();
          if (!showLockout()) {
            err.textContent = t('v.wrongPin');
            err.hidden = false;
            pin.clear();
          }
        }
      });
    }

    root2.querySelector('[data-act="unlock"]').addEventListener('click', attempt);
    root2.querySelector('[data-host="pin"]').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attempt();
    });
    showLockout(); // locked state may persist across a reload
  }

  /* ---------- unlocked: entries list ---------- */

  function entryCardHTML(e) {
    var safe = safeUrl(e.url);
    return (
      '<div class="card card-pad vault-entry" data-id="' + e.id + '">' +
      '<div class="ve-head"><span class="ve-title">' + u.esc(e.title) + '</span>' +
      '<span class="s-actions">' +
      '<button class="mini-btn" data-act="edit" aria-label="' + u.esc(t('a.edit')) + '">' + icon('pencil', 16) + '</button>' +
      '<button class="mini-btn danger" data-act="del" aria-label="' + u.esc(t('a.delete')) + '">' + icon('trash', 16) + '</button>' +
      '</span></div>' +
      (e.username
        ? '<div class="ve-row">' + icon('profile', 14) + '<span class="ve-mono">' + u.esc(e.username) + '</span></div>'
        : '') +
      '<div class="ve-row">' +
      '<span class="ve-pass num" data-pass>' + '••••••••' + '</span>' +
      '<button class="mini-btn" data-act="show" aria-label="' + u.esc(t('v.show')) + '" data-shown="false">' + icon('eye', 16) + '</button>' +
      '<button class="mini-btn" data-act="copy" aria-label="' + u.esc(t('v.copied')) + '">' + icon('copy', 16) + '</button>' +
      '</div>' +
      (safe
        ? '<div class="ve-row"><a class="ve-link" href="' + u.esc(safe) + '" target="_blank" rel="noopener noreferrer">' +
          icon('globe', 14) + '<span>' + u.esc(e.url) + '</span></a></div>'
        : '') +
      (e.description ? '<div class="ve-desc">' + u.esc(e.description) + '</div>' : '') +
      '</div>'
    );
  }

  function renderList(root2, animate) {
    var st = SL.store.get();
    var entries = st.vault.entries.slice().sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    root2.innerHTML =
      '<h1 class="page-title">' + u.esc(t('v.title')) + '</h1>' +
      '<div class="day-greeting">' + icon('lock', 14) + '<span>' + u.esc(t('v.security')) + '</span>' +
      '<button class="mini-btn" data-act="lock" style="margin-inline-start:auto" aria-label="' + u.esc(t('v.lockBtn')) + '">' + icon('lock', 16) + '</button></div>' +
      '<div class="search-wrap vault-search">' + icon('search', 17) +
      '<input class="input" type="search" data-act="vq" placeholder="' + u.esc(t('v.searchPh')) + '" aria-label="' + u.esc(t('a.search')) + '"></div>' +
      '<div data-host="list" class="stagger"></div>';

    var host = root2.querySelector('[data-host="list"]');
    function visibleEntries() {
      var qEl = root2.querySelector('[data-act="vq"]');
      var q = qEl ? qEl.value.trim().toLowerCase() : '';
      if (!q) return entries;
      return entries.filter(function (x) {
        return ((x.title + ' ' + (x.username || '') + ' ' + (x.description || '')).toLowerCase().indexOf(q) !== -1);
      });
    }
    function renderListItems(animateFlag) {
      var vis = visibleEntries();
      if (!entries.length) {
        host.innerHTML =
          '<div class="empty">' +
          icon('lock', 40) +
          '<div class="e-title">' + u.esc(t('v.empty')) + '</div>' +
          '<div class="e-hint">' + u.esc(t('v.emptyHint')) + '</div>' +
          '<button class="btn btn-primary" data-act="add">' + icon('plus', 17) + u.esc(t('v.add')) + '</button>' +
          '</div>';
        return;
      }
      if (!vis.length) {
        host.innerHTML = '<div class="empty"><div class="e-title">' + u.esc(t('n.noResults')) + '</div>' +
          '<div class="e-hint">' + u.esc(t('n.noResultsHint')) + '</div></div>';
        return;
      }
      host.innerHTML = vis.map(entryCardHTML).join('');
      if (animateFlag === false) {
        u.$$('.stagger', host).forEach(function (el) {
          el.classList.remove('stagger');
        });
      }
    }
    renderListItems(animate);

    var vq = root2.querySelector('[data-act="vq"]');
    vq.addEventListener('input', u.debounce(function () {
      renderListItems(false);
    }, 140));

    host.addEventListener('click', function (e) {
      var addBtn = e.target.closest('[data-act="add"]');
      if (addBtn) {
        openEntryForm(null, root2);
        return;
      }
      if (e.target.closest('[data-act="lock"]')) {
        lockNow();
        return;
      }
      var card = e.target.closest('.vault-entry[data-id]');
      if (!card) return;
      var id = card.getAttribute('data-id');
      var entry = st.vault.entries.filter(function (x) {
        return x.id === id;
      })[0];
      if (!entry) return;
      var act = e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');

      if (a === 'show' || a === 'hide') {
        var passEl = card.querySelector('[data-pass]');
        var showing = act.getAttribute('data-shown') === 'true';
        passEl.textContent = showing ? '••••••••' : entry.password;
        act.setAttribute('data-act', showing ? 'show' : 'hide');
        act.setAttribute('data-shown', showing ? 'false' : 'true');
        act.innerHTML = icon(showing ? 'eye' : 'eyeOff', 16);
      } else if (a === 'copy') {
        copyText(entry.password);
      } else if (a === 'edit') {
        openEntryForm(entry, root2);
      } else if (a === 'del') {
        SL.ui
          .confirmSheet({
            title: t('v.deleteQ', { name: entry.title }),
            message: t('v.deleteHint'),
            danger: true,
          })
          .then(function (yes) {
            if (yes) {
              SL.store.deleteVaultEntry(id);
              render(root2, false);
              SL.ui.toast(t('toast.deleted'));
            }
          });
      }
    });
  }

  function copyText(text) {
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {      root.navigator.clipboard
        .writeText(text)
        .then(function () {
          SL.ui.toast(t('v.copied'));
        })
        .catch(function () {
          SL.ui.toast(t('v.copyFail'), 'error');
        });
    } else {
      SL.ui.toast(t('v.copyFail'), 'error');
    }
  }

  /* ---------- add/edit entry sheet ---------- */

  function openEntryForm(entry, root2) {
    var editing = !!entry;
    var body = document.createElement('div');
    body.innerHTML =
      '<div class="field"><label for="ve-title">' + u.esc(t('v.entryTitle')) + '</label>' +
      '<input class="input" id="ve-title" maxlength="80" value="' + u.esc(entry ? entry.title : '') + '" placeholder="' + u.esc(t('v.entryTitlePh')) + '">' +
      '<span class="field-error" role="alert" data-host="err" hidden></span></div>' +
      '<div class="field"><label for="ve-user">' + u.esc(t('v.username')) + '</label>' +
      '<input class="input" id="ve-user" dir="auto" value="' + u.esc(entry ? entry.username : '') + '" placeholder="' + u.esc(t('v.usernamePh')) + '"></div>' +
      '<div class="field"><label for="ve-url">' + u.esc(t('v.url')) + '</label>' +
      '<input class="input" id="ve-url" dir="ltr" value="' + u.esc(entry ? entry.url : '') + '" placeholder="' + u.esc(t('v.urlPh')) + '"></div>' +
      '<div class="field"><label for="ve-pass">' + u.esc(t('v.password')) + '</label>' +
      '<div style="display:flex;gap:8px"><input class="input" id="ve-pass" dir="auto" type="password" style="flex:1" value="' + u.esc(entry ? entry.password : '') + '">' +
      '<button class="btn btn-ghost" type="button" data-act="reveal" style="min-width:48px;padding:0">' + icon('eye', 18) + '</button></div></div>' +
      '<div class="field" style="margin-bottom:0"><label for="ve-desc">' + u.esc(t('v.desc')) + '</label>' +
      '<textarea class="textarea compact" id="ve-desc" rows="2" placeholder="' + u.esc(t('v.descPh')) + '">' + u.esc(entry ? entry.description : '') + '</textarea></div>';

    var foot =
      '<button class="btn btn-ghost" data-x="cancel"></button>' +
      '<button class="btn btn-primary" data-x="save"></button>';

    var h = SL.ui.openSheet({
      title: editing ? t('v.editTitle') : t('v.add'),
      body: body,
      footHTML: foot,
    });

    h.el.querySelector('[data-x="cancel"]').textContent = t('a.cancel');
    h.el.querySelector('[data-x="save"]').textContent = t('a.save');

    var passInput = body.querySelector('#ve-pass');
    body.querySelector('[data-act="reveal"]').addEventListener('click', function (ev) {
      var btn = ev.currentTarget;
      var show = passInput.type === 'password';
      passInput.type = show ? 'text' : 'password';
      btn.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
    });

    h.el.querySelector('[data-x="cancel"]').addEventListener('click', function () {
      h.close();
    });

    h.el.querySelector('[data-x="save"]').addEventListener('click', function () {
      var title = body.querySelector('#ve-title').value.trim();
      var err = body.querySelector('[data-host="err"]');
      if (!title) {
        err.textContent = t('v.entryTitle');
        err.hidden = false;
        body.querySelector('#ve-title').focus();
        return;
      }
      var data = {
        title: title,
        username: body.querySelector('#ve-user').value.trim(),
        url: body.querySelector('#ve-url').value.trim(),
        password: passInput.value,
        description: body.querySelector('#ve-desc').value.trim(),
      };
      if (editing) SL.store.updateVaultEntry(entry.id, data);
      else SL.store.addVaultEntry(data);
      h.close();
      toast(t('toast.saved'));
    });

    function toast(msg) {
      SL.ui.toast(msg);
    }
  }

  function lockNow() {
    unlocked = false;
    SL.router.refresh();
  }

  /* ---------- render ---------- */

  function render(root2, animate) {
    if (!SL.store.vaultHasPin()) renderSetup(root2);
    else if (!unlocked) renderLocked(root2);
    else renderList(root2, animate);
  }

  SL.pages = SL.pages || {};
  SL.pages.vault = {
    id: 'vault',
    labelKey: 'nav.vault',
    icon: 'lock',
    render: render,
    onLeave: function () {
      unlocked = false; // re-lock whenever the user leaves the page
    },
    getFab: function () {
      if (!unlocked || !SL.store.vaultHasPin()) return null;
      return {
        labelKey: 'v.add',
        action: function () {
          var host = u.$('#page-vault [data-host="list"]');
          if (host) openEntryForm(null, host);
        },
      };
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
