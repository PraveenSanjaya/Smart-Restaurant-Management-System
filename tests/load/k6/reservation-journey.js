// SE3112 – Load & Performance testing: realistic mixed workload across both microservices.
//
//   scenario "journey" (closed model):  browse tables → search availability → book → view → (cancel) → history
//   scenario "login"   (open model):    fixed arrival rate of logins – BCrypt makes this CPU-bound
//
// Run:  k6 run -e PROFILE=load tests/load/k6/reservation-journey.js     (PROFILE = smoke|load|stress|spike|soak)
import { group, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import * as api from './lib/api.js';
import { CUSTOMER_POOL, PROFILE, PROFILES, RUN_ID, SLO_THRESHOLDS } from './lib/config.js';
import { pick, randomInt, randomSlot, uuid } from './lib/data.js';
import { buildSummary } from './lib/summary.js';

const profile = PROFILES[PROFILE];
if (!profile) throw new Error(`Unknown PROFILE "${PROFILE}". Use one of: ${Object.keys(PROFILES).join(', ')}`);

const bookingsCreated = new Counter('bookings_created');
const bookingConflicts = new Counter('booking_conflicts');
const bookingSuccess = new Rate('booking_success_rate');
const noTableOffered = new Counter('searches_without_tables');
// Active time of one journey (wall clock minus simulated think time).
const journeyDuration = new Trend('journey_duration', true);

const ENDPOINTS = ['login', 'tables_active', 'availability', 'create_reservation', 'reservation_detail', 'cancel_reservation', 'my_history'];
// k6 only reports tagged sub-metrics that have a threshold, so every endpoint gets a no-op one.
const trackEveryEndpoint = Object.fromEntries(
  ENDPOINTS.flatMap((e) => [
    [`http_reqs{endpoint:${e}}`, ['count>=0']],
    ...(SLO_THRESHOLDS[`http_req_duration{endpoint:${e}}`] ? [] : [[`http_req_duration{endpoint:${e}}`, ['max>=0']]]),
  ]),
);

export const options = {
  scenarios: {
    journey: { ...profile.journey, exec: 'customerJourney', tags: { scenario: 'journey' } },
    login: { ...profile.login, exec: 'loginOnly', tags: { scenario: 'login' } },
  },
  thresholds: {
    ...SLO_THRESHOLDS,
    ...trackEveryEndpoint,
    bookings_created: ['count>0'],
    booking_conflicts: ['count>=0'],
    searches_without_tables: ['count>=0'],
  },
  setupTimeout: '3m',
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { profile: PROFILE, run: RUN_ID },
};

const PASSWORD = 'LoadTest#2026';

/** Runs once: creates an admin, extra tables and a pool of customers, then hands out JWTs. */
export function setup() {
  const adminEmail = `admin.${RUN_ID}@load.test`;
  api.register('Load Admin', adminEmail, PASSWORD, 'Admin');
  const adminToken = api.loginOrFail(adminEmail, PASSWORD);

  // 12 extra tables of varied capacity on top of the 5 seeded ones.
  for (let i = 1; i <= 12; i++) api.createTable(adminToken, `LT-${RUN_ID}-${i}`.slice(0, 20), [2, 2, 4, 4, 6, 8][i % 6]);

  const customers = [];
  for (let i = 0; i < CUSTOMER_POOL; i++) {
    const email = `customer${i}.${RUN_ID}@load.test`;
    api.register(`Load Customer ${i}`, email, PASSWORD);
    customers.push({ email, token: api.loginOrFail(email, PASSWORD) });
  }
  return { customers };
}

export function customerJourney(data) {
  // Each VU impersonates one pooled customer so ownership rules are exercised realistically.
  const customer = data.customers[(exec.vu.idInTest - 1) % data.customers.length];
  const token = customer.token;
  const started = Date.now();
  let thinking = 0;
  const think = (seconds) => {
    thinking += seconds * 1000;
    sleep(seconds);
  };

  group('01 browse tables', () => {
    api.activeTables(token);
  });
  think(randomInt(1, 2));

  const slot = randomSlot();
  let tables = [];
  group('02 search availability', () => {
    tables = api.searchAvailability(token, slot);
    if (tables.length === 0) noTableOffered.add(1);
  });
  think(randomInt(1, 3)); // user compares tables

  let reservationId = null;
  if (tables.length > 0) {
    group('03 book a table', () => {
      const res = api.createReservation(token, pick(tables).tableId, slot, uuid());
      bookingSuccess.add(res.status === 201);
      if (res.status === 201) {
        bookingsCreated.add(1);
        reservationId = res.json('reservationId');
      } else if (res.status === 409) {
        bookingConflicts.add(1); // another VU won the race between search and book
      }
    });
  }

  if (reservationId) {
    think(1);
    group('04 view booking', () => {
      api.reservationDetail(token, reservationId);
    });
    if (Math.random() < 0.3) {
      group('05 cancel booking', () => {
        api.cancelReservation(token, reservationId);
      });
    }
  }

  group('06 booking history', () => {
    api.myHistory(token);
  });
  journeyDuration.add(Date.now() - started - thinking);
  sleep(randomInt(1, 3)); // pause before the next visit
}

export function loginOnly(data) {
  api.login(pick(data.customers).email, PASSWORD);
}

export function handleSummary(data) {
  return buildSummary(`journey-${PROFILE}`, `Customer journey – ${PROFILE} profile`, data, [
    'bookings_created',
    'booking_conflicts',
    'booking_success_rate',
    'searches_without_tables',
    'journey_duration',
  ]);
}
