const crypto = require('crypto');
const { normalizePhone } = require('./conversation_service');
const { isThumbsUp } = require('./payment_intent');

const ROOM_NUMBERS = Array.from({ length: 9 }, (_, index) => 101 + index);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOOKING_INTENT_RE = /\b(?:book(?:ing)?|reserve|reservation)\b/i;
const ROOM_RE = /\b(?:rooms?|accommodation|stay)\b/i;
const AVAILABILITY_INTENT_RE = /\b(?:availability|available|vacant|occup(?:ancy|ied)|free|open)\b/i;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  ['january', 'jan'], ['february', 'feb'], ['march', 'mar'], ['april', 'apr'],
  ['may'], ['june', 'jun'], ['july', 'jul'], ['august', 'aug'],
  ['september', 'sept', 'sep'], ['october', 'oct'], ['november', 'nov'], ['december', 'dec'],
];

function isValidDate(value) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function nextDate(value) {
  const date = new Date(value + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function monthNumber(token) {
  const normalized = String(token || '').toLowerCase().replace(/\.$/, '');
  const exact = MONTHS.findIndex((month) => month.includes(normalized));
  if (exact !== -1) return exact + 1;
  if (normalized.length < 4) return null;

  const editDistance = (left, right) => {
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i++) {
      const current = [i];
      for (let j = 1; j <= right.length; j++) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
        );
      }
      previous = current;
    }
    return previous[right.length];
  };
  const approximate = MONTHS.findIndex((month) =>
    month.some((name) => name.length >= 4 && editDistance(normalized, name) === 1)
  );
  return approximate === -1 ? null : approximate + 1;
}

function monthDateFromText(text, today) {
  const value = String(text || '');
  const monthFirst = value.match(/\b([a-z]+\.?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i);
  const dayFirst = value.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+\.?)(?:,?\s+(\d{4}))?\b/i);
  const match = [
    monthFirst && { month: monthNumber(monthFirst[1]), day: Number(monthFirst[2]), year: monthFirst[3] },
    dayFirst && { month: monthNumber(dayFirst[2]), day: Number(dayFirst[1]), year: dayFirst[3] },
  ].find((candidate) => candidate && candidate.month);
  if (!match || !isValidDate(today)) return null;

  const dateFor = (year) => `${year}-${String(match.month).padStart(2, '0')}-${String(match.day).padStart(2, '0')}`;
  if (match.year) return dateFor(Number(match.year));

  const currentYear = Number(today.slice(0, 4));
  for (let year = currentYear; year <= currentYear + 8; year++) {
    const candidate = dateFor(year);
    if (isValidDate(candidate) && candidate >= today) return candidate;
  }
  return dateFor(currentYear);
}

function dateFromText(text, today) {
  const explicitDate = String(text || '').match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (explicitDate) return explicitDate[0];
  const monthDate = monthDateFromText(text, today);
  if (monthDate) return monthDate;

  const relativeDate = String(text || '').match(/\b(today|tomorrow)\b/i);
  if (relativeDate && isValidDate(today)) {
    const date = new Date(today + 'T00:00:00.000Z');
    if (relativeDate[1].toLowerCase() === 'tomorrow') date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  const weekdayMatch = String(text || '').match(
    /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
  );
  if (!weekdayMatch || !isValidDate(today)) return null;

  const targetDay = WEEKDAYS.findIndex((day) => day.toLowerCase() === weekdayMatch[1].toLowerCase());
  const currentDate = new Date(today + 'T00:00:00.000Z');
  let offset = (targetDay - currentDate.getUTCDay() + 7) % 7;
  if (offset === 0 && /\bnext\b/i.test(String(text || ''))) offset = 7;
  currentDate.setUTCDate(currentDate.getUTCDate() + offset);
  return currentDate.toISOString().slice(0, 10);
}

function weekdayForDate(date) {
  return WEEKDAYS[new Date(date + 'T00:00:00.000Z').getUTCDay()];
}

function isBookingIntent(value) {
  const text = String(value || '');
  return (
    (BOOKING_INTENT_RE.test(text) && ROOM_RE.test(text)) ||
    /(?:बुक|आरक्षण|आरक्षित|बुकिंग).*(?:कमरा|खोली|रूम)|(?:कमरा|खोली|रूम).*(?:बुक|आरक्षण|आरक्षित|बुकिंग)/iu.test(text)
  );
}

function isAvailabilityIntent(value) {
  return ROOM_RE.test(String(value || '')) && AVAILABILITY_INTENT_RE.test(String(value || ''));
}

function hasBookingDatePrompt(history) {
  return (Array.isArray(history) ? history : []).slice(-6).some((message) =>
    message.sender === 'ai' &&
    /future booking date in YYYY-MM-DD|could not confirm a valid future date/i.test(message.body || '')
  );
}

function hasAvailabilityDatePrompt(history) {
  return (Array.isArray(history) ? history : []).slice(-6).some((message) =>
    message.sender === 'ai' &&
    /date or weekday should I check for room availability/i.test(message.body || '')
  );
}

function todayInGoa() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function createRoomBookingService({
  store,
  getRoomRate = async () => null,
  makePaymentReference = () => 'ROOM-' + crypto.randomBytes(6).toString('hex').toUpperCase(),
  today = todayInGoa,
  now = () => Date.now(),
  pendingLifetimeMs = 15 * 60 * 1000,
}) {
  if (!store) throw new Error('A room booking store is required');

  const pendingBookings = new Map();
  const result = (reply, language, payment = null) => ({ reply, language, payment });

  function clearExpired() {
    const time = now();
    for (const [phone, booking] of pendingBookings) {
      if (booking.expiresAt <= time) pendingBookings.delete(phone);
    }
  }

  function hasPending(phone) {
    clearExpired();
    return pendingBookings.has(normalizePhone(phone));
  }

  async function offerRoom(phone, booking, date) {
    const availableRooms = await findAvailableRooms(date);
    const roomNumber = availableRooms[0];
    if (!roomNumber) {
      pendingBookings.delete(phone);
      return result(`No room is available on ${date}. Please request another date.`, booking.language);
    }

    booking.phase = 'awaiting_booking_choice';
    booking.date = date;
    booking.roomNumber = roomNumber;
    booking.expiresAt = now() + pendingLifetimeMs;
    pendingBookings.set(phone, booking);
    const dateLabel = `${weekdayForDate(date)}, ${date}`;
    return result(
      `Room ${roomNumber} is available for ${dateLabel}. Would you like to book it?`,
      booking.language
    );
  }

  async function findAvailableRooms(date) {
    const occupied = await store.listRoomBookings(date, nextDate(date));
    const occupiedRooms = new Set(occupied.map((item) => Number(item.room_number)));
    return ROOM_NUMBERS.filter((room) => !occupiedRooms.has(room));
  }

  function parseGuestCount(text) {
    const value = String(text || '').trim().toLowerCase();
    const numberMatch = value.match(/^(?:(?:we are|there are|for)\s+)?(\d{1,2})(?:\s*(?:people|persons?|guests?|adults?))?[.! ]*$/i);
    if (numberMatch) return Number(numberMatch[1]);
    const wordMatch = value.match(/^(?:(?:we are|there are|for)\s+)?(one|two|three|four|five|six)(?:\s+(?:people|persons?|guests?|adults?))?[.! ]*$/i);
    return wordMatch ? { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[wordMatch[1]] : null;
  }

  function isAffirmative(text) {
    return isThumbsUp(text) || /^(?:yes|yeah|yep|sure|okay|ok|pay|pay now|proceed|confirm)(?:\s+please)?[.! ]*$/i.test(String(text || '').trim());
  }

  function isNegative(text) {
    return /^(?:no|no thanks|not now|later|cancel|don't|do not)[.! ]*$/i.test(String(text || '').trim());
  }

  async function checkAvailability(date, language, query, phone, guestName) {
    if (!date || !isValidDate(date)) {
      return result('Which date or weekday should I check for room availability?', language);
    }
    const availableRooms = await findAvailableRooms(date);
    const label = `${weekdayForDate(date)}, ${date}`;
    const requestedRoom = String(query || '').match(/\brooms?\s*(10[1-9])\b/i);
    const offerBooking = (roomNumber, message) => {
      pendingBookings.set(phone, {
        phase: 'awaiting_booking_choice',
        language,
        guestName,
        date,
        roomNumber,
        expiresAt: now() + pendingLifetimeMs,
      });
      return result(message, language);
    };
    if (requestedRoom) {
      const roomNumber = Number(requestedRoom[1]);
      if (!availableRooms.includes(roomNumber)) {
        return result(`Room ${roomNumber} is occupied on ${label}.`, language);
      }
      return offerBooking(
        roomNumber,
        `Room ${roomNumber} is available on ${label}. Would you like to book it? Reply yes or no.`
      );
    }
    if (!availableRooms.length) {
      return result(`The guest calendar shows all 9 rooms occupied on ${label}.`, language);
    }
    const firstRoom = availableRooms[0];
    return offerBooking(
      firstRoom,
      `The guest calendar shows ${availableRooms.length} of 9 rooms available on ${label}: ` +
        `${availableRooms.map((room) => `Room ${room}`).join(', ')}. ` +
        `Room ${firstRoom} is the first available. Would you like to book it? Reply yes or no.`
    );
  }

  async function confirmGuestReportedPayment(phone, booking) {
    const targetRooms = booking.roomNumbers || [booking.roomNumber];
    let saved = null;
    for (const [index, roomNumber] of targetRooms.entries()) {
      saved = await store.reserveRoom({
      bookingDate: booking.date,
      roomNumber,
      guestPhone: phone,
      guestName: booking.guestName,
      amountInr: booking.amount,
      mockTransactionId: null,
      paymentReference: targetRooms.length > 1 ? `${booking.paymentReference}-${index + 1}` : booking.paymentReference,
      paymentStatus: 'pending_verification',
      });
      if (!saved) break;
    }
    pendingBookings.delete(phone);
    if (!saved) {
      return result(
        `Room ${booking.roomNumber} was just taken, so I could not record the booking. Your payment has not been verified; please contact staff with payment reference ${booking.paymentReference}.`,
        booking.language
      );
    }

    return result(
      `I’ve recorded your room request pending staff verification of the payment.\n` +
        `Guest: ${saved.guest_name || booking.guestName || 'Guest'}\n` +
        `Phone: ${saved.guest_phone || phone}\n` +
        `Rooms: ${(booking.roomNumbers || [saved.room_number]).join(', ')}\n` +
        `Date: ${saved.booking_date}\n` +
        `Guests: ${booking.guestCount}\n` +
        `Cost: ₹${Number(saved.amount_inr).toFixed(2)}\n` +
        `Payment reference: ${saved.payment_reference}\n` +
        `The 👍 only reports that you paid; payment is not verified until staff confirms it.`,
      booking.language
    );
  }

  async function handleMessage({
    phone: rawPhone,
    guestName = null,
    text = '',
    englishText = text,
    language = null,
    history = [],
  }) {
    clearExpired();
    const phone = normalizePhone(rawPhone);
    const normalizedText = String(text || '').trim();
    const interpretedText = String(englishText || '').trim();
    let booking = pendingBookings.get(phone);
    const currentDate = today();
    const date = dateFromText(normalizedText, currentDate) || dateFromText(interpretedText, currentDate);
    const bookingIntent = isBookingIntent(interpretedText) ||
      (BOOKING_INTENT_RE.test(interpretedText) && date !== null) ||
      hasBookingDatePrompt(history);
    const availabilityIntent = isAvailabilityIntent(interpretedText) || hasAvailabilityDatePrompt(history);
    if (booking?.phase === 'awaiting_booking_choice' && isAvailabilityIntent(interpretedText)) {
      pendingBookings.delete(phone);
      booking = null;
    }
    if (!booking && !bookingIntent && !availabilityIntent) return null;

    const replyLanguage = language && language !== 'Unknown' ? language : booking?.language || 'English';
    if (!booking && availabilityIntent && !bookingIntent) {
      return checkAvailability(date, replyLanguage, interpretedText, phone, guestName);
    }

    if (!booking) {
      booking = {
        phase: 'awaiting_date',
        language: replyLanguage,
        guestName,
        expiresAt: now() + pendingLifetimeMs,
      };
    } else {
      booking.language = replyLanguage;
      booking.guestName = booking.guestName || guestName;
      booking.expiresAt = now() + pendingLifetimeMs;
    }

    if (booking.phase === 'awaiting_booking_choice') {
      if (isNegative(interpretedText) || isNegative(normalizedText)) {
        pendingBookings.delete(phone);
        return result('Okay, I have not booked the room. You can ask me to check availability again anytime.', booking.language);
      }
      if (isAffirmative(interpretedText) || isAffirmative(normalizedText)) {
        booking.phase = 'awaiting_room_count';
        booking.expiresAt = now() + pendingLifetimeMs;
        pendingBookings.set(phone, booking);
        return result(
          `How many rooms would you like? There are 9 numbered rooms; I’ll check availability for your selected date.`,
          booking.language
        );
      }
      pendingBookings.set(phone, booking);
      return result(`Would you like to book Room ${booking.roomNumber}? Reply yes or no.`, booking.language);
    }

    if (booking.phase === 'awaiting_room_count') {
      const rooms = (booking.roomsLeft && (isAffirmative(interpretedText) || isAffirmative(normalizedText))) ? booking.roomsLeft : Number((interpretedText.match(/^\s*(\d+)\s*(?:rooms?)?\s*$/i) || normalizedText.match(/^\s*(\d+)\s*(?:rooms?)?\s*$/i) || [])[1]);
      if (!Number.isInteger(rooms) || rooms < 1) return result('How many rooms would you like?', booking.language);
      const available = await findAvailableRooms(booking.date);
      if (rooms > available.length) { booking.roomsLeft = available.length; pendingBookings.set(phone, booking); return result(`Only ${available.length} rooms are available. Would you like to proceed with ${available.length}?`, booking.language); }
      booking.roomNumbers = available.slice(0, rooms);
      booking.phase = 'awaiting_guest_count'; pendingBookings.set(phone, booking);
      return result('How many guests will stay?', booking.language);
    }

    if (booking.phase === 'awaiting_guest_count') {
      const guestCount = parseGuestCount(interpretedText) ?? parseGuestCount(normalizedText);
      if (!guestCount) {
        return result('Please tell me how many guests will stay so I can check the matching knowledge-base price.', booking.language);
      }
      const rate = await getRoomRate({ roomCount: booking.roomNumbers?.length || 1, nights: 1, guestCount });
      if (!rate || !Number.isFinite(rate.amount) || rate.amount <= 0) {
        return result(
          `The knowledge base has no confirmed price for 1 room, 1 night, and ${guestCount} guest${guestCount === 1 ? '' : 's'}. I can’t guess a payment amount; please ask staff for the correct rate.`,
          booking.language
        );
      }
      booking.guestCount = guestCount;
      booking.amount = rate.amount;
      booking.rateSource = rate.source;
      booking.phase = 'awaiting_total_confirmation';
      pendingBookings.set(phone, booking);
      return result(
        `Date: ${booking.date} (1 night)\nRooms: ${booking.roomNumbers?.length || 1} × ${booking.roomNumbers?.join(', ') || booking.roomNumber}\nKnowledge-base total: ₹${booking.amount.toFixed(2)}\nTax details are not listed in the knowledge base. Please confirm this total before payment.`,
        booking.language
      );
    }

    if (booking.phase === 'awaiting_total_confirmation') {
      if (isNegative(interpretedText) || isNegative(normalizedText)) { pendingBookings.delete(phone); return result('No payment QR was created. Tell me what you would like to change.', booking.language); }
      if (!isAffirmative(interpretedText) && !isAffirmative(normalizedText)) return result(`Please confirm the total of ₹${booking.amount.toFixed(2)} before payment.`, booking.language);
      booking.phase = 'awaiting_payment_choice'; pendingBookings.set(phone, booking);
      return result(`Total confirmed: ₹${booking.amount.toFixed(2)}. Would you like the payment QR?`, booking.language);
    }

    if (booking.phase === 'awaiting_payment_choice') {
      if (isNegative(interpretedText) || isNegative(normalizedText)) {
        pendingBookings.delete(phone);
        return result('No payment QR was created and the room has not been reserved. You can ask me to check availability again anytime.', booking.language);
      }
      if (isAffirmative(interpretedText) || isAffirmative(normalizedText)) {
        booking.paymentReference = makePaymentReference();
        booking.phase = 'awaiting_payment_confirmation';
        pendingBookings.set(phone, booking);
        return result(
          `The UPI QR is for ₹${booking.amount.toFixed(2)} for Room ${booking.roomNumber} on ${booking.date}. ` +
            `Verify the recipient and amount in your UPI app before approving. After paying, reply 👍. I cannot verify the transfer automatically.`,
          booking.language,
          { orderId: booking.paymentReference, amount: booking.amount }
        );
      }
      pendingBookings.set(phone, booking);
      return result('Would you like to pay now and receive the UPI QR? Reply yes or no.', booking.language);
    }

    if (booking.phase === 'awaiting_payment_confirmation') {
      if (isThumbsUp(normalizedText)) return confirmGuestReportedPayment(phone, booking);
      pendingBookings.set(phone, booking);
      return result(
        `Room ${booking.roomNumber} is awaiting payment for ₹${booking.amount.toFixed(2)}. ` +
          `Scan the UPI QR and reply 👍 after paying. Staff must verify the transfer; I cannot verify it automatically.`,
        booking.language
      );
    }

    if (!date || !isValidDate(date) || date < currentDate) {
      booking.phase = 'awaiting_date';
      pendingBookings.set(phone, booking);
      return result(
        'I could not confirm a valid future date. Please send the date with its month and year, for example 22 November 2026, so I can check room availability.',
        booking.language
      );
    }
    return offerRoom(phone, booking, date);
  }

  function cancel(phone) {
    pendingBookings.delete(normalizePhone(phone));
  }

  async function confirmGuestPayment(phone, paymentReference) {
    clearExpired();
    const normalizedPhone = normalizePhone(phone);
    const booking = pendingBookings.get(normalizedPhone);
    if (
      !booking ||
      booking.phase !== 'awaiting_payment_confirmation' ||
      booking.paymentReference !== paymentReference
    ) return null;
    return confirmGuestReportedPayment(normalizedPhone, booking);
  }

  return { handleMessage, hasPending, cancel, confirmGuestPayment, isBookingIntent, isAvailabilityIntent };
}

module.exports = { createRoomBookingService };
