// ✅ File: utils/validate.js
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.toLowerCase());
}

export function validatePassword(password) {
  return password.length >= 8;
}

export function validateFullName(name) {
  return name.trim().length >= 3;
}


