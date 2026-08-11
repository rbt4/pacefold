import assert from'node:assert/strict';
import{DEFAULT_PREFS,migratePrefs,zoneOffsetHours,scheduleState,workRange,normalizeNotes,backupPayload}from'../src/app/core.mjs';

const prefs=migratePrefs({...DEFAULT_PREFS,profile:'original',timeZone:'America/Toronto',lat:43.6205,lng:-79.5132,asr:'hanafi',method:'15'});
assert.equal(zoneOffsetHours(new Date('2026-01-15T17:00:00Z'),'America/Toronto'),-5);
assert.equal(zoneOffsetHours(new Date('2026-07-15T16:00:00Z'),'America/Toronto'),-4);
for(const stamp of ['2026-01-15T12:00:00Z','2026-03-08T16:00:00Z','2026-07-15T16:00:00Z','2026-11-01T17:00:00Z']){
  const state=scheduleState(new Date(stamp),prefs);assert.equal(state.today.length,6);assert(state.today.every((item,index,rows)=>!index||item.date>rows[index-1].date),`Schedule is unordered at ${stamp}`);assert(state.next?.date>new Date(stamp));
}
assert.deepEqual(workRange({...prefs,workHours:'08:30-16:30'}),workRange({...prefs,workHours:'08:30-16:30'}));
const monday=workRange({...prefs,workWeek:{1:{start:'09:15',end:'17:00',type:'desk'}}},new Date('2026-08-10T16:00:00Z'));assert.equal(monday.startText,'09:15');assert.equal(monday.endText,'17:00');assert.equal(monday.activeDay,true);
const old=migratePrefs({profile:'original',waterSips:6,noodleMinutes:60,bodyCadence:90});assert.equal(old.waterOz,6);assert.equal(old.prepMinutes,60);assert.equal(old.bodyCadence,90);
const custom=migratePrefs({profile:'custom',customMoments:[['school','School run','08:10'],['pause','Pause','12:20']]});assert.equal(scheduleState(new Date('2026-08-10T11:00:00Z'),custom).today.length,2);
const notes=normalizeNotes([{text:'Legacy capture',kind:'Follow-up',createdAt:'2026-08-10T12:00:00Z'}]);assert.equal(notes.length,1);assert.equal(notes[0].body,'Legacy capture');assert.equal(notes[0].category,'Follow-up');
const backup=backupPayload({prefs,notes,log:{days:{}}});assert.equal(backup.format,'pacefold.backup.v3');assert.equal(backup.notes.length,1);
console.log('Pacefold core tests passed: DST, ordered rhythm, preference migration, note migration and backup.');
