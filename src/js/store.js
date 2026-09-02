/* ============================================================
   Study Live — store.js  (schema v3)
   Single source of truth. Persists text data to localStorage
   ('studyLive.v1' key) and note images to IndexedDB via SL.db.
   note.images entries = image id (IDB) or legacy 'data:' URL.
   All mutations go through actions and emit 'change'.
   ============================================================ */
(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});
  var KEY = 'studyLive.v1'; // keep stable across versions (data migrates in-place)
  var u = SL.utils;

  function idb() {
    return SL.db && SL.db.available ? SL.db : null;
  }

  function isLegacyDataUrl(entry) {
    return typeof entry === 'string' && entry.slice(0, 5) === 'data:';
  }

  var listeners = [];
  var state = null;

  function defaults() {
    return {
      v: 5,
      settings: { lang: null, theme: null, weekStart: 1 }, // 1=Mon, 6=Sat, 0=Sun
      profile: { degree: '', specialty: '', group: '' },
      academic: { years: [] }, // [{id, semesters:[{id, status}]}]
      subjects: [], // {id, semesterId, name, color, standing?}
      tasks: [], // {id, title, description, date, difficulty, subjectId, done, createdAt}
      notes: [], // {id, title, text, subjectId, images[], pinned, createdAt, updatedAt}
      places: [], // {id, name, desc, lat, lng, color, createdAt}
      teachers: [], // {id, name, subjectId, subjectName, photo, ratings:[{id,stars,comment,at}], createdAt}
      contacts: [], // {id, name, category, org, phones[], emails[], photo, note, createdAt}
      standingLog: [], // {id, subjectId, value 0-100, date 'YYYY-MM-DD', at}
      vault: { pinHash: null, hint: null, entries: [] },
      flags: { onboarded: false },
    };
  }

  /* Simple non-plaintext obfuscation for the 4-digit PIN.
   Honest scope: hides the PIN from casual inspection — it is
   NOT cryptographic protection (a 4-digit code is brute-forceable
   by design; the vault hides data from shoulder-surfers only). */
  /* Secure PIN hashing using Web Crypto API (SHA-256) with per-install salt.
     Honest scope: a 4-digit code is brute-forceable by design; the vault
     hides data from shoulder-surfers only. But we use a proper cryptographic
     hash + salt so the stored value cannot be reversed from a rainbow table
     built for the old DJB2 hash. */
  function saltB64() {
    var s = state && state.vault && state.vault.salt;
    if (!s) {
      var bytes = new Uint8Array(16);
      if (root.crypto && root.crypto.getRandomValues) {
        root.crypto.getRandomValues(bytes);
      } else {
        for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      var bin = '';
      for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
      s = root.btoa(bin);
      if (state && state.vault) state.vault.salt = s;
    }
    return s;
  }

  function sha256Hex(str) {
    if (!(root.crypto && root.crypto.subtle)) {
      // Fallback for non-crypto environments (tests / very old browsers)
      var h = 5381;
      for (var i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
      }
      return Promise.resolve('f' + h.toString(36));
    }
    var bytes = new Uint8Array(str.length);
    for (var k = 0; k < str.length; k++) bytes[k] = str.charCodeAt(k) & 0xff;
    return root.crypto.subtle.digest('SHA-256', bytes).then(function (buf) {
      var arr = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < arr.length; i++) hex += ('0' + arr[i].toString(16)).slice(-2);
      return hex;
    });
  }

  function hashPin(pin) {
    var str = 'SLv5::' + saltB64() + '::' + String(pin);
    return sha256Hex(str).then(function (hex) {
      return 'sha256:' + hex;
    });
  }

  /* ---------- PIN attempt rate limiting ----------
     After 5 wrong attempts the vault locks for a growing window
     (30s, 1m, 2m, 4m... capped at 1h). Persists in the store so
     a reload does not reset the lockout. */
  var MAX_ATTEMPTS = 5;

  function lockState() {
    if (!state.vault.lock || typeof state.vault.lock !== 'object') {
      state.vault.lock = { attempts: 0, until: 0 };
    }
    return state.vault.lock;
  }

  function isLockedOut() {
    var l = lockState();
    return l.attempts >= MAX_ATTEMPTS && Date.now() < l.until;
  }

  function lockoutSeconds() {
    var l = lockState();
    if (l.attempts < MAX_ATTEMPTS || Date.now() >= l.until) return 0;
    return Math.ceil((l.until - Date.now()) / 1000);
  }

  function registerWrongAttempt() {
    var l = lockState();
    l.attempts += 1;
    if (l.attempts >= MAX_ATTEMPTS) {
      var idx = Math.floor(l.attempts / MAX_ATTEMPTS); // 1, 2, 3...
      l.until = Date.now() + Math.min(30 * Math.pow(2, idx - 1), 3600) * 1000;
    }
    save();
  }

  function resetAttempts() {
    state.vault.lock = { attempts: 0, until: 0 };
    save();
  }

  function load() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var d = defaults();
        state = Object.assign(d, parsed);
        state.settings = Object.assign(d.settings, parsed.settings || {});
        if (![0, 1, 6].includes(state.settings.weekStart)) {
          state.settings.weekStart = 1;
        }
        state.profile = Object.assign(d.profile, parsed.profile || {});
        state.academic = parsed.academic && parsed.academic.years ? parsed.academic : d.academic;
        state.flags = Object.assign(d.flags, parsed.flags || {});
        state.subjects = Array.isArray(parsed.subjects) ? parsed.subjects : [];
        state.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        state.notes = Array.isArray(parsed.notes) ? parsed.notes : [];
        state.places = Array.isArray(parsed.places) ? parsed.places : [];
        state.teachers = Array.isArray(parsed.teachers) ? parsed.teachers : [];
        state.contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
        state.standingLog = Array.isArray(parsed.standingLog) ? parsed.standingLog : [];
        state.vault = Object.assign(d.vault, parsed.vault || {});
        if (!Array.isArray(state.vault.entries)) state.vault.entries = [];
        return;
      }
    } catch (e) {
      /* corrupted storage -> start fresh */
    }
    state = defaults();
  }

  var saveNow = function () {
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (SL.ui && SL.ui.toast) SL.ui.toast(SL.i18n.t('toast.storageFull'), 'error');
    }
  };
  var save = u.debounce(saveNow, 180);

  var cloudSyncDebounced = u.debounce(function () {
    if (SL.supabase && SL.supabase.isConnected()) {
      SL.supabase.pushAllUserData().catch(function () {});
    }
  }, 3500);


  function emit() {
    save();
    if (SL.supabase && SL.supabase.ENABLED) cloudSyncDebounced();
    listeners.forEach(function (fn) {
      fn();
    });
  }

  /* ---------- helpers ---------- */

  function findYear(yearId) {
    for (var yi = 0; yi < state.academic.years.length; yi++) {
      var y = state.academic.years[yi];
      if (y.id === yearId) return { year: y, yearIndex: yi };
    }
    return null;
  }

  function findSem(semId) {
    for (var yi = 0; yi < state.academic.years.length; yi++) {
      var y = state.academic.years[yi];
      for (var si = 0; si < y.semesters.length; si++) {
        if (y.semesters[si].id === semId) {
          return { sem: y.semesters[si], year: y, yearIndex: yi, semIndex: si };
        }
      }
    }
    return null;
  }

  function nullifySubjectRefs(subjectId) {
    state.tasks.forEach(function (t) {
      if (t.subjectId === subjectId) t.subjectId = null;
    });
    state.notes.forEach(function (n) {
      if (n.subjectId === subjectId) n.subjectId = null;
    });
  }

  /* Delete IDB blobs for entries that are image ids. Fire & forget. */
  function dropImages(entries) {
    var conn = idb();
    if (!conn) return;
    (entries || []).forEach(function (entry) {
      if (!isLegacyDataUrl(entry)) conn.deleteImage(entry).catch(function () {});
    });
  }

  var store = {
    /* ---------- events ---------- */
    onChange: function (fn) {
      listeners.push(fn);
    },

    get: function () {
      return state;
    },

    saveNow: saveNow,

    /* ---------- one-time image migration (localStorage -> IDB) ---------- */
    migrateImages: function () {
      var conn = idb();
      if (!conn) return Promise.resolve(0);
      var moved = 0;
      var jobs = [];
      state.notes.forEach(function (note) {
        if (!Array.isArray(note.images)) return;
        note.images.forEach(function (entry, idx) {
          if (isLegacyDataUrl(entry)) {
            var id = u.uid();
            jobs.push(
              conn
                .putImage(id, u.dataURLtoBlob(entry))
                .then(function () {
                  note.images[idx] = id;
                  moved++;
                })
                .catch(function () {})
            );
          }
        });
      });
      return Promise.all(jobs).then(function () {
        if (moved) {
          state.v = 4;
          emit();
        }
        return moved;
      });
    },

    /* ---------- settings ---------- */
    setLang: function (code) {
      state.settings.lang = code;
      save();
    },

    setTheme: function (theme) {
      state.settings.theme = theme;
      save();
    },

    setWeekStart: function (day) {
      if ([0, 1, 6].indexOf(day) === -1) return;
      state.settings.weekStart = day;
      emit();
    },

    /* self-assessed standing per subject: 0 = red (hard), 100 = green (confident).
       Every committed change is logged with today's date. */
    setStanding: function (subjectId, value) {
      var s = store.subjectById(subjectId);
      if (!s) return null;
      var v = Math.max(0, Math.min(100, Math.round(Number(value))));
      if (isNaN(v)) return null;
      s.standing = v;
      state.standingLog.push({
        id: u.uid(),
        subjectId: subjectId,
        value: v,
        date: u.todayStr(),
        at: Date.now(),
      });
      emit();
      return v;
    },

    standingHistory: function (subjectId) {
      return state.standingLog
        .filter(function (e) {
          return e.subjectId === subjectId;
        })
        .sort(function (a, b) {
          return (a.at || 0) - (b.at || 0);
        });
    },

    /* mark every unfinished task of a given day as done */
    completeAllOn: function (ymdStr) {
      var changed = 0;
      state.tasks.forEach(function (task) {
        if (task.date === ymdStr && !task.done) {
          task.done = true;
          changed++;
        }
      });
      if (changed) emit();
      return changed;
    },

    /* mark every overdue (past & unfinished) task as done */
    completeAllOverdue: function () {
      var today = u.todayStr();
      var changed = 0;
      state.tasks.forEach(function (task) {
        if (!task.done && task.date < today) {
          task.done = true;
          changed++;
        }
      });
      if (changed) emit();
      return changed;
    },

    /* ---------- vault (passwords page) ---------- */
    vaultHasPin: function () {
      return !!state.vault.pinHash;
    },

    vaultHint: function () {
      return state.vault.hint || '';
    },

    vaultSetup: function (pin, hint) {
      if (!/^\d{4}$/.test(String(pin))) return Promise.resolve({ ok: false, error: 'pin' });
      var h = String(hint || '').trim();
      if (!h) return Promise.resolve({ ok: false, error: 'hint' });
      return hashPin(pin).then(function (hashed) {
        state.vault.pinHash = hashed;
        state.vault.hint = h;
        resetAttempts();
        emit();
        return { ok: true };
      });
    },

    verifyVaultPin: function (pin) {
      if (!state.vault.pinHash) return Promise.resolve(false);
      var stored = String(state.vault.pinHash);
      return hashPin(pin).then(function (hashed) {
        if (hashed === stored) return true;
        /* legacy migration: old DJB2 hash 'h...' — verify then upgrade to sha256 */
        if (stored.indexOf('sha256:') !== 0) {
          var str = 'SLv5::' + String(pin);
          var h = 5381;
          for (var i = 0; i < str.length; i++) {
            h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
          }
          if ('h' + h.toString(36) + ':' + str.length === stored) {
            state.vault.pinHash = hashed; // transparent upgrade
            save();
            return true;
          }
        }
        return false;
      });
    },

    changeVaultPin: function (hint, newPin) {
      if (String(hint || '').trim() !== state.vault.hint) return Promise.resolve({ ok: false, error: 'hint' });
      if (!/^\d{4}$/.test(String(newPin))) return Promise.resolve({ ok: false, error: 'pin' });
      return hashPin(newPin).then(function (hashed) {
        state.vault.pinHash = hashed;
        emit();
        return { ok: true };
      });
    },

    /* PIN rate limiting (exposed for the vault page) */
    vaultIsLockedOut: function () {
      return isLockedOut();
    },

    vaultLockoutSeconds: function () {
      return lockoutSeconds();
    },

    vaultFailAttempt: function () {
      registerWrongAttempt();
    },

    resetVaultLock: function () {
      resetAttempts();
    },

    addVaultEntry: function (data) {
      var e = {
        id: u.uid(),
        title: String(data.title || '').trim(),
        username: String(data.username || '').trim(),
        url: String(data.url || '').trim(),
        password: String(data.password || ''),
        description: String(data.description || '').trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.vault.entries.push(e);
      emit();
      return e;
    },

    updateVaultEntry: function (id, patch) {
      for (var i = 0; i < state.vault.entries.length; i++) {
        if (state.vault.entries[i].id === id) {
          Object.assign(state.vault.entries[i], patch, { updatedAt: Date.now() });
          emit();
          return state.vault.entries[i];
        }
      }
      return null;
    },

    deleteVaultEntry: function (id) {
      state.vault.entries = state.vault.entries.filter(function (e) {
        return e.id !== id;
      });
      emit();
    },

    setOnboarded: function () {
      state.flags.onboarded = true;
      emit();
    },

    /* ---------- profile ---------- */
    setProfile: function (patch) {
      Object.assign(state.profile, patch);
      emit();
    },

    /* ---------- academic structure ---------- */
    hasStructure: function () {
      return state.academic.years.length > 0;
    },

    currentSemester: function () {
      var found = findSem(
        (function () {
          for (var yi = 0; yi < state.academic.years.length; yi++) {
            var sems = state.academic.years[yi].semesters;
            for (var si = 0; si < sems.length; si++) {
              if (sems[si].status === 'current') return sems[si].id;
            }
          }
          return null;
        })()
      );
      return found;
    },

    createStructure: function (yearsCount, semsPerYear) {
      var years = [];
      for (var y = 0; y < yearsCount; y++) {
        var sems = [];
        for (var s = 0; s < semsPerYear; s++) {
          sems.push({ id: u.uid(), status: 'future' });
        }
        years.push({ id: u.uid(), semesters: sems });
      }
      state.academic.years = years;
      if (years.length && years[0].semesters.length) {
        years[0].semesters[0].status = 'current';
      }
      emit();
    },

    addYear: function () {
      var last = state.academic.years[state.academic.years.length - 1];
      var count = last ? last.semesters.length : 2;
      var sems = [];
      for (var s = 0; s < count; s++) sems.push({ id: u.uid(), status: 'future' });
      state.academic.years.push({ id: u.uid(), semesters: sems });
      emit();
    },

    removeYear: function (yearId) {
      var found = findYear(yearId);
      if (!found) return;
      found.year.semesters.forEach(function (sem) {
        state.subjects
          .filter(function (s) {
            return s.semesterId === sem.id;
          })
          .forEach(function (s) {
            nullifySubjectRefs(s.id);
          });
        state.subjects = state.subjects.filter(function (s) {
          return s.semesterId !== sem.id;
        });
      });
      state.academic.years = state.academic.years.filter(function (y) {
        return y.id !== yearId;
      });
      emit();
    },

    addSemester: function (yearId) {
      var found = findYear(yearId);
      if (!found) return;
      found.year.semesters.push({ id: u.uid(), status: 'future' });
      emit();
    },

    removeSemester: function (semId) {
      var found = findSem(semId);
      if (!found) return;
      state.subjects
        .filter(function (s) {
          return s.semesterId === semId;
        })
        .forEach(function (s) {
          nullifySubjectRefs(s.id);
        });
      state.subjects = state.subjects.filter(function (s) {
        return s.semesterId !== semId;
      });
      found.year.semesters = found.year.semesters.filter(function (s) {
        return s.id !== semId;
      });
      emit();
    },

    setSemesterStatus: function (semId, status) {
      var found = findSem(semId);
      if (!found) return;
      if (status === 'current') {
        state.academic.years.forEach(function (y) {
          y.semesters.forEach(function (s) {
            if (s.status === 'current') s.status = 'done';
          });
        });
      }
      found.sem.status = status;
      emit();
    },

    /* ---------- places ---------- */
    places: function() {
      return state.places.slice().sort(function(a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },

    addPlace: function(p) {
      p.id = u.uid();
      p.createdAt = Date.now();
      state.places.push(p);
      emit();
      return p.id;
    },

    updatePlace: function(id, updates) {
      var p = state.places.filter(function(x) { return x.id === id; })[0];
      if (p) {
        Object.assign(p, updates);
        emit();
      }
    },

    deletePlace: function(id) {
      state.places = state.places.filter(function(x) { return x.id !== id; });
      emit();
    },

    /* ---------- teachers ----------
       Flat JSON by design: when the cloud backend (Supabase) lands,
       this array maps 1:1 onto a `teachers` table and each entry's
       `ratings` array onto a `teacher_ratings` child table. Photos
       follow the notes convention: image id (IndexedDB) or legacy
       dataURL fallback — replace with storage buckets in the cloud. */
    teachers: function () {
      return state.teachers.slice().sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },

    teacherById: function (id) {
      return state.teachers.filter(function (x) { return x.id === id; })[0] || null;
    },

    addTeacher: function (data) {
      var t = {
        id: u.uid(),
        name: String(data.name || '').trim(),
        subjectId: data.subjectId || null,
        subjectName: String(data.subjectName || '').trim(),
        photo: data.photo || null,
        ratings: [],
        createdAt: Date.now(),
      };
      state.teachers.push(t);
      emit();
      return t;
    },

    updateTeacher: function (id, updates) {
      var t = store.teacherById(id);
      if (!t) return;
      if (updates.photo !== undefined && updates.photo !== t.photo) {
        dropImages([t.photo]); // free the replaced avatar blob
      }
      ['name', 'subjectId', 'subjectName', 'photo'].forEach(function (k) {
        if (updates[k] !== undefined) t[k] = updates[k];
      });
      t.name = String(t.name).trim();
      t.subjectName = String(t.subjectName || '').trim();
      emit();
    },

    deleteTeacher: function (id) {
      var t = store.teacherById(id);
      if (!t) return;
      dropImages([t.photo]);
      state.teachers = state.teachers.filter(function (x) { return x.id !== id; });
      /* subjects that pointed at this teacher go back to "no teacher" */
      state.subjects.forEach(function (s) {
        if (s.teacherId === id) s.teacherId = null;
      });
      emit();
    },

    rateTeacher: function (teacherId, stars, comment) {
      var t = store.teacherById(teacherId);
      if (!t) return null;
      var s = Math.round(Number(stars));
      if (!(s >= 1 && s <= 5)) return null;
      var r = {
        id: u.uid(),
        stars: s,
        comment: String(comment || '').trim(),
        at: Date.now(),
      };
      t.ratings.push(r);
      emit();
      return r;
    },

    deleteRating: function (teacherId, ratingId) {
      var t = store.teacherById(teacherId);
      if (!t) return;
      t.ratings = t.ratings.filter(function (x) { return x.id !== ratingId; });
      emit();
    },

    /* average + count for a teacher: {avg: 0..5 (1 decimal), count} */
    teacherRating: function (t) {
      var n = (t && Array.isArray(t.ratings) && t.ratings.length) || 0;
      if (!n) return { avg: 0, count: 0 };
      var sum = 0;
      t.ratings.forEach(function (r) { sum += r.stars; });
      return { avg: Math.round((sum / n) * 10) / 10, count: n };
    },

    /* subjects currently assigned to a teacher (subject.teacherId) */
    subjectsOfTeacher: function (teacherId) {
      return state.subjects.filter(function (s) { return s.teacherId === teacherId; });
    },

    /* ---------- contacts ----------
       Flat JSON by design: when the cloud backend (Supabase) lands,
       this array maps 1:1 onto a `contacts` table tied to the future
       Google account via user_id. Photos follow the notes convention:
       image id (IndexedDB) or legacy dataURL fallback. */
    contacts: function () {
      return state.contacts.slice().sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },

    contactById: function (id) {
      return state.contacts.filter(function (x) { return x.id === id; })[0] || null;
    },

    addContact: function (data) {
      var c = {
        id: u.uid(),
        name: String(data.name || '').trim(),
        category: data.category || 'other',
        org: String(data.org || '').trim(),
        phones: (Array.isArray(data.phones) ? data.phones : [])
          .map(function (x) { return String(x).trim(); })
          .filter(Boolean),
        emails: (Array.isArray(data.emails) ? data.emails : [])
          .map(function (x) { return String(x).trim(); })
          .filter(Boolean),
        photo: data.photo || null,
        note: String(data.note || '').trim(),
        createdAt: Date.now(),
      };
      state.contacts.push(c);
      emit();
      return c;
    },

    updateContact: function (id, updates) {
      var c = store.contactById(id);
      if (!c) return;
      if (updates.photo !== undefined && updates.photo !== c.photo) {
        dropImages([c.photo]); // free the replaced avatar blob
      }
      ['name', 'org', 'note'].forEach(function (k) {
        if (updates[k] !== undefined) c[k] = String(updates[k]).trim();
      });
      if (updates.category !== undefined) c.category = updates.category;
      if (updates.photo !== undefined) c.photo = updates.photo;
      if (Array.isArray(updates.phones)) {
        c.phones = updates.phones.map(function (x) { return String(x).trim(); }).filter(Boolean);
      }
      if (Array.isArray(updates.emails)) {
        c.emails = updates.emails.map(function (x) { return String(x).trim(); }).filter(Boolean);
      }
      emit();
    },

    deleteContact: function (id) {
      var c = store.contactById(id);
      if (!c) return;
      dropImages([c.photo]);
      state.contacts = state.contacts.filter(function (x) { return x.id !== id; });
      emit();
    },

    /* ---------- subjects ---------- */
    subjectsOf: function (semId) {
      return state.subjects.filter(function (s) {
        return s.semesterId === semId;
      });
    },

    subjectById: function (id) {
      for (var i = 0; i < state.subjects.length; i++) {
        if (state.subjects[i].id === id) return state.subjects[i];
      }
      return null;
    },

    addSubject: function (semId, name, color) {
      var s = { id: u.uid(), semesterId: semId, name: String(name).trim(), color: color };
      state.subjects.push(s);
      emit();
      return s;
    },

    updateSubject: function (id, patch) {
      var s = store.subjectById(id);
      if (!s) return;
      if (patch.name != null) s.name = String(patch.name).trim();
      if (patch.color != null) s.color = patch.color;
      if (patch.semesterId != null) s.semesterId = patch.semesterId;
      if (patch.teacherId !== undefined) s.teacherId = patch.teacherId || null;
      emit();
    },

    deleteSubject: function (id) {
      nullifySubjectRefs(id);
      state.subjects = state.subjects.filter(function (s) {
        return s.id !== id;
      });
      emit();
    },

    currentSemesterSubjects: function () {
      var cur = store.currentSemester();
      return cur ? store.subjectsOf(cur.sem.id) : [];
    },

    /* ---------- tasks ---------- */
    addTask: function (data) {
      var t = {
        id: u.uid(),
        title: String(data.title).trim(),
        description: String(data.description || '').trim(),
        date: data.date,
        difficulty: data.difficulty || 'light',
        subjectId: data.subjectId || null,
        done: !!data.done,
        progressEnabled: !!data.progressEnabled,
        progress: Math.max(0, Math.min(100, Math.round(Number(data.progress) || 0))),
        createdAt: Date.now(),
      };
      if (t.progressEnabled && t.progress >= 100) t.done = true;
      state.tasks.push(t);
      emit();
      return t;
    },

    updateTask: function (id, patch) {
      for (var i = 0; i < state.tasks.length; i++) {
        if (state.tasks[i].id === id) {
          Object.assign(state.tasks[i], patch);
          emit();
          return state.tasks[i];
        }
      }
      return null;
    },

    toggleTask: function (id) {
      var t = state.tasks.filter(function (x) {
        return x.id === id;
      })[0];
      if (t) {
        t.done = !t.done;
        if (t.done && t.progressEnabled) t.progress = 100; // completing fills the bar
        emit();
      }
    },

    /* drag the progress slider: at 100 the task auto-completes */
    setTaskProgress: function (id, value) {
      var tsk = state.tasks.filter(function (x) {
        return x.id === id;
      })[0];
      if (!tsk) return null;
      var v = Math.max(0, Math.min(100, Math.round(Number(value))));
      if (isNaN(v)) return null;
      tsk.progress = v;
      if (v >= 100 && tsk.progressEnabled) tsk.done = true;
      else if (v < 100 && tsk.done && tsk.progressEnabled) tsk.done = false; // dragging back re-opens it
      emit();
      return v;
    },

    deleteTask: function (id) {
      state.tasks = state.tasks.filter(function (t) {
        return t.id !== id;
      });
      emit();
    },

    tasksOn: function (ymdStr) {
      return state.tasks.filter(function (t) {
        return t.date === ymdStr;
      });
    },

    tasksByDay: function () {
      var map = {};
      state.tasks.forEach(function (t) {
        (map[t.date] = map[t.date] || []).push(t);
      });
      return map;
    },

    /* ---------- notes ---------- */
    addNote: function (data) {
      var n = {
        id: u.uid(),
        title: String(data.title || '').trim(),
        text: String(data.text || ''),
        subjectId: data.subjectId || null,
        images: Array.isArray(data.images) ? data.images : [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      state.notes.unshift(n);
      emit();
      return n;
    },

    updateNote: function (id, patch) {
      for (var i = 0; i < state.notes.length; i++) {
        if (state.notes[i].id === id) {
          Object.assign(state.notes[i], patch, { updatedAt: Date.now() });
          emit();
          return state.notes[i];
        }
      }
      return null;
    },

    toggleNotePin: function (id) {
      var n = state.notes.filter(function (x) {
        return x.id === id;
      })[0];
      if (n) {
        n.pinned = !n.pinned;
        emit();
      }
    },

    deleteNote: function (id) {
      var note = state.notes.filter(function (n) {
        return n.id === id;
      })[0];
      if (note) dropImages(note.images);
      state.notes = state.notes.filter(function (n) {
        return n.id !== id;
      });
      emit();
    },

    /* ---------- backup (async: includes IDB images) ---------- */
    exportJSON: function () {
      var conn = idb();
      var snapshot = JSON.parse(JSON.stringify(state));
      /* security: the password vault is deliberately excluded from
         backups — passwords never leave the device in plaintext */
      delete snapshot.vault;
      if (!conn) return Promise.resolve(JSON.stringify(snapshot, null, 2));
      var jobs = [];
      snapshot.notes.forEach(function (note) {
        (note.images || []).forEach(function (entry, idx) {
          if (!isLegacyDataUrl(entry)) {
            jobs.push(
              conn
                .getImage(entry)
                .then(function (blob) {
                  if (blob) return u.blobToDataURL(blob);
                  return null;
                })
                .then(function (dataUrl) {
                  if (dataUrl) note.images[idx] = dataUrl;
                })
                .catch(function () {})
            );
          }
        });
      });
      return Promise.all(jobs).then(function () {
        return JSON.stringify(snapshot, null, 2);
      });
    },

    importJSON: function (text) {
      try {
        var parsed = JSON.parse(text);
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !Array.isArray(parsed.tasks) ||
          !Array.isArray(parsed.notes) ||
          !Array.isArray(parsed.subjects)
        ) {
          return Promise.resolve({ ok: false });
        }
        /* defensive: strip prototype-pollution keys from untrusted input */
        (function strip(o) {
          if (Array.isArray(o)) {
            o.forEach(strip);
            return;
          }
          if (o && typeof o === 'object') {
            ['__proto__', 'constructor', 'prototype'].forEach(function (k) {
              try {
                delete o[k];
              } catch (e) {}
            });
            Object.keys(o).forEach(function (k) {
              strip(o[k]);
            });
          }
        })(parsed);
        var conn = idb();
        var prepare = conn
          ? conn.clearImages().then(function () {
              var jobs = [];
              parsed.notes.forEach(function (note) {
                (note.images || []).forEach(function (entry, idx) {
                  if (isLegacyDataUrl(entry)) {
                    var id = u.uid();
                    jobs.push(
                      conn
                        .putImage(id, u.dataURLtoBlob(entry))
                        .then(function () {
                          note.images[idx] = id;
                        })
                        .catch(function () {})
                    );
                  }
                });
              });
              return Promise.all(jobs);
            })
          : Promise.resolve();
        return prepare.then(function () {
          var d = defaults();
          var keepVault = state.vault; // importing a backup never touches the vault
          state = Object.assign(d, parsed);
          state.settings = Object.assign(d.settings, parsed.settings || {});
          if (state.settings.weekStart == null) state.settings.weekStart = 1;
          state.profile = Object.assign(d.profile, parsed.profile || {});
          state.academic =
            parsed.academic && Array.isArray(parsed.academic.years)
              ? parsed.academic
              : { years: [] };
          state.flags = Object.assign(d.flags, parsed.flags || {});
          state.vault = keepVault;
          state.v = 5;
          emit();
          return {
            ok: true,
            tasks: state.tasks.length,
            notes: state.notes.length,
            subjects: state.subjects.length,
          };
        });
      } catch (e) {
        return Promise.resolve({ ok: false });
      }
    },

    resetAll: function () {
      var conn = idb();
      if (conn) conn.clearImages().catch(function () {});
      state = defaults();
      state.flags.onboarded = true;
      emit();
    },

    /* test hooks */
    _load: load,
    _findSem: findSem,
    _findYear: findYear,
  };

  load();
  SL.store = store;
})(typeof window !== 'undefined' ? window : globalThis);
