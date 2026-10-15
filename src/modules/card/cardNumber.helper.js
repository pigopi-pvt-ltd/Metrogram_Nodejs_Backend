import Customer from '../customer/customer.model.js';

/**
 * Generate standard card prefix for a plan type
 * e.g. 'YEARLY' -> 'MG-YEA-'
 * e.g. 'MONTHLY' -> 'MG-MON-'
 * e.g. 'QUARTERLY' -> 'MG-QUA-'
 */
export function getCardPrefix(planType = 'YEARLY') {
  const typeCode = String(planType || 'YEARLY').trim().substring(0, 3).toUpperCase();
  return `MG-${typeCode}-`;
}

/**
 * Generate a unique random card number for customer self-purchase
 * Format: MG-<TYPE>-<RANDOM_NUMBER> (e.g. MG-YEA-749216)
 */
export async function generateUniqueCardNumber(planType = 'YEARLY') {
  const prefix = getCardPrefix(planType);
  let attempts = 0;

  while (attempts < 20) {
    attempts++;
    // Generate 6-digit random number
    const randomNumber = Math.floor(100000 + Math.random() * 900000).toString();
    const candidate = `${prefix}${randomNumber}`;

    const existing = await Customer.findOne({
      $or: [
        { 'activeCard.cardNumber': candidate },
        { 'cardHistory.cardNumber': candidate }
      ]
    });

    if (!existing) {
      return candidate;
    }
  }

  // Fallback if random attempts collide
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

/**
 * Resolve and validate card number:
 * - If manualInput is provided by employee/admin:
 *   Validates, formats with prefix `MG-<TYPE>-<MANUAL_NUMBER>`, and checks uniqueness.
 * - If manualInput is NOT provided (or empty):
 *   Generates a unique random number `MG-<TYPE>-<RANDOM_NUMBER>`.
 *
 * @param {string} planType - 'YEARLY' | 'MONTHLY' | 'QUARTERLY'
 * @param {string|number} manualInput - Manually inserted number or full card string
 * @returns {Promise<string>} Formatted unique card number
 */
export async function resolveCardNumber(planType = 'YEARLY', manualInput = null) {
  const prefix = getCardPrefix(planType);
  let cleanInput = String(manualInput ?? '').trim();

  if (!cleanInput) {
    return await generateUniqueCardNumber(planType);
  }

  // Strip redundant prefixes like 'MG-YEA-', 'mg-yea-', 'MC-YEA-', etc.
  const typeCode = String(planType || 'YEARLY').trim().substring(0, 3).toUpperCase();
  const prefixRegex = new RegExp(`^(?:MG|MC)[-_]?(?:${typeCode}|[A-Z]{3})[-_]?`, 'i');
  cleanInput = cleanInput.replace(prefixRegex, '').trim();

  // Remove whitespace and leading/trailing dashes
  cleanInput = cleanInput.replace(/\s+/g, '').replace(/^[-_]+|[-_]+$/g, '');

  if (!cleanInput) {
    return await generateUniqueCardNumber(planType);
  }

  const candidate = `${prefix}${cleanInput.toUpperCase()}`;

  // Check uniqueness across all customers in database
  const existing = await Customer.findOne({
    $or: [
      { 'activeCard.cardNumber': candidate },
      { 'cardHistory.cardNumber': candidate }
    ]
  });

  if (existing) {
    const err = new Error(`Card number "${candidate}" is already assigned to another customer. Please enter a unique card number.`);
    err.statusCode = 400;
    throw err;
  }

  return candidate;
}
