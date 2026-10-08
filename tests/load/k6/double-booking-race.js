// SE3112 – Load & Performance testing: correctness under high concurrency.
//
// RACERS virtual users are released at the same instant and all try to book the SAME table
// for the SAME period. The reservation service locks the table row (SELECT … FOR UPDATE) and
// re-checks overlap inside the transaction, so exactly one request may win (201) and every
// other request must get 409 TABLE_NO_LONGER_AVAILABLE – never a 500, never a second booking.
//
// The race is repeated for ROUNDS different tables to make a lucky pass unlikely.
//
// Run:  k6 run -e RACERS=50 -e ROUNDS=3 tests/load/k6/double-booking-race.js
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Trend } from 'k6/metrics';
import * as api from './lib/api.js';
import { RUN_ID } from './lib/config.js';
import { uuid } from './lib/data.js';
import { buildSummary } from './lib/summary.js';

const RACERS = parseInt(__ENV.RACERS || '50', 10);
const ROUNDS = parseInt(__ENV.ROUNDS || '3', 10);
const CUSTOMERS = Math.min(RACERS, parseInt(__ENV.RACE_CUSTOMERS || '10', 10));
const PASSWORD = 'LoadTest#2026';

const created = new Counter('race_bookings_created');
const conflicts = new Counter('race_conflicts');
const unexpected = new Counter('race_unexpected_responses');
const persisted = new Counter('race_rounds_with_exactly_one_booking');
const contendedLatency = new Trend('race_contended_booking_latency', true);

export const options = {
  scenarios: {
    race: {
      executor: 'per-vu-iterations',
      vus: RACERS,
      iterations: ROUNDS,
      maxDuration: '3m',
    },
  },
  thresholds: {
    race_bookings_created: [`count==${ROUNDS}`],                 // exactly one winner per round
    race_conflicts: [`count==${(RACERS - 1) * ROUNDS}`],          // everybody else loses cleanly
    race_unexpected_responses: ['count==0'],                     // no 5xx, no 400s
    race_rounds_with_exactly_one_booking: [`count==${ROUNDS}`],  // verified in the database via the admin API
    race_contended_booking_latency: ['p(95)<2000'],
    'http_req_duration{endpoint:create_reservation}': ['max>=0'],
    'http_reqs{endpoint:create_reservation}': ['count>=0'],
  },
  setupTimeout: '2m',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const adminEmail = `race.admin.${RUN_ID}@load.test`;
  api.register('Race Admin', adminEmail, PASSWORD, 'Admin');
  const adminToken = api.loginOrFail(adminEmail, PASSWORD);

  const rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    const tableNumber = `RACE-${RUN_ID}-${r}`.slice(0, 20);
    const tableId = api.createTable(adminToken, tableNumber, 4);
    const date = new Date(Date.now() + (60 + r) * 86_400_000).toISOString().slice(0, 10);
    rounds.push({ tableId, tableNumber, slot: { date, startTime: '19:00', durationMinutes: 90, guestCount: 2 } });
  }

  const tokens = [];
  for (let i = 0; i < CUSTOMERS; i++) {
    const email = `racer${i}.${RUN_ID}@load.test`;
    api.register(`Racer ${i}`, email, PASSWORD);
    tokens.push(api.loginOrFail(email, PASSWORD));
  }
  // Every round starts on a shared wall-clock "starting gun" so the requests really overlap.
  return { adminToken, rounds, tokens, gun: Date.now() + 2000 };
}

export default function (data) {
  const round = exec.vu.iterationInScenario;
  const { tableId, slot } = data.rounds[round];
  const startAt = data.gun + round * 4000;
  const wait = (startAt - Date.now()) / 1000;
  if (wait > 0) sleep(wait);

  const token = data.tokens[(exec.vu.idInTest - 1) % data.tokens.length];
  const res = api.createReservation(token, tableId, slot, uuid());
  contendedLatency.add(res.timings.duration);

  if (res.status === 201) created.add(1);
  else if (res.status === 409) conflicts.add(1);
  else unexpected.add(1, { status: String(res.status) });
}

export function teardown(data) {
  // Independent oracle: ask the admin API how many active bookings each contested table really has.
  for (const round of data.rounds) {
    const page = api.adminReservationsForTable(data.adminToken, round.tableNumber);
    const active = page ? page.items.filter((i) => i.status === 'Pending' || i.status === 'Confirmed').length : -1;
    const ok = check(active, { [`table ${round.tableNumber} has exactly one booking`]: (n) => n === 1 });
    if (ok) persisted.add(1);
  }
}

export function handleSummary(data) {
  return buildSummary('double-booking-race', `Double-booking race – ${RACERS} concurrent users × ${ROUNDS} rounds`, data, [
    'race_bookings_created',
    'race_conflicts',
    'race_unexpected_responses',
    'race_rounds_with_exactly_one_booking',
    'race_contended_booking_latency',
  ]);
}
