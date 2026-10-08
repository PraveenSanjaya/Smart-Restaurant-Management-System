// SE3112 – Load & Performance testing: shared configuration.
// Every value can be overridden with `-e NAME=value` (k6) or an environment variable.

export const IDENTITY_URL = __ENV.IDENTITY_URL || 'http://localhost:5001';
export const RESERVATION_URL = __ENV.RESERVATION_URL || 'http://localhost:5000';
export const STAFF_CODE = __ENV.STAFF_CODE || 'LOADTEST-STAFF';
export const PROFILE = (__ENV.PROFILE || 'smoke').toLowerCase();
export const CUSTOMER_POOL = parseInt(__ENV.CUSTOMER_POOL || '20', 10);
export const RUN_ID = __ENV.RUN_ID || `${Date.now().toString(36)}`;

/**
 * Workload shapes for the customer journey (closed model, virtual users)
 * and the login endpoint (open model, fixed arrival rate).
 *  smoke  – sanity check that the scripts and environment work (CI on every push)
 *  load   – expected Friday-evening peak; the SLO gate
 *  stress – ramp beyond peak to find the knee of the latency curve
 *  spike  – sudden burst (e.g. a promotion goes live) and recovery
 *  soak   – sustained moderate load to expose leaks / pool exhaustion
 */
export const PROFILES = {
  smoke: {
    journey: { executor: 'constant-vus', vus: 2, duration: '30s' },
    login: { executor: 'constant-arrival-rate', rate: 1, timeUnit: '1s', duration: '30s', preAllocatedVUs: 2 },
  },
  load: {
    journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    login: { executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: '1m45s', preAllocatedVUs: 10, maxVUs: 30 },
  },
  stress: {
    journey: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 150 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
    login: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 150,
      stages: [
        { duration: '1m', target: 15 },
        { duration: '1m30s', target: 30 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  spike: {
    journey: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '20s', target: 5 },
        { duration: '10s', target: 200 }, // the spike
        { duration: '30s', target: 200 },
        { duration: '10s', target: 5 },   // recovery
        { duration: '20s', target: 5 },
      ],
      gracefulRampDown: '15s',
    },
    login: { executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: '1m30s', preAllocatedVUs: 10, maxVUs: 50 },
  },
  soak: {
    journey: { executor: 'constant-vus', vus: 30, duration: __ENV.SOAK_DURATION || '15m' },
    login: { executor: 'constant-arrival-rate', rate: 3, timeUnit: '1s', duration: __ENV.SOAK_DURATION || '15m', preAllocatedVUs: 10, maxVUs: 30 },
  },
};

/**
 * Service Level Objectives. The same thresholds apply to every profile: under stress/spike
 * they are *expected* to be breached – the report then shows where the system broke.
 * 409 Conflict on booking is a correct business answer and is excluded from http_req_failed.
 */
export const SLO_THRESHOLDS = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  'http_req_duration{endpoint:tables_active}': ['p(95)<300'],
  'http_req_duration{endpoint:availability}': ['p(95)<500'],
  'http_req_duration{endpoint:create_reservation}': ['p(95)<800'],
  'http_req_duration{endpoint:reservation_detail}': ['p(95)<300'],
  'http_req_duration{endpoint:my_history}': ['p(95)<400'],
  'http_req_duration{endpoint:login}': ['p(95)<1500'], // BCrypt work factor 11 is intentionally slow
  booking_success_rate: ['rate>0.5'],
  journey_duration: ['p(95)<1500'], // server-side time of a whole visit, think time excluded
};
