// SE3112 – Load & Performance testing: realistic, collision-friendly test data.

export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pick = (items) => items[Math.floor(Math.random() * items.length)];

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isoDate(daysAhead) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * A booking request inside opening hours (10:00–22:00). Dates are drawn from a narrow
 * window on purpose so that concurrent virtual users really do compete for the same tables.
 */
export function randomSlot(windowDays = 14) {
  const durationMinutes = pick([60, 90, 120]);
  // Half-hour slots from 11:00 so that start + duration never passes the 22:00 closing time.
  const slots = (22 * 60 - durationMinutes - 11 * 60) / 30;
  const startMinutes = 11 * 60 + randomInt(0, slots) * 30;
  const startTime = `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}`;
  return {
    date: isoDate(randomInt(30, 30 + windowDays)), // ≥30 days ahead: never "in the past" in any timezone
    startTime,
    durationMinutes,
    guestCount: pick([1, 2, 2, 2, 3, 4, 4, 5, 6]),
  };
}
