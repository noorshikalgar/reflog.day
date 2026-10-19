import { describe, expect, it } from 'vitest';
import {
  addDays, addMinutes, bestStreak, dayStats, nextTag, tagProgress, tagsEarned, isScheduled, isoWeekLabel, logicalDay, missIsRebase,
  patina, restLeftThisWeek, streak, tagFor, weekday, EVERY_DAY, type Kind,
} from '../src/rules.ts';

const log = (o: Record<string, Kind>) => new Map(Object.entries(o));

describe('calendar helpers', () => {
  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('weekday is 0 for Monday', () => {
    expect(weekday('2026-10-19')).toBe(0);
    expect(weekday('2026-10-25')).toBe(6);
  });
  it('checks the schedule mask', () => {
    const mwf = 0b0010101;
    expect(isScheduled(mwf, '2026-10-19')).toBe(true);  // Mon
    expect(isScheduled(mwf, '2026-10-20')).toBe(false); // Tue
    expect(isScheduled(EVERY_DAY, '2026-10-20')).toBe(true);
  });
  it('labels ISO weeks', () => {
    expect(isoWeekLabel('2026-10-19')).toBe('v2026.43');
    expect(isoWeekLabel('2027-01-01')).toBe('v2026.53');
  });
});

describe('addMinutes', () => {
  it('adds without wrapping at midnight', () => {
    expect(addMinutes('10:00', 30)).toBe('10:30');
    expect(addMinutes('09:45', 30)).toBe('10:15');
    expect(addMinutes('23:50', 30)).toBe('24:20');
  });
});

describe('logicalDay', () => {
  it('belongs to the previous day before the start hour', () => {
    expect(logicalDay(new Date('2026-10-19T20:00:00Z'), 'Asia/Kolkata', 4)).toBe('2026-10-19'); // 20 Oct 01:30 IST
    expect(logicalDay(new Date('2026-10-19T21:30:00Z'), 'Asia/Kolkata', 4)).toBe('2026-10-19'); // 20 Oct 03:00 IST
  });
  it('starts the new day at the start hour', () => {
    expect(logicalDay(new Date('2026-10-19T23:00:00Z'), 'Asia/Kolkata', 4)).toBe('2026-10-20'); // 20 Oct 04:30 IST
    expect(logicalDay(new Date('2026-10-19T21:30:00Z'), 'Asia/Kolkata', 0)).toBe('2026-10-20');
  });
  it('uses the time zone, not UTC', () => {
    expect(logicalDay(new Date('2026-10-19T12:00:00Z'), 'America/New_York', 4)).toBe('2026-10-19');
    expect(logicalDay(new Date('2026-10-19T06:00:00Z'), 'America/New_York', 4)).toBe('2026-10-18'); // 02:00 EDT
  });
});

describe('streak', () => {
  const today = '2026-10-19';
  const since = '2026-10-01';

  it('counts done days', () => {
    expect(streak(log({ '2026-10-17': 'done', '2026-10-18': 'done', '2026-10-19': 'done' }), EVERY_DAY, today, '2026-10-17')).toBe(3);
  });
  it('does not break on an open today', () => {
    expect(streak(log({ '2026-10-17': 'done', '2026-10-18': 'done' }), EVERY_DAY, today, '2026-10-17')).toBe(2);
  });
  it('rest keeps the streak but does not count', () => {
    expect(streak(log({ '2026-10-16': 'done', '2026-10-17': 'rest', '2026-10-18': 'done' }), EVERY_DAY, today, '2026-10-16')).toBe(2);
  });
  it('one miss does not break the streak', () => {
    expect(streak(log({ '2026-10-16': 'done', '2026-10-17': 'miss', '2026-10-18': 'done' }), EVERY_DAY, today, '2026-10-16')).toBe(2);
  });
  it('an absent past day counts as a miss', () => {
    expect(streak(log({ '2026-10-16': 'done', '2026-10-18': 'done' }), EVERY_DAY, today, '2026-10-16')).toBe(2);
  });
  it('two misses in a row rebase to zero', () => {
    const l = log({ '2026-10-14': 'done', '2026-10-15': 'done', '2026-10-16': 'miss', '2026-10-17': 'miss', '2026-10-18': 'done' });
    expect(streak(l, EVERY_DAY, today, since)).toBe(1);
  });
  it('two misses right before today give zero', () => {
    expect(streak(log({ '2026-10-15': 'done', '2026-10-17': 'miss', '2026-10-18': 'miss' }), EVERY_DAY, today, since)).toBe(0);
  });
  it('skips unscheduled days', () => {
    const mwf = 0b0010101; // Mon Wed Fri
    const l = log({ '2026-10-12': 'done', '2026-10-14': 'done', '2026-10-16': 'done', '2026-10-19': 'done' });
    expect(streak(l, mwf, today, '2026-10-12')).toBe(4);
  });
  it('stops at the start day', () => {
    expect(streak(log({ '2026-10-18': 'done' }), EVERY_DAY, today, '2026-10-18')).toBe(1);
  });
});

describe('bestStreak', () => {
  it('keeps the best run after a rebase', () => {
    const l = log({
      '2026-10-01': 'done', '2026-10-02': 'done', '2026-10-03': 'done', '2026-10-04': 'done',
      '2026-10-05': 'miss', '2026-10-06': 'miss',
      '2026-10-07': 'done',
    });
    expect(bestStreak(l, EVERY_DAY, '2026-10-07', '2026-10-01')).toBe(4);
  });
  it('a single miss joins two runs', () => {
    const l = log({ '2026-10-01': 'done', '2026-10-02': 'done', '2026-10-03': 'miss', '2026-10-04': 'done' });
    expect(bestStreak(l, EVERY_DAY, '2026-10-04', '2026-10-01')).toBe(3);
  });
});

describe('patina', () => {
  it('counts misses in the last 14 days, max 3', () => {
    const l = new Map<string, Kind>();
    for (let i = 1; i <= 14; i++) l.set(addDays('2026-10-19', -i), 'done');
    expect(patina(l, EVERY_DAY, '2026-10-19')).toBe(0);
    l.set('2026-10-18', 'miss');
    expect(patina(l, EVERY_DAY, '2026-10-19')).toBe(1);
    l.set('2026-10-10', 'miss'); l.set('2026-10-08', 'miss'); l.set('2026-10-06', 'miss');
    expect(patina(l, EVERY_DAY, '2026-10-19')).toBe(3);
  });
  it('fades when the miss is older than 14 days', () => {
    const l = new Map<string, Kind>();
    for (let i = 1; i <= 20; i++) l.set(addDays('2026-10-19', -i), 'done');
    l.set('2026-10-04', 'miss');
    expect(patina(l, EVERY_DAY, '2026-10-19')).toBe(0);
  });
  it('ignores days before the start day', () => {
    expect(patina(new Map(), EVERY_DAY, '2026-10-19', '2026-10-19')).toBe(0);
  });
});

describe('miss details', () => {
  it('detects a rebase miss', () => {
    const l = log({ '2026-10-16': 'miss', '2026-10-17': 'miss' });
    expect(missIsRebase(l, EVERY_DAY, '2026-10-17')).toBe(true);
    expect(missIsRebase(l, EVERY_DAY, '2026-10-16')).toBe(false);
  });
  it('uses the previous scheduled day', () => {
    const mwf = 0b0010101;
    expect(missIsRebase(log({ '2026-10-14': 'miss', '2026-10-16': 'miss' }), mwf, '2026-10-16')).toBe(true);
  });
});

describe('rest budget', () => {
  it('gives one rest each ISO week', () => {
    expect(restLeftThisWeek(log({}), '2026-10-21')).toBe(1);
    expect(restLeftThisWeek(log({ '2026-10-19': 'rest' }), '2026-10-21')).toBe(0);
    expect(restLeftThisWeek(log({ '2026-10-18': 'rest' }), '2026-10-21')).toBe(1); // last week
  });
});

describe('nextTag', () => {
  it('gives the next milestone and the days to go', () => {
    expect(nextTag(0)).toEqual({ name: 'v0.1.0', at: 7, to_go: 7 });
    expect(nextTag(7)).toEqual({ name: 'v1.0.0', at: 30, to_go: 23 });
    expect(nextTag(365)).toBeNull();
  });
});

describe('tagsEarned', () => {
  it('counts each time a run reaches a milestone', () => {
    const l = new Map<string, Kind>();
    for (let i = 0; i < 7; i++) l.set(addDays('2026-10-01', i), 'done');      // run 1: 7 → v0.1.0
    l.set('2026-10-08', 'miss'); l.set('2026-10-09', 'miss');                 // rebase
    for (let i = 0; i < 7; i++) l.set(addDays('2026-10-10', i), 'done');      // run 2: 7 → v0.1.0
    expect(tagsEarned(l, EVERY_DAY, '2026-10-16', '2026-10-01')).toBe(2);
    expect(tagsEarned(l, EVERY_DAY, '2026-10-15', '2026-10-01')).toBe(1);
  });
});

describe('tagProgress', () => {
  it('measures from the last milestone to the next', () => {
    expect(tagProgress(0)).toEqual({ p: 0, next: 7, prev: 0 });
    expect(tagProgress(29)).toEqual({ p: 22 / 23, next: 30, prev: 7 });
    expect(tagProgress(30).p).toBe(0);
    expect(tagProgress(400)).toEqual({ p: 1, next: 365, prev: 365 });
  });
});

describe('tags', () => {
  it('names milestones', () => {
    expect(tagFor(6)).toBeNull();
    expect(tagFor(7)).toBe('v0.1.0');
    expect(tagFor(30)).toBe('v1.0.0');
    expect(tagFor(100)).toBe('v2.0.0');
    expect(tagFor(365)).toBe('LTS');
  });
});

describe('dayStats', () => {
  it('counts rest as complete', () => {
    expect(dayStats(['done', 'rest', null, 'miss'])).toEqual({ complete: 2, total: 4, clean: false });
    expect(dayStats(['done', 'rest'])).toEqual({ complete: 2, total: 2, clean: true });
  });
});
