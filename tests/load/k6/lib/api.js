// SE3112 – Load & Performance testing: thin API client for the two microservices.
// Every request carries an `endpoint` tag so latency is reported per endpoint, not per unique URL.
import http from 'k6/http';
import { check, fail } from 'k6';
import { IDENTITY_URL, RESERVATION_URL, STAFF_CODE } from './config.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const auth = (token) => ({ ...JSON_HEADERS, Authorization: `Bearer ${token}` });

// A 409 from the booking endpoint is the double-booking guard doing its job, not a failure.
const BOOKING_EXPECTED = http.expectedStatuses({ min: 200, max: 299 }, 409);

export function register(fullName, email, password, role = 'Customer') {
  const body = { fullName, email, password, role };
  if (role !== 'Customer') body.staffAuthorizationCode = STAFF_CODE;
  const res = http.post(`${IDENTITY_URL}/api/auth/register`, JSON.stringify(body), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'register' },
  });
  check(res, { 'register → 201': (r) => r.status === 201 });
  return res;
}

export function login(email, password) {
  const res = http.post(`${IDENTITY_URL}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'login' },
  });
  check(res, {
    'login → 200': (r) => r.status === 200,
    'login returns a JWT': (r) => r.status === 200 && typeof r.json('token') === 'string' && r.json('token').split('.').length === 3,
  });
  return res.status === 200 ? res.json('token') : null;
}

export function loginOrFail(email, password) {
  const token = login(email, password);
  if (!token) fail(`setup: could not log in as ${email}`);
  return token;
}

export function createTable(adminToken, tableNumber, capacity, location = 'Load Test Hall') {
  const res = http.post(`${RESERVATION_URL}/api/tables`, JSON.stringify({ tableNumber, capacity, location }), {
    headers: auth(adminToken),
    tags: { endpoint: 'create_table' },
  });
  check(res, { 'create table → 201': (r) => r.status === 201 });
  return res.status === 201 ? res.json('id') : null;
}

export function activeTables(token) {
  const res = http.get(`${RESERVATION_URL}/api/tables/active`, { headers: auth(token), tags: { endpoint: 'tables_active' } });
  check(res, {
    'active tables → 200': (r) => r.status === 200,
    'active tables is a non-empty list': (r) => r.status === 200 && Array.isArray(r.json()) && r.json().length > 0,
  });
  return res;
}

export function searchAvailability(token, slot) {
  const q = `date=${slot.date}&startTime=${slot.startTime}&durationMinutes=${slot.durationMinutes}&guestCount=${slot.guestCount}`;
  const res = http.get(`${RESERVATION_URL}/api/reservations/availability?${q}`, {
    headers: auth(token),
    tags: { endpoint: 'availability' },
  });
  check(res, {
    'availability → 200': (r) => r.status === 200,
    'every offered table seats the party': (r) =>
      r.status === 200 && r.json().every((t) => t.seatingCapacity >= slot.guestCount),
  });
  return res.status === 200 ? res.json() : [];
}

export function createReservation(token, tableId, slot, idempotencyKey) {
  const body = { tableId, date: slot.date, startTime: slot.startTime, durationMinutes: slot.durationMinutes, guestCount: slot.guestCount };
  const res = http.post(`${RESERVATION_URL}/api/reservations`, JSON.stringify(body), {
    headers: { ...auth(token), 'Idempotency-Key': idempotencyKey },
    tags: { endpoint: 'create_reservation' },
    responseCallback: BOOKING_EXPECTED,
  });
  check(res, {
    'booking → 201 or 409': (r) => r.status === 201 || r.status === 409,
    'created booking has a reference': (r) => r.status !== 201 || /^SR-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.json('bookingReference')),
    'conflict explains the double booking': (r) => r.status !== 409 || r.json('code') === 'TABLE_NO_LONGER_AVAILABLE',
  });
  return res;
}

export function reservationDetail(token, reservationId) {
  const res = http.get(`${RESERVATION_URL}/api/reservations/${reservationId}/detail`, {
    headers: auth(token),
    tags: { endpoint: 'reservation_detail' },
  });
  check(res, { 'detail → 200': (r) => r.status === 200 && r.json('reservationId') === reservationId });
  return res;
}

export function cancelReservation(token, reservationId) {
  const res = http.post(`${RESERVATION_URL}/api/reservations/${reservationId}/cancel`, null, {
    headers: auth(token),
    tags: { endpoint: 'cancel_reservation' },
  });
  check(res, { 'cancel → 200 Cancelled': (r) => r.status === 200 && r.json('status') === 'Cancelled' });
  return res;
}

export function myHistory(token) {
  const res = http.get(`${RESERVATION_URL}/api/reservations/my-history?page=1&pageSize=10`, {
    headers: auth(token),
    tags: { endpoint: 'my_history' },
  });
  check(res, { 'history → 200': (r) => r.status === 200 && Array.isArray(r.json('items')) });
  return res;
}

export function adminReservationsForTable(adminToken, tableNumber) {
  const res = http.get(`${RESERVATION_URL}/api/reservations?tableNumber=${encodeURIComponent(tableNumber)}&pageSize=100`, {
    headers: auth(adminToken),
    tags: { endpoint: 'admin_reservations' },
  });
  return res.status === 200 ? res.json() : null;
}
