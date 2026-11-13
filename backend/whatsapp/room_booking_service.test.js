const test = require('node:test');
const assert = require('node:assert/strict');
const { createRoomBookingService } = require('./room_booking_service');

const phone = '+919876543210';
const date = '2026-11-14';

function bookingStore({ occupied = [], reserveResult } = {}) {
  const calls = { availability: [], reservations: [] };
  return {
    calls,
    listRoomBookings: async (startDate, endDate) => {
      calls.availability.push({ startDate, endDate });
      return occupied;
    },
    reserveRoom: async (reservation) => {
      calls.reservations.push(reservation);
      return reserveResult === undefined
        ? {
            guest_phone: reservation.guestPhone,
            guest_name: reservation.guestName,
            room_number: reservation.roomNumber,
            booking_date: reservation.bookingDate,
            amount_inr: reservation.amountInr,
            mock_transaction_id: reservation.mockTransactionId,
            payment_reference: reservation.paymentReference,
            payment_status: reservation.paymentStatus,
          }
        : reserveResult;
    },
  };
}

test('room booking prices from knowledge-base rate and saves only after reported payment', async () => {
  const store = bookingStore({ occupied: [{ room_number: 101 }] });
  const service = createRoomBookingService({
    store,
    getRoomRate: async ({ roomCount, nights, guestCount }) =>
      roomCount === 1 && nights === 1 && guestCount === 2 ? { amount: 1000, source: 'room price' } : null,
    today: () => '2026-11-13',
    makePaymentReference: () => 'ROOM-TEST-123',
  });

  const offer = await service.handleMessage({
    phone,
    guestName: 'Priya',
    text: 'Book a room on 2026-11-14',
    englishText: 'Book a room on 2026-11-14',
    language: 'English',
  });
  assert.match(offer.reply, /Room 102 is available/);
  assert.match(offer.reply, /How many guests/);
  assert.equal(store.calls.availability[0].endDate, '2026-11-15');
  assert.equal(store.calls.reservations.length, 0);

  const quote = await service.handleMessage({ phone, text: '2 people', englishText: '2 people' });
  assert.match(quote.reply, /₹1000\.00/);
  assert.match(quote.reply, /Would you like to pay now/);
  assert.equal(store.calls.reservations.length, 0);

  const payment = await service.handleMessage({ phone, text: 'yes', englishText: 'yes' });
  assert.match(payment.reply, /UPI QR is for ₹1000\.00/);
  assert.deepEqual(payment.payment, { orderId: 'ROOM-TEST-123', amount: 1000 });
  assert.match(payment.reply, /cannot verify the transfer automatically/);
  assert.equal(store.calls.reservations.length, 0);

  const confirmation = await service.confirmGuestPayment(phone, payment.payment.orderId);
  assert.match(confirmation.reply, /pending staff verification/);
  assert.match(confirmation.reply, /Room: 102/);
  assert.match(confirmation.reply, /Date: 2026-11-14/);
  assert.match(confirmation.reply, /Cost: ₹1000\.00/);
  assert.match(confirmation.reply, /Payment reference: ROOM-TEST-123/);
  assert.match(confirmation.reply, /not verified until staff confirms/);
  assert.deepEqual(store.calls.reservations, [{
    bookingDate: date,
    roomNumber: 102,
    guestPhone: phone,
    guestName: 'Priya',
    amountInr: 1000,
    mockTransactionId: null,
    paymentReference: 'ROOM-TEST-123',
    paymentStatus: 'pending_verification',
  }]);
  assert.equal(service.hasPending(phone), false);
});

test('room booking refuses to invent an unsupported knowledge-base rate', async () => {
  const store = bookingStore();
  const service = createRoomBookingService({
    store,
    getRoomRate: async () => null,
    today: () => '2026-11-13',
  });

  await service.handleMessage({
    phone,
    text: 'Book a room on 2026-11-14',
    englishText: 'Book a room on 2026-11-14',
  });
  const refusal = await service.handleMessage({ phone, text: '3 guests', englishText: '3 guests' });

  assert.match(refusal.reply, /no confirmed price/);
  assert.match(refusal.reply, /can’t guess a payment amount/);
  assert.equal(store.calls.reservations.length, 0);
});

test('room booking asks for a date and does not reserve a past or invalid date', async () => {
  const store = bookingStore();
  const service = createRoomBookingService({ store, today: () => '2026-11-13' });

  const prompt = await service.handleMessage({
    phone,
    text: 'I want to book a room',
    englishText: 'I want to book a room',
  });
  assert.match(prompt.reply, /month and year/);

  const invalidDate = await service.handleMessage({
    phone,
    text: '2026-02-30',
    englishText: '2026-02-30',
  });
  assert.match(invalidDate.reply, /valid future date/);
  assert.equal(store.calls.reservations.length, 0);
});

test('room availability queries use the guest calendar and resolve weekday names', async () => {
  const store = bookingStore({ occupied: [{ room_number: 101 }, { room_number: 102 }] });
  const service = createRoomBookingService({ store, today: () => '2026-11-13' });

  const availability = await service.handleMessage({
    phone,
    text: 'Which rooms are available next Monday?',
    englishText: 'Which rooms are available next Monday?',
    language: 'English',
  });

  assert.match(availability.reply, /Monday, 2026-11-16/);
  assert.match(availability.reply, /Room 103/);
  assert.match(availability.reply, /Would you like to book it/);
  assert.doesNotMatch(availability.reply, /Room 101|Room 102/);
  const specificRoom = await service.handleMessage({
    phone,
    text: 'Is room 101 available next Monday?',
    englishText: 'Is room 101 available next Monday?',
    language: 'English',
  });
  assert.match(specificRoom.reply, /Room 101 is occupied on Monday, 2026-11-16/);
  assert.deepEqual(store.calls.availability, [
    { startDate: '2026-11-16', endDate: '2026-11-17' },
    { startDate: '2026-11-16', endDate: '2026-11-17' },
  ]);
  assert.equal(store.calls.reservations.length, 0);
});

test('available room inquiry asks before starting booking, then quotes and creates the QR action', async () => {
  const store = bookingStore({ occupied: [{ room_number: 102 }] });
  const service = createRoomBookingService({
    store,
    getRoomRate: async ({ roomCount, nights, guestCount }) =>
      roomCount === 1 && nights === 1 && guestCount === 2 ? { amount: 1000, source: 'room price' } : null,
    today: () => '2026-11-13',
    makePaymentReference: () => 'ROOM-AVAILABLE-123',
  });

  const availability = await service.handleMessage({
    phone,
    text: 'Is room 101 available on 2026-11-14?',
    englishText: 'Is room 101 available on 2026-11-14?',
    language: 'English',
  });
  assert.match(availability.reply, /Room 101 is available/);
  assert.match(availability.reply, /Would you like to book it/);
  assert.equal(availability.payment, null);
  assert.equal(store.calls.reservations.length, 0);

  const bookingChoice = await service.handleMessage({ phone, text: 'yes', englishText: 'yes' });
  assert.match(bookingChoice.reply, /How many guests/);
  const quote = await service.handleMessage({ phone, text: '2 people', englishText: '2 people' });
  assert.match(quote.reply, /₹1000\.00/);
  assert.match(quote.reply, /Would you like to pay now/);
  const paymentChoice = await service.handleMessage({ phone, text: 'yes', englishText: 'yes' });
  assert.deepEqual(paymentChoice.payment, { orderId: 'ROOM-AVAILABLE-123', amount: 1000 });
  assert.equal(store.calls.reservations.length, 0);
});

test('availability date follow-up checks the calendar and asks whether to book', async () => {
  const store = bookingStore();
  const service = createRoomBookingService({ store, today: () => '2026-11-13' });

  const datePrompt = await service.handleMessage({
    phone,
    text: 'Which rooms are available?',
    englishText: 'Which rooms are available?',
    language: 'English',
  });
  assert.match(datePrompt.reply, /Which date or weekday/);

  const availability = await service.handleMessage({
    phone,
    text: 'next Monday',
    englishText: 'next Monday',
    language: 'English',
    history: [{ sender: 'ai', body: datePrompt.reply }],
  });
  assert.match(availability.reply, /Monday, 2026-11-16/);
  assert.match(availability.reply, /Would you like to book it/);
  assert.doesNotMatch(availability.reply, /How many guests/);
  assert.equal(store.calls.availability.length, 1);
});

test('room bookings accept weekday names and offer the next matching date', async () => {
  const store = bookingStore();
  const service = createRoomBookingService({ store, today: () => '2026-11-13' });

  const offer = await service.handleMessage({
    phone,
    text: 'Book a room next Monday',
    englishText: 'Book a room next Monday',
    language: 'English',
  });

  assert.match(offer.reply, /Room 101 is available for Monday, 2026-11-16/);
  assert.deepEqual(store.calls.availability, [{ startDate: '2026-11-16', endDate: '2026-11-17' }]);
});

test('room bookings resolve natural month dates and use recent booking context', async () => {
  const store = bookingStore();
  const service = createRoomBookingService({ store, today: () => '2026-11-13' });

  const inferredYear = await service.handleMessage({
    phone,
    text: 'Okay, book on 22 November',
    englishText: 'Okay, book on 22 November',
    language: 'English',
  });
  assert.match(inferredYear.reply, /Sunday, 2026-11-22/);

  service.cancel(phone);
  const bookingContext = await service.handleMessage({
    phone,
    text: 'Then book for 23 noember 2026',
    englishText: 'Then book for 23 noember 2026',
    language: 'English',
    history: [{ sender: 'ai', body: 'Please send a future booking date in YYYY-MM-DD format so I can check room availability.' }],
  });
  assert.match(bookingContext.reply, /Monday, 2026-11-23/);
  assert.deepEqual(store.calls.availability, [
    { startDate: '2026-11-22', endDate: '2026-11-23' },
    { startDate: '2026-11-23', endDate: '2026-11-24' },
  ]);
});

test('invalid natural dates are clarified instead of normalized into another date', async () => {
  const store = bookingStore();
  const service = createRoomBookingService({ store, today: () => '2026-11-13' });

  const reply = await service.handleMessage({
    phone,
    text: 'Book a room on 31 November 2026',
    englishText: 'Book a room on 31 November 2026',
  });

  assert.match(reply.reply, /could not confirm a valid future date/);
  assert.equal(store.calls.availability.length, 0);
  assert.equal(store.calls.reservations.length, 0);
});

test('no rooms available and reservation conflicts never create a confirmed booking', async () => {
  const fullStore = bookingStore({ occupied: Array.from({ length: 9 }, (_, i) => ({ room_number: i + 101 })) });
  const fullService = createRoomBookingService({ store: fullStore, today: () => '2026-11-13' });
  const unavailable = await fullService.handleMessage({
    phone,
    text: 'Book a room on 2026-11-14',
    englishText: 'Book a room on 2026-11-14',
  });
  assert.match(unavailable.reply, /No room is available/);
  assert.equal(fullStore.calls.reservations.length, 0);

  const conflictStore = bookingStore({ reserveResult: null });
  const conflictService = createRoomBookingService({
    store: conflictStore,
    today: () => '2026-11-13',
    getRoomRate: async () => ({ amount: 1000, source: 'room price' }),
    makePaymentReference: () => 'ROOM-CONFLICT',
  });
  await conflictService.handleMessage({
    phone,
    text: 'Book a room on 2026-11-14',
    englishText: 'Book a room on 2026-11-14',
  });
  await conflictService.handleMessage({ phone, text: '2 people' });
  const payment = await conflictService.handleMessage({ phone, text: 'yes' });
  const conflict = await conflictService.confirmGuestPayment(phone, payment.payment.orderId);
  assert.match(conflict.reply, /was just taken/);
  assert.match(conflict.reply, /payment has not been verified/);
  assert.equal(conflictService.hasPending(phone), false);
});
