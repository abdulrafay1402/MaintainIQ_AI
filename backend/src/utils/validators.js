// Shared server-side input validators — every input is validated on the backend
// regardless of what the frontend already checked.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isValidEmail = (value) => typeof value === 'string' && EMAIL_REGEX.test(value.trim());

// Pakistani contact numbers: 12 digits when starting with 92 (e.g. 923001234567),
// 11 digits when starting with 0 (e.g. 03001234567). "+", spaces, and dashes are
// allowed as formatting and stripped before the check.
const isValidPhone = (value) => {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/[^\d]/g, '');
  if (digits.startsWith('92')) return digits.length === 12;
  if (digits.startsWith('0')) return digits.length === 11;
  return false;
};

const OTP_TTL_MS = 60 * 1000; // OTP codes expire after 1 minute

// Date helpers for maintenance rules: completion can never be in the future,
// the next service must be scheduled after today.
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

module.exports = { isValidEmail, isValidPhone, OTP_TTL_MS, endOfToday };
