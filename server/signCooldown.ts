export function signatureCooldown(error: any): number {
  const message = error?.message || error?.exception?.message || '';
  if (!/rate.?limit|Too many connections/i.test(message)) return 0;
  return /account_day/.test(message) ? 86400000 : /account_hour/.test(message) ? 3600000 : 60000;
}
