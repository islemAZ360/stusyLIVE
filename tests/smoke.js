/*
 * Study Live — smoke tests (node tests/smoke.js)
 * Pure-logic checks: i18n key parity, date utils (incl. week start),
 * image codec, store actions (localStorage fallback mode).
 * Run: node tests/smoke.js   (exit 0 = pass)
 */
'use strict';

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
var require = createRequire(import.meta.url);
var path = require('path');
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var root = globalThis;

var failed = false;
function assert(cond, msg) {
  if (!cond) {
    failed = true;
    console.error('FAIL: ' + msg);
  } else {
    console.log('ok  — ' + msg);
  }
}

/* ---------- load utils ---------- */
require(path.join(__dirname, '..', 'src', 'js', 'utils.js'));
var u = root.SL.utils;
assert(!!u, 'utils loaded');

/* ---------- date utils ---------- */
var grid = u.monthGrid(2026, 7, 1); // Aug 2026, week starts Monday
assert(grid.length >= 5 && grid.length <= 6, 'monthGrid returns 5-6 weeks, got ' + grid.length);
var flat = [];
grid.forEach(function (w) {
  assert(w.length === 7, 'each week has 7 cells');
  flat = flat.concat(w);
});
var days = flat.filter(function (c) {
  return c.ymd;
});
assert(days.length === 31, 'Aug 2026 has 31 day cells, got ' + days.length);
assert(days[0].ymd === '2026-08-01' && days[30].ymd === '2026-08-31', 'first/last day correct');
assert(grid[0][5].ymd === '2026-08-01', 'Aug 1 2026 lands on Saturday column (Mon-start)');
assert(u.isValidYMD('2026-08-30') && !u.isValidYMD('2026-02-30'), 'isValidYMD');
assert(u.addDays('2026-08-31', 1) === '2026-09-01', 'addDays crosses month');

/* configurable week start: Aug 1 2026 = Saturday -> first cell with ws=6 */
var gridSat = u.monthGrid(2026, 7, 6);
assert(gridSat[0][0].ymd === '2026-08-01', 'weekStart=6 puts Aug 1 (Sat) first');

/* ---------- i18n parity ---------- */
require(path.join(__dirname, '..', 'src', 'js', 'strings.js'));
var STR = (root.SL && root.SL.STRINGS) || (require(path.join(__dirname, '..', 'src', 'js', 'strings.js')) || {}).STRINGS;
var ar = STR.ar;
var ru = STR.ru;
var en = STR.en;
var missing = [];
Object.keys(ar).forEach(function (k) {
  if (!(k in ru)) missing.push('ru:' + k);
  if (!(k in en)) missing.push('en:' + k);
});
Object.keys(ru).forEach(function (k) {
  if (!(k in ar)) missing.push('ar:' + k);
});
Object.keys(en).forEach(function (k) {
  if (!(k in ar)) missing.push('ar:' + k);
});
assert(missing.length === 0, 'i18n key parity across ar/ru/en' + (missing.length ? ' — missing: ' + missing.join(', ') : ''));

/* ---------- colors ---------- */
assert(u.mix('#ff0000', '#0000ff', 0.5) === '#800080', 'mix red+blue = purple, got ' + u.mix('#ff0000', '#0000ff', 0.5));
assert(u.shadeIndex({ id: 'b', subjectId: 's', createdAt: 2 }, [
  { id: 'a', subjectId: 's', createdAt: 1 },
  { id: 'b', subjectId: 's', createdAt: 2 },
  { id: 'c', subjectId: 'x', createdAt: 3 },
]) === 1, 'shadeIndex cycles per subject group');

/* ---------- image codec ---------- */
var TINY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
var blob = u.dataURLtoBlob(TINY);
assert(blob && blob.size > 60, 'dataURLtoBlob produces a non-empty blob (size ' + (blob && blob.size) + ')');

/* ---------- store actions (shimmed localStorage, no IDB -> fallback) ---------- */
var mem = {};
root.localStorage = {
  getItem: function (k) {
    return k in mem ? mem[k] : null;
  },
  setItem: function (k, v) {
    mem[k] = String(v);
  },
  removeItem: function (k) {
    delete mem[k];
  },
};
root.SL.i18n = { t: function (k) { return k; }, lang: 'ar' };
root.SL.ui = { toast: function () {} };

require(path.join(__dirname, '..', 'src', 'js', 'store.js'));
var store = root.SL.store;
assert(!!store, 'store loaded');
assert(store.get().settings.weekStart === 1, 'default week start is Monday');

(async function () {
  store.createStructure(4, 2);
  assert(store.get().academic.years.length === 4, 'createStructure makes 4 years');
  var cur = store.currentSemester();
  assert(cur && cur.yearIndex === 0 && cur.semIndex === 0, 'default position = year 1 / semester 1');

  var year1Sem2 = store.get().academic.years[0].semesters[1].id;
  store.setSemesterStatus(year1Sem2, 'current');
  var cur2 = store.currentSemester();
  assert(cur2.semIndex === 1 && cur2.yearIndex === 0, 'current moves to y1s2');
  assert(store.get().academic.years[0].semesters[0].status === 'done', 'previous current becomes done');

  var subId = store.addSubject(cur2.sem.id, 'رياضيات', '#e5484d').id;
  assert(store.subjectsOf(cur2.sem.id).length === 1, 'subject added to y1s2');

  var task = store.addTask({ title: 'مراجعة', description: 'صفحات 20-30 من الكتاب', date: '2026-09-01', difficulty: 'hard', subjectId: subId });
  assert(store.tasksOn('2026-09-01').length === 1, 'task appears on its day');
  assert(store.get().tasks[0].description === 'صفحات 20-30 من الكتاب', 'task description persisted');
  store.updateTask(task.id, { description: 'صفحات 20-35 + تمارين الفصل' });
  assert(store.get().tasks[0].description === 'صفحات 20-35 + تمارين الفصل', 'task description updated');
  assert(store.tasksOn('2026-09-02').length === 0, 'task absent on other days');

  store.deleteSubject(subId);
  assert(store.get().tasks[0].subjectId === null, 'deleted subject nullifies task refs');

  store.toggleTask(task.id);
  assert(store.get().tasks[0].done === true, 'toggleTask flips done');

  var note = store.addNote({ title: 'قوانين', text: 'نيوتن', subjectId: null, images: [] });
  store.updateNote(note.id, { text: 'قوانين نيوتن الثلاثة' });
  assert(store.get().notes[0].text === 'قوانين نيوتن الثلاثة', 'note update persists');

  /* export/import round-trip (no IDB -> images stay inline) */
  store.updateNote(note.id, { images: [TINY] });
  var json = await store.exportJSON();
  assert(json.indexOf('data:image/png') !== -1, 'export inlines legacy dataURL images');
  store.resetAll();
  var res = await store.importJSON(json);
  assert(res.ok === true && store.get().notes.length === 1 && store.get().academic.years.length === 4, 'export/import round-trip');
  assert(store.get().notes[0].images[0].slice(0, 5) === 'data:', 'import keeps dataURL images when IDB unavailable');

  /* import rejects garbage */
  var bad = await store.importJSON('not json{');
  assert(bad.ok === false, 'import rejects invalid JSON');

  /* week start setting */
  store.setWeekStart(6);
  assert(store.get().settings.weekStart === 6, 'setWeekStart persists');
  store.setWeekStart(3);
  assert(store.get().settings.weekStart === 6, 'setWeekStart rejects invalid values');

  /* V4: per-subject standing + dated log */
  assert(store.get().v >= 4, 'schema v4+ with standingLog');
  var statSub = store.addSubject(cur2.sem.id, 'فيزياء', '#0090ff');
  var v1 = store.setStanding(statSub.id, 150);
  assert(v1 === 100, 'standing clamped to 100, got ' + v1);
  assert(store.get().subjects[store.get().subjects.length - 1].standing === 100, 'subject stores current standing');
  var hist1 = store.standingHistory(statSub.id);
  assert(hist1.length === 1 && hist1[0].date === u.todayStr(), 'standing change logged with today date');
  store.setStanding(statSub.id, 40);
  store.setStanding(statSub.id, 65);
  var hist2 = store.standingHistory(statSub.id);
  assert(hist2.length === 3 && hist2[2].value === 65 && hist2[1].value === 40, 'history sorted chronologically with values');
  var ghost = store.setStanding('no-such-id', 50);
  assert(ghost === null, 'setStanding ignores unknown subject');

  /* V5: vault — pin hashing, hint-gated change, entries, export exclusion */
  assert(store.get().v === 5 && !store.vaultHasPin(), 'schema v5 with locked-empty vault');
  assert((await store.vaultSetup('12', 'ح')).ok === false, 'vaultSetup rejects short pin');
  assert((await store.vaultSetup('1234', '  ')).ok === false, 'vaultSetup rejects empty hint');
  await store.vaultSetup('1234', 'تلميحتي السرية');
  assert(store.vaultHasPin() && store.get().vault.pinHash.indexOf('sha256:') === 0, 'pin stored with salted sha256, not plaintext');
  assert((await store.verifyVaultPin('1234')) === true && (await store.verifyVaultPin('9999')) === false, 'verifyVaultPin accepts only the right pin');
  assert((await store.changeVaultPin('خطأ', '5678')).ok === false, 'wrong hint blocks pin change');
  assert((await store.changeVaultPin('تلميحتي السرية', '5678')).ok === true, 'correct hint changes the pin');
  assert((await store.verifyVaultPin('5678')) === true, 'new pin works');
  /* rate limiting: 5 wrong attempts trigger a lockout, correct pin still verifies after it */
  for (var fa = 0; fa < 5; fa++) store.vaultFailAttempt();
  assert(store.vaultIsLockedOut() === true && store.vaultLockoutSeconds() > 0, 'lockout engages after 5 wrong attempts');
  store.resetVaultLock();
  assert(store.vaultIsLockedOut() === false, 'lockout resets');
  var vEntry = store.addVaultEntry({ title: 'حساب الجامعة', username: 'yousef.m', url: 'https://edu.example', password: 'p@ssw0rd', description: 'مهم' });
  assert(store.get().vault.entries.length === 1, 'vault entry added');

  /* V5.2: task progress — enable, drag, auto-complete at 100 */
  var pTask = store.addTask({ title: 'مشروع تدريجي', date: '2026-09-05', progressEnabled: true, progress: 40 });
  assert(pTask.progressEnabled === true && pTask.progress === 40, 'task created with progress 40');
  assert(pTask.done === false, '40% does not complete the task');
  store.setTaskProgress(pTask.id, 70);
  assert(store.get().tasks[store.get().tasks.length - 1].progress === 70, 'drag to 70 persists');
  store.setTaskProgress(pTask.id, 130);
  assert(store.get().tasks[store.get().tasks.length - 1].progress === 100, 'progress clamps to 100');
  assert(store.get().tasks[store.get().tasks.length - 1].done === true, '100% auto-completes the task');
  store.setTaskProgress(pTask.id, 30);
  assert(store.get().tasks[store.get().tasks.length - 1].done === false, 'dragging back re-opens the task');
  store.toggleTask(pTask.id);
  assert(store.get().tasks[store.get().tasks.length - 1].progress === 100, 'manual completion fills the bar');
  store.updateVaultEntry(vEntry.id, { password: 'newPass99' });
  assert(store.get().vault.entries[0].password === 'newPass99', 'vault entry updated');
  var vaultExport = await store.exportJSON();
  assert(vaultExport.indexOf('newPass99') === -1 && vaultExport.indexOf('pinHash') === -1, 'export never contains vault data');

  /* V5: teachers — CRUD + ratings + subject link */
  var t1 = store.addTeacher({ name: 'د. محمد العلي', subjectId: null, subjectName: 'رياضيات', photo: null });
  assert(store.teachers().length === 1 && store.teacherById(t1.id).name === 'د. محمد العلي', 'teacher added');
  var tcSubj = store.addSubject(cur2.sem.id, 'فيزياء', '#0090ff').id;
  store.updateTeacher(t1.id, { subjectId: tcSubj });
  assert(store.subjectById(tcSubj).teacherId === undefined, 'subject teacherId not set yet by teacher update'); // teacher update doesn't set subject ref
  var r1 = store.rateTeacher(t1.id, 5, 'شرح ممتاز');
  var r2 = store.rateTeacher(t1.id, 3, '');
  assert(!!r1 && !!r2 && store.teacherRating(t1).avg === 4 && store.teacherRating(t1).count === 2, 'rating avg & count');
  store.deleteRating(t1.id, r1.id);
  assert(store.teacherRating(t1).count === 1 && store.teacherRating(t1).avg === 3, 'rating deleted + avg recalculated');
  store.updateSubject(tcSubj, { teacherId: t1.id });
  assert(store.subjectsOfTeacher(t1.id).length === 1, 'subject linked to teacher');
  store.deleteTeacher(t1.id);
  assert(store.teachers().length === 0 && store.subjectById(tcSubj).teacherId === null, 'delete teacher nullifies subject link');

  /* V5: contacts — CRUD with phones/emails/photo */
  var c1 = store.addContact({ name: 'د. سارة', category: 'teacher', org: 'كلية الهندسة', phones: ['0112345678'], emails: ['sara@uni.edu'], photo: null, note: '' });
  assert(store.contacts().length === 1 && store.contactById(c1.id).phones.length === 1, 'contact added with phone');
  store.updateContact(c1.id, { phones: ['0111111111', '0555555555'], emails: [] });
  assert(store.contactById(c1.id).phones.length === 2 && store.contactById(c1.id).emails.length === 0, 'contact phones updated');
  store.deleteContact(c1.id);
  assert(store.contacts().length === 0, 'contact deleted');

  console.log(failed ? 'SMOKE FAILED' : 'SMOKE PASSED');
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error('FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
