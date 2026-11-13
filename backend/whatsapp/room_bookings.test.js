const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseStore } = require('./conversation_service');

test('room bookings are listed by date range', async () => {
  const calls = [];
  const rows = [
    { booking_date: '2026-11-13', room_number: 101 },
    { booking_date: '2026-11-14', room_number: 104 },
  ];
  const store = createSupabaseStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    },
  });

  assert.deepEqual(await store.listRoomBookings('2026-11-01', '2026-12-01'), rows);
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/rest/v1/room_bookings');
  assert.equal(url.searchParams.get('and'), '(booking_date.gte.2026-11-01,booking_date.lt.2026-12-01)');
  assert.equal(url.searchParams.get('order'), 'booking_date.asc,room_number.asc');
});

test('room bookings can be saved idempotently and removed', async () => {
  const calls = [];
  const booking = { booking_date: '2026-11-13', room_number: 101 };
  const store = createSupabaseStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => options.method === 'POST' ? JSON.stringify([booking]) : JSON.stringify([booking]),
      };
    },
  });

  assert.deepEqual(await store.setRoomBooking(booking.booking_date, booking.room_number, true), booking);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Prefer, 'resolution=merge-duplicates,return=representation');
  assert.equal(new URL(calls[0].url).searchParams.get('on_conflict'), 'booking_date,room_number');

  assert.equal(await store.setRoomBooking(booking.booking_date, booking.room_number, false), true);
  assert.equal(calls[1].options.method, 'DELETE');
  const deleteUrl = new URL(calls[1].url);
  assert.equal(deleteUrl.searchParams.get('booking_date'), 'eq.2026-11-13');
  assert.equal(deleteUrl.searchParams.get('room_number'), 'eq.101');
});
