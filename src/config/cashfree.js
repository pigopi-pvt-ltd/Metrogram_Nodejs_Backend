import pkg from 'cashfree-pg';
const { Cashfree, CFEnvironment } = pkg;

/**
 * Get configured Cashfree Environment (SANDBOX or PRODUCTION)
 */
export const getCashfreeEnvironment = () => {
  const env = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase().trim();
  return env === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
};

/**
 * Get initialized Cashfree SDK client instance
 */
export const getCashfreeClient = () => {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET;

  if (!appId || !secret) {
    throw new Error('Cashfree credentials missing. Please set CASHFREE_APP_ID and CASHFREE_SECRET in environment.');
  }

  const env = getCashfreeEnvironment();
  const client = new Cashfree(env, appId, secret);

  if (process.env.CASHFREE_API_VERSION) {
    client.XApiVersion = process.env.CASHFREE_API_VERSION;
  }

  return client;
};

export default {
  getCashfreeClient,
  getCashfreeEnvironment,
};
