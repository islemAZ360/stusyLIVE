/* ============================================================
   Study Live — supabase.js
   Cloud sync + Google authentication via Supabase (ESM).
   ============================================================ */
import { createClient } from '@supabase/supabase-js';

(function (root) {
  'use strict';

  var SL = (root.SL = root.SL || {});

  var SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
  var SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  var ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  var client = null;
  var currentUser = null;
  var authListeners = [];
  var lastSyncedHash = {}; // Smart sync delta tracking


  function ensure() {
    if (!ENABLED) return null;
    if (client) return client;
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    client.auth.onAuthStateChange(function (event, session) {
      currentUser = session ? session.user : null;
      authListeners.forEach(function (fn) {
        try { fn(event, currentUser); } catch (e) {}
      });
    });
    return client;
  }

  function getUser() { return currentUser; }
  function isConnected() { return !!currentUser; }

  function onAuthChange(fn) { authListeners.push(fn); }

  function getSession() {
    var c = ensure();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (res) {
      if (res.data && res.data.session) currentUser = res.data.session.user;
      return res.data.session;
    });
  }

  function signInWithGoogle() {
    var c = ensure();
    if (!c) return Promise.reject(new Error('Supabase not configured'));
    var redirectTo = root.location ? root.location.origin : undefined;
    return c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo },
    });
  }

  function signOut() {
    var c = ensure();
    if (!c) return Promise.resolve();
    return c.auth.signOut();
  }

  function deleteUser() {
    var c = ensure();
    if (!c || !currentUser) return Promise.reject(new Error('Not authenticated'));
    var uid = currentUser.id;
    // Delete all user data from tables (RLS ensures only own data is deleted)
    var tables = ['notes', 'tasks', 'subjects', 'teachers', 'contacts', 'places', 'profiles', 'academic_structures', 'standing_logs', 'vault_entries', 'app_settings'];
    var jobs = tables.map(function (table) {
      return c.from(table).delete().eq('user_id', uid).then(function () {
        return { table: table, ok: true };
      }).catch(function () {
        return { table: table, ok: false };
      });
    });
    return Promise.all(jobs).then(function () {
      return c.auth.signOut();
    });
  }

  function nowISO() { return new Date().toISOString(); }

  // Smart request queue: prevents rate limiting by serializing requests
  var requestQueue = [];
  var activeRequests = 0;
  var MAX_CONCURRENT = 3;
  var MIN_INTERVAL_MS = 150;
  var lastRequestTime = 0;

  function enqueueRequest(fn) {
    return new Promise(function (resolve, reject) {
      requestQueue.push({ fn: fn, resolve: resolve, reject: reject });
      processQueue();
    });
  }

  function processQueue() {
    if (activeRequests >= MAX_CONCURRENT) return;
    if (requestQueue.length === 0) return;
    var now = Date.now();
    var wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
    if (wait > 0 && activeRequests > 0) {
      setTimeout(processQueue, wait);
      return;
    }
    var item = requestQueue.shift();
    lastRequestTime = Date.now();
    activeRequests++;
    Promise.resolve()
      .then(item.fn)
      .then(item.resolve)
      .catch(item.reject)
      .finally(function () {
        activeRequests--;
        processQueue();
      });
  }

  // Field mapping for ALL tables (local → DB)
  var FIELD_MAP = {
    subjects: { semesterLabel: 'semester_label', teacherName: 'teacher_name' },
    tasks: { subjectId: 'subject_id' },
    notes: { text: 'body', subjectId: 'subject_id' },
    teachers: { subjectName: 'subject_name' },
    contacts: {},
    places: {},
    profiles: {},
    academic_structures: {},
    standing_logs: { subjectId: 'subject_id' },
    vault_entries: {},
    app_settings: {},
  };

  var REV_MAP = {};
  Object.keys(FIELD_MAP).forEach(function (table) {
    REV_MAP[table] = {};
    Object.keys(FIELD_MAP[table]).forEach(function (k) {
      REV_MAP[table][FIELD_MAP[table][k]] = k;
    });
  });

  function mapRow(table, item, direction) {
    var map = direction === 'toDb' ? (FIELD_MAP[table] || {}) : (REV_MAP[table] || {});
    var row = Object.assign({}, item);
    Object.keys(map).forEach(function (fromKey) {
      var toKey = map[fromKey];
      if (row[fromKey] !== undefined) {
        row[toKey] = row[fromKey];
        delete row[fromKey];
      }
    });
    return row;
  }

  function pushTable(table) {
    var c = ensure();
    if (!c || !currentUser) return Promise.resolve({ skipped: true });
    var local = SL.store.get()[table];
    var currentHash = JSON.stringify(local || []);
    
    // Skip if nothing changed since last successful sync
    if (lastSyncedHash[table] === currentHash) {
      return Promise.resolve({ count: (local || []).length, skipped: true });
    }

    if (!Array.isArray(local) || !local.length) {
      return enqueueRequest(function () {
        return c.from(table).delete().eq('user_id', currentUser.id);
      }).then(function (res) {
        if (!res.error) lastSyncedHash[table] = currentHash;
        return { count: 0 };
      });
    }

    var rows = local.map(function (item) {
      var row = mapRow(table, item, 'toDb');
      row.user_id = currentUser.id;
      if (!row.created_at) row.created_at = nowISO();
      return row;
    });

    var localIds = rows.map(function(r) { return r.id; });

    return enqueueRequest(function () {
      // 1. Upsert local items
      return c.from(table).upsert(rows, { onConflict: 'id' }).then(function (upsertRes) {
        if (upsertRes.error) throw upsertRes.error;
        // 2. Delete items in cloud that no longer exist locally
        return c.from(table).delete().eq('user_id', currentUser.id).not('id', 'in', '(' + localIds.join(',') + ')');
      });
    }).then(function () {
      lastSyncedHash[table] = currentHash;
      return { count: rows.length };
    }).catch(function (error) {
      console.warn('[supabase] push "' + table + '" failed:', error.message || error);
      return { error: error };
    });
  }

  function pullTable(table) {
    var c = ensure();
    if (!c || !currentUser) return Promise.resolve([]);
    return enqueueRequest(function () {
      return c.from(table).select('*').eq('user_id', currentUser.id);
    }).then(function (res) {
      if (res.error) {
        console.warn('[supabase] pull "' + table + '" failed:', res.error.message);
        return [];
      }
      return (res.data || []).map(function (row) {
        var clean = Object.assign({}, row);
        delete clean.user_id;
        return mapRow(table, clean, 'fromDb');
      });
    });
  }

  // Push ALL user data (profile, academic, standing log, vault, settings)
  function pushAllUserData() {
    var c = ensure();
    if (!c || !currentUser) return Promise.resolve({ skipped: true });
    var st = SL.store.get();
    var jobs = [];

    // Profile
    var profileHash = JSON.stringify(st.profile || {});
    if (lastSyncedHash['profiles'] !== profileHash) {
      var profileRow = Object.assign({}, st.profile, {
        user_id: currentUser.id,
        email: currentUser.email,
        updated_at: nowISO(),
      });
      jobs.push(enqueueRequest(function () {
        return c.from('profiles').upsert(profileRow, { onConflict: 'user_id' }).then(function(r){ 
          if(!r.error) lastSyncedHash['profiles'] = profileHash; 
        });
      }));
    }

    // Academic structure
    var academicHash = JSON.stringify(st.academic || {});
    if (lastSyncedHash['academic_structures'] !== academicHash) {
      var academicRow = { user_id: currentUser.id, data: st.academic, updated_at: nowISO() };
      jobs.push(enqueueRequest(function () {
        return c.from('academic_structures').upsert(academicRow, { onConflict: 'user_id' }).then(function(r){ 
          if(!r.error) lastSyncedHash['academic_structures'] = academicHash; 
        });
      }));
    }

    // Standing log
    var standingHash = JSON.stringify(st.standingLog || []);
    if (lastSyncedHash['standing_logs'] !== standingHash) {
      if (st.standingLog.length) {
        var standingRows = st.standingLog.map(function (e) {
          var row = mapRow('standing_logs', e, 'toDb');
          row.user_id = currentUser.id;
          return row;
        });
        var sIds = standingRows.map(function(r){ return r.id; });
        jobs.push(enqueueRequest(function () {
          return c.from('standing_logs').upsert(standingRows, { onConflict: 'id' }).then(function(r){
            if (r.error) throw r.error;
            return c.from('standing_logs').delete().eq('user_id', currentUser.id).not('id', 'in', '(' + sIds.join(',') + ')');
          }).then(function(){ lastSyncedHash['standing_logs'] = standingHash; });
        }));
      } else {
        jobs.push(enqueueRequest(function () {
          return c.from('standing_logs').delete().eq('user_id', currentUser.id).then(function(r){ 
            if(!r.error) lastSyncedHash['standing_logs'] = standingHash; 
          });
        }));
      }
    }

    // Vault entries
    var vaultHash = JSON.stringify(st.vault.entries || []);
    if (lastSyncedHash['vault_entries'] !== vaultHash) {
      if (st.vault.entries.length) {
        var vaultRows = st.vault.entries.map(function (e) {
          return Object.assign({}, e, { user_id: currentUser.id });
        });
        var vIds = vaultRows.map(function(r){ return r.id; });
        jobs.push(enqueueRequest(function () {
          return c.from('vault_entries').upsert(vaultRows, { onConflict: 'id' }).then(function(r){
            if (r.error) throw r.error;
            return c.from('vault_entries').delete().eq('user_id', currentUser.id).not('id', 'in', '(' + vIds.join(',') + ')');
          }).then(function(){ lastSyncedHash['vault_entries'] = vaultHash; });
        }));
      } else {
        jobs.push(enqueueRequest(function () {
          return c.from('vault_entries').delete().eq('user_id', currentUser.id).then(function(r){ 
            if(!r.error) lastSyncedHash['vault_entries'] = vaultHash; 
          });
        }));
      }
    }

    // App settings
    var settingsHash = JSON.stringify(st.settings || {});
    if (lastSyncedHash['app_settings'] !== settingsHash) {
      var settingsRow = { user_id: currentUser.id, data: st.settings, updated_at: nowISO() };
      jobs.push(enqueueRequest(function () {
        return c.from('app_settings').upsert(settingsRow, { onConflict: 'user_id' }).then(function(r){ 
          if(!r.error) lastSyncedHash['app_settings'] = settingsHash; 
        });
      }));
    }

    if (jobs.length === 0) return Promise.resolve({ ok: true, skipped: true });

    return Promise.all(jobs).then(function (results) {
      return { ok: true, results: results };
    });
  }

  function syncToCloud() {
    var c = ensure();
    if (!c || !currentUser) return Promise.resolve({ skipped: true });
    var tables = ['subjects', 'tasks', 'notes', 'teachers', 'contacts', 'places'];
    var jobs = tables.map(pushTable);
    jobs.push(pushAllUserData());
    return Promise.all(jobs).then(function (results) {
      return { ok: true, results: results };
    });
  }

  function syncFromCloud() {
    var c = ensure();
    if (!c || !currentUser) return Promise.resolve({ skipped: true });
    var tables = ['subjects', 'tasks', 'notes', 'teachers', 'contacts', 'places'];
    var pulls = tables.map(function (t) {
      return pullTable(t).then(function (rows) { return { table: t, rows: rows }; });
    });
    return Promise.all(pulls).then(function (results) {
      var st = SL.store.get();
      results.forEach(function (r) {
        var table = r.table;
        var cloudRows = r.rows;
        if (!cloudRows.length) return;
        var local = st[table];
        if (!Array.isArray(local)) return;
        cloudRows.forEach(function (crow) {
          var idx = local.findIndex(function (l) { return l.id === crow.id; });
          if (idx >= 0) { local[idx] = crow; } else { local.push(crow); }
        });
      });
      SL.store.saveNow();
      return { ok: true, tables: results.map(function (r) { return r.table + ':' + r.rows.length; }) };
    });
  }

  function init() {
    if (!ENABLED) return Promise.resolve({ disabled: true });
    var c = ensure();
    if (!c) return Promise.resolve({ disabled: true });
    return getSession().then(function (session) {
      if (!session) return { connected: false };
      return syncFromCloud().then(function () {
        return { connected: true, user: session.user };
      });
    });
  }

  SL.supabase = {
    ENABLED: ENABLED,
    isConnected: isConnected,
    getUser: getUser,
    getSession: getSession,
    onAuthChange: onAuthChange,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    deleteUser: deleteUser,
    pushTable: pushTable,
    pullTable: pullTable,
    syncToCloud: syncToCloud,
    syncFromCloud: syncFromCloud,
    pushAllUserData: pushAllUserData,
    init: init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (SL.store && SL.supabase.ENABLED) SL.supabase.init();
    });
  } else if (SL.store && SL.supabase.ENABLED) {
    SL.supabase.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
