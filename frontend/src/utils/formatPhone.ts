/**
 * Format phone for display: space after country code, dashes every 3 digits.
 * e.g. +19057451970 → +1 905-745-1970
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone || typeof phone !== 'string') return phone;
  const s = phone.trim();
  const digits = s.replace(/\D/g, '');
  const hasPlus = s.startsWith('+');

  // North American: +1 and 10 digits → +1 XXX-XXX-XXXX
  if (digits.length === 11 && digits.startsWith('1')) {
    const rest = digits.slice(1);
    return (hasPlus ? '+1 ' : '1 ') + `${rest.slice(0, 3)}-${rest.slice(3, 6)}-${rest.slice(6)}`;
  }
  if (digits.length === 10) {
    return (hasPlus ? '+1 ' : '') + `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Other lengths: space after country code, then dash every 3 digits
  if (hasPlus && digits.length > 0) {
    const cc = digits.startsWith('1') && digits.length > 10 ? digits.slice(0, 1) : digits.length > 10 ? digits.slice(0, 2) : '';
    const rest = cc ? digits.slice(cc.length) : digits;
    const grouped = rest.replace(/(\d{3})(?=\d)/g, '$1-');
    return (cc ? '+' + cc + ' ' : '+') + grouped;
  }
  if (digits.length > 0) {
    return digits.replace(/(\d{3})(?=\d)/g, '$1-');
  }
  return phone;
}
