/* ============================================================
   Study Live — pages/contacts.js
   Personal contacts: numbers, emails, photo, category, org.
   Each card offers one-tap tel: / mailto: actions · search by
   name / number / email · category filter. Flat JSON in the
   store maps 1:1 onto a Supabase `contacts` table tied to the
   future Google account (user_id) + photo in storage buckets.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var u = SL.utils;

  function t(key, vars) {
    return SL.i18n.t(key, vars);
  }

  var CATS = [
    { id: 'teacher', key: 'ct.catTeacher', icon: 'graduation' },
    { id: 'admin', key: 'ct.catAdmin', icon: 'users' },
    { id: 'deanery', key: 'ct.catDeanery', icon: 'trophy' },
    { id: 'center', key: 'ct.catCenter', icon: 'mapPin' },
    { id: 'other', key: 'ct.catOther', icon: 'users' },
  ];

  function catKey(id) {
    var c = CATS.filter(function (x) {
      return x.id === id;
    })[0];
    return c ? c.key : 'ct.catOther';
  }

  var AVATAR_COLORS = ['#33589e', '#7b5aa6', '#2f9e8f', '#b3541e', '#c0392b', '#b8860b', '#2f6f4f', '#8a4baf'];

  function avatarColor(name) {
    var s = String(name || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function initial(name) {
    var s = String(name || '').trim();
    return s ? s.charAt(0).toUpperCase() : '?';
  }

  function isDataUrl(x) {
    return (
      typeof x === 'string' &&
      /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(x)
    );
  }

  function avatarHTML(photo, name) {
    if (!photo) {
      return (
        '<span class="contact-avatar" style="background:' + avatarColor(name) + '">' +
        u.esc(initial(name)) + '</span>'
      );
    }
    if (isDataUrl(photo)) {
      return '<img class="contact-avatar" src="' + u.esc(photo) + '" alt="" decoding="async" loading="lazy">';
    }
    return (
      '<span class="contact-avatar" data-img-id="' + u.esc(photo) + '" style="background:' +
      avatarColor(name) + '">' + u.esc(initial(name)) + '</span>'
    );
  }

  var filter = { q: '', cat: '' };

  function matches(c) {
    if (filter.cat && c.category !== filter.cat) return false;
    if (filter.q) {
      var q = filter.q.toLowerCase();
      var hay = (c.name + ' ' + (c.org || '') + ' ' + (c.phones || []).join(' ') + ' ' + (c.emails || []).join(' ')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function cardHTML(c) {
    var phoneLine = (c.phones || [])
      .map(function (p) {
        return (
          '<a class="contact-line contact-clickable" href="tel:' + u.esc(p.replace(/[^\d+]/g, '')) + '" data-line>' +
          SL.ui.icon('phone', 15) + '<span>' + u.esc(p) + '</span></a>'
        );
      })
      .join('');
    var emailLine = (c.emails || [])
      .map(function (em) {
        return (
          '<a class="contact-line contact-clickable" href="mailto:' + u.esc(em) + '" data-line>' +
          SL.ui.icon('mail', 15) + '<span>' + u.esc(em) + '</span></a>'
        );
      })
      .join('');
    var noteHtml = c.note ? '<div class="contact-note">' + u.esc(c.note) + '</div>' : '';
    return (
      '<div class="contact-card stagger" data-id="' + u.esc(c.id) + '">' +
      '<div class="contact-top">' +
      avatarHTML(c.photo, c.name) +
      '<div class="contact-info">' +
      '<div class="contact-name">' + u.esc(c.name) + '</div>' +
      (c.org ? '<div class="contact-org">' + u.esc(c.org) + '</div>' : '') +
      '<span class="contact-cat">' + u.esc(t(catKey(c.category))) + '</span>' +
      '</div></div>' +
      '<div class="contact-lines">' + phoneLine + emailLine + '</div>' +
      noteHtml +
      '<div class="contact-actions">' +
      '<button class="mini-btn" data-act="edit" aria-label="' + u.esc(t('a.edit')) + '">' +
      SL.ui.icon('pencil', 16) + '</button>' +
      '<button class="mini-btn danger" data-act="del" aria-label="' + u.esc(t('a.delete')) + '">' +
      SL.ui.icon('trash', 16) + '</button>' +
      '</div></div>'
    );
  }
/* ---------- add / edit sheet ---------- */

  function addRow(key, value, ph) {
    var row = document.createElement('div');
    row.className = 'cf-item';
    var input = document.createElement('input');
    input.className = 'input';
    input.type = key === 'email' ? 'email' : 'tel';
    input.placeholder = ph;
    input.value = value || '';
    input.setAttribute('dir', 'ltr');
    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'mini-btn danger';
    rm.setAttribute('aria-label', t('a.delete'));
    rm.innerHTML = SL.ui.icon('x', 14);
    rm.addEventListener('click', function () {
      row.remove();
    });
    row.appendChild(input);
    row.appendChild(rm);
    return row;
  }

  function openContactForm(existing) {
    var editing = !!existing;
    var photo = existing ? (existing.photo || null) : null;

    var body = document.createElement('div');
    body.className = 'cf-form';

    var photoHtml =
      '<div class="cf-photo-row">' +
      '<div class="cf-preview" data-host="preview">' + avatarHTML(photo, existing ? existing.name : '') + '</div>' +
      '<div class="cf-photo-btns">' +
      '<button type="button" class="btn btn-ghost" data-act="pick">' + SL.ui.icon('image', 16) +
      '<span>' + u.esc(t('ct.photo')) + '</span></button>' +
      '<button type="button" class="btn btn-ghost danger" data-act="remove" hidden>' +
      SL.ui.icon('trash', 16) + '<span>' + u.esc(t('th.removePhoto')) + '</span></button>' +
      '</div>' +
      '<input type="file" accept="image/*" data-host="file" hidden>' +
      '</div>';

    var catOptions = CATS.map(function (c) {
      return (
        '<option value="' + u.esc(c.id) + '"' +
        (existing && existing.category === c.id ? ' selected' : '') + '>' +
        u.esc(t(c.key)) + '</option>'
      );
    }).join('');

    body.innerHTML =
      '<div class="field"><label>' + u.esc(t('ct.name')) + '</label>' +
      '<input class="input" data-host="name" placeholder="' + u.esc(t('ct.namePh')) +
      '" value="' + u.esc(existing ? existing.name : '') + '"></div>' +
      '<div class="field"><label>' + u.esc(t('ct.category')) + '</label>' +
      '<select class="select" data-host="cat">' + catOptions + '</select></div>' +
      '<div class="field"><label>' + u.esc(t('ct.org')) + '</label>' +
      '<input class="input" data-host="org" placeholder="' + u.esc(t('ct.orgPh')) +
      '" value="' + u.esc(existing ? (existing.org || '') : '') + '"></div>' +
      '<div class="field"><label>' + u.esc(t('ct.photo')) + '</label>' + photoHtml + '</div>' +
      '<div class="field"><label>' + u.esc(t('ct.phone')) + '</label>' +
      '<div class="cf-list" data-host="phones"></div>' +
      '<button type="button" class="btn btn-ghost cf-add-row" data-act="add-phone">' +
      SL.ui.icon('plus', 16) + '<span>' + u.esc(t('ct.addPhone')) + '</span></button></div>' +
      '<div class="field"><label>' + u.esc(t('ct.email')) + '</label>' +
      '<div class="cf-list" data-host="emails"></div>' +
      '<button type="button" class="btn btn-ghost cf-add-row" data-act="add-email">' +
      SL.ui.icon('plus', 16) + '<span>' + u.esc(t('ct.addEmail')) + '</span></button></div>' +
      '<div class="field"><label>' + u.esc(t('ct.note')) + '</label>' +
      '<textarea class="textarea" data-host="note" rows="2" placeholder="' +
      u.esc(t('ct.notePh')) + '">' + u.esc(existing ? (existing.note || '') : '') + '</textarea></div>';

    var foot =
      (editing ? '<button class="btn btn-danger" data-x="del"></button>' : '') +
      '<button class="btn btn-primary" data-x="save"></button>';

    var h = SL.ui.openSheet({ title: editing ? t('ct.edit') : t('ct.add'), body: body, footHTML: foot });
    h.el.querySelector('[data-x="save"]').textContent = t('a.save');
    var delBtn = h.el.querySelector('[data-x="del"]');
    if (delBtn) delBtn.textContent = t('a.delete');

    function renderPhoto() {
      var host = h.el.querySelector('[data-host="preview"]');
      host.innerHTML = avatarHTML(photo, h.el.querySelector('[data-host="name"]').value || (existing ? existing.name : ''));
      var removeBtn = h.el.querySelector('[data-act="remove"]');
      removeBtn.hidden = !photo;
      SL.ui.hydrateImages(host);
    }
function renderList(hostSel) {
      var host = h.el.querySelector(hostSel);
      var type = hostSel === '[data-host="phones"]' ? 'phone' : 'email';
      var ph = hostSel === '[data-host="phones"]' ? t('ct.phone') : t('ct.email');
      if (!host.children.length) {
        host.appendChild(addRow(type, '', ph));
      }
    }

    var fileInput = body.querySelector('[data-host="file"]');
    h.el.querySelector('[data-act="pick"]').addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      u.compressImage(f).then(function (dataUrl) {
        if (SL.db.available) {
          var id = u.uid();
          return SL.db.putImage(id, u.dataURLtoBlob(dataUrl)).then(function () {
            photo = id;
          });
        }
        photo = dataUrl;
      }).then(function () {
        renderPhoto();
      }).catch(function () {
        SL.ui.toast(t('n.imgFailed'), 'error');
      });
      fileInput.value = '';
    });

    var removeBtn = h.el.querySelector('[data-act="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        photo = null;
        renderPhoto();
      });
    }

    body.addEventListener('click', function (e) {
      if (e.target.closest('[data-act="add-phone"]')) renderList('[data-host="phones"]');
      if (e.target.closest('[data-act="add-email"]')) renderList('[data-host="emails"]');
    });

    h.el.querySelector('[data-x="save"]').addEventListener('click', function () {
      var nameEl = h.el.querySelector('[data-host="name"]');
      var name = (nameEl.value || '').trim();
      if (!name) {
        nameEl.focus();
        return;
      }
      var phones = Array.prototype.slice.call(h.el.querySelectorAll('[data-host="phones"] .cf-item input')).map(function (i) { return i.value; });
      var emails = Array.prototype.slice.call(h.el.querySelectorAll('[data-host="emails"] .cf-item input')).map(function (i) { return i.value; });
      var data = {
        name: name,
        category: h.el.querySelector('[data-host="cat"]').value || 'other',
        org: h.el.querySelector('[data-host="org"]').value,
        phones: phones,
        emails: emails,
        photo: photo,
        note: h.el.querySelector('[data-host="note"]').value,
      };
      if (editing) SL.store.updateContact(existing.id, data);
      else SL.store.addContact(data);
      SL.ui.toast(t('toast.saved'));
      h.close();
    });

    if (delBtn) {
      delBtn.addEventListener('click', function () {
        SL.ui.confirmSheet({
          title: t('ct.confirmDel', { name: existing.name }),
          message: t('ct.confirmDelHint'),
          danger: true,
        }).then(function (yes) {
          if (!yes) return;
          SL.store.deleteContact(existing.id);
          SL.ui.toast(t('toast.deleted'));
          h.close();
        });
      });
    }

    renderList('[data-host="phones"]');
    renderList('[data-host="emails"]');
    renderPhoto();
  }
function confirmDelete(c) {
    SL.ui.confirmSheet({
      title: t('ct.confirmDel', { name: c.name }),
      message: t('ct.confirmDelHint'),
      danger: true,
    }).then(function (yes) {
      if (yes) {
        SL.store.deleteContact(c.id);
        SL.ui.toast(t('toast.deleted'));
      }
    });
  }

  function render(rootEl) {
    var all = SL.store.contacts();

    var cats = '<div class="contacts-cats" data-host="cats">' +
      '<button class="chip" data-cat="" aria-pressed="' + (!filter.cat ? 'true' : 'false') + '">' +
      u.esc(t('ct.catAll')) + '</button>' +
      CATS.map(function (c) {
        return (
          '<button class="chip" data-cat="' + u.esc(c.id) + '" aria-pressed="' +
          (filter.cat === c.id ? 'true' : 'false') + '">' +
          SL.ui.icon(c.icon, 14) + u.esc(t(c.key)) + '</button>'
        );
      }).join('') +
      '</div>';

    var visible = all.filter(matches);
    var count = '<div class="contacts-count">' + u.esc(t('ct.count', { n: visible.length, total: all.length })) + '</div>';

    var listHtml = !all.length
      ? '<div class="empty">' + SL.ui.icon('users', 40) +
        '<div class="e-title">' + u.esc(t('ct.empty')) + '</div>' +
        '<div class="e-hint">' + u.esc(t('ct.emptyHint')) + '</div></div>'
      : !visible.length
        ? '<div class="empty">' + SL.ui.icon('search', 40) +
          '<div class="e-title">' + u.esc(t('ct.noResults')) + '</div></div>'
        : '<div class="contacts-grid">' + visible.map(cardHTML).join('') + '</div>';

    rootEl.innerHTML =
      '<header class="page-head">' +
      '<h1><div class="icon-wrap">' + SL.ui.icon('users', 24) + '</div><span>' +
      u.esc(t('nav.contacts')) + '</span></h1></header>' +
      '<div class="page-content">' +
      '<div class="contacts-toolbar">' +
      '<div class="contacts-search">' + SL.ui.icon('search', 18) +
      '<input class="input" data-host="q" type="search" placeholder="' + u.esc(t('ct.searchPh')) +
      '" value="' + u.esc(filter.q) + '" autocomplete="off">' +
      '<button class="contacts-clear" data-host="clear" hidden>' + SL.ui.icon('x', 16) + '</button>' +
      '</div></div>' +
      cats +
      count +
      listHtml +
      '</div>';

    SL.ui.hydrateImages(rootEl);

    var qInput = rootEl.querySelector('[data-host="q"]');
    var clear = rootEl.querySelector('[data-host="clear"]');
    qInput.addEventListener('input', function () {
      filter.q = qInput.value;
      clear.hidden = !filter.q;
      renderList(rootEl);
    });
    clear.addEventListener('click', function () {
      filter.q = '';
      qInput.value = '';
      clear.hidden = true;
      renderList(rootEl);
      qInput.focus();
    });

    var catsHost = rootEl.querySelector('[data-host="cats"]');
    catsHost.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat]');
      if (!chip) return;
      filter.cat = chip.getAttribute('data-cat') || '';
      catsHost.querySelectorAll('[data-cat]').forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-cat') === filter.cat ? 'true' : 'false');
      });
      renderList(rootEl);
    });

    var grid = rootEl.querySelector('.contacts-grid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var card = e.target.closest('.contact-card');
        if (!card) return;
        var c = SL.store.contactById(card.getAttribute('data-id'));
        if (!c) return;
        var act = e.target.closest('[data-act]');
        if (!act) return;
        if (act.getAttribute('data-act') === 'edit') openContactForm(c);
        else if (act.getAttribute('data-act') === 'del') confirmDelete(c);
      });
    }
  }

  function renderList(rootEl) {
    var searchInput = rootEl.querySelector('[data-host="q"]');
    // re-render just the grid/count/clear
    var all = SL.store.contacts();
    var visible = all.filter(matches);
    var grid = rootEl.querySelector('.contacts-grid');
    var countEl = rootEl.querySelector('.contacts-count');
    var clear = rootEl.querySelector('[data-host="clear"]');
    clear.hidden = !filter.q;
    if (countEl) countEl.textContent = t('ct.count', { n: visible.length, total: all.length });
    if (grid) grid.innerHTML = visible.map(cardHTML).join('');
    SL.ui.hydrateImages(rootEl);
  }

  SL.pages = SL.pages || {};
  SL.pages.contacts = {
    id: 'contacts',
    labelKey: 'nav.contacts',
    icon: 'users',
    getFab: function () {
      return { labelKey: 'ct.add', action: function () { openContactForm(null); } };
    },
    render: render,
  };
})(typeof window !== 'undefined' ? window : globalThis);