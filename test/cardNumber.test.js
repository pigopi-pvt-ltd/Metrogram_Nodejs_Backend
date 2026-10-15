import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/modules/user/user.model.js';
import Customer from '../src/modules/customer/customer.model.js';
import CardPlan from '../src/modules/card/cardPlan.model.js';

let server;
let baseUrl;

async function request(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', {
    body: { email, password }
  });
  if (res.status !== 200) {
    throw new Error(`Failed to login as ${email}: ${res.data?.message}`);
  }
  return res.data.token;
}

describe('Health Card Number Generation: Manual (MG-YEA-<manual>) vs Self-Purchase (MG-YEA-<random>)', () => {
  let superAdminToken;
  let yearlyPlan;
  let testCustomer1;
  let testCustomer2;
  let testCustomer1Token;
  let createdUsers = [];

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/user_management_db';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'boss@company.com').toLowerCase();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123456';
    superAdminToken = await login(superAdminEmail, superAdminPassword);

    // Find or create yearly card plan
    yearlyPlan = await CardPlan.findOne({ planType: 'YEARLY', isActive: true });
    if (!yearlyPlan) {
      yearlyPlan = await CardPlan.create({
        name: 'MetroGram Test Gold Card Plan',
        planType: 'YEARLY',
        price: 999,
        validityInDays: 365,
        description: 'Test card plan',
        benefits: ['Discount on tests', 'Free consultation'],
        discountPercentage: 20,
        isActive: true
      });
    }

    // Create test customer 1
    const ts = Date.now();
    const cust1Res = await request('POST', '/api/customers', {
      token: superAdminToken,
      body: {
        firstName: 'CardUser',
        lastName: 'One',
        email: `carduser1_${ts}@test.com`,
        password: 'Password@123456',
        phoneNumber: '9876543201',
        customerCode: `CUST-${ts}-1`
      }
    });
    testCustomer1 = cust1Res.data.data;
    createdUsers.push(testCustomer1._id);

    // Create test customer 2
    const cust2Res = await request('POST', '/api/customers', {
      token: superAdminToken,
      body: {
        firstName: 'CardUser',
        lastName: 'Two',
        email: `carduser2_${ts}@test.com`,
        password: 'Password@123456',
        phoneNumber: '9876543202',
        customerCode: `CUST-${ts}-2`
      }
    });
    testCustomer2 = cust2Res.data.data;
    createdUsers.push(testCustomer2._id);

    // Login as Customer 1 for self-purchase test
    testCustomer1Token = await login(`carduser1_${ts}@test.com`, 'Password@123456');
  });

  afterAll(async () => {
    for (const uid of createdUsers) {
      await User.findByIdAndDelete(uid);
      await Customer.deleteOne({ user: uid });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Customer Self-Purchase: Generates random number starting with MG-YEA-<random>', async () => {
    const res = await request('POST', '/api/cards/purchase', {
      token: testCustomer1Token,
      body: {
        cardPlanId: yearlyPlan._id
      }
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);

    const cardNumber = res.data.data.activeCard.cardNumber;
    expect(cardNumber).toBeDefined();
    expect(cardNumber.startsWith('MG-YEA-')).toBe(true);

    // Ensure the suffix after MG-YEA- is a 6-digit random number
    const suffix = cardNumber.replace('MG-YEA-', '');
    expect(suffix.length).toBeGreaterThanOrEqual(6);
    expect(/^\d+$/.test(suffix)).toBe(true);
  });

  test('2. Staff Card Assignment: Supports manual inserted card number (suffix only)', async () => {
    const manualNumber = '789123';
    const res = await request('POST', '/api/cards/assign', {
      token: superAdminToken,
      body: {
        customerUserId: testCustomer2._id,
        cardPlanId: yearlyPlan._id,
        cardNumber: manualNumber,
        paymentMethod: 'CASH'
      }
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);

    const cardNumber = res.data.data.activeCard.cardNumber;
    expect(cardNumber).toBe(`MG-YEA-${manualNumber}`);

    const customerDoc = await Customer.findOne({ user: testCustomer2._id });
    expect(customerDoc.activeCard.cardNumber).toBe(`MG-YEA-${manualNumber}`);
  });

  test('3. Staff Card Assignment: Rejects duplicate card number with 400 error', async () => {
    // Attempt to assign the exact same card number to another customer
    // First create customer 3
    const ts = Date.now();
    const cust3Res = await request('POST', '/api/customers', {
      token: superAdminToken,
      body: {
        firstName: 'CardUser',
        lastName: 'Three',
        email: `carduser3_${ts}@test.com`,
        password: 'Password@123456',
        phoneNumber: '9876543203',
        customerCode: `CUST-${ts}-3`
      }
    });
    const testCustomer3 = cust3Res.data.data;
    createdUsers.push(testCustomer3._id);

    // Try to assign '789123' again
    const res = await request('POST', '/api/cards/assign', {
      token: superAdminToken,
      body: {
        customerUserId: testCustomer3._id,
        cardPlanId: yearlyPlan._id,
        cardNumber: '789123',
        paymentMethod: 'CASH'
      }
    });

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toContain('already assigned to another customer');
  });

  test('4. Staff Card Assignment: Normalizes full string like mg-yea-456789 into MG-YEA-456789', async () => {
    // Create customer 4
    const ts = Date.now();
    const cust4Res = await request('POST', '/api/customers', {
      token: superAdminToken,
      body: {
        firstName: 'CardUser',
        lastName: 'Four',
        email: `carduser4_${ts}@test.com`,
        password: 'Password@123456',
        phoneNumber: '9876543204',
        customerCode: `CUST-${ts}-4`
      }
    });
    const testCustomer4 = cust4Res.data.data;
    createdUsers.push(testCustomer4._id);

    const res = await request('POST', '/api/cards/assign', {
      token: superAdminToken,
      body: {
        customerUserId: testCustomer4._id,
        cardPlanId: yearlyPlan._id,
        cardNumber: 'mg-yea-456789',
        paymentMethod: 'CASH'
      }
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.activeCard.cardNumber).toBe('MG-YEA-456789');
  });

  test('5. Staff Card Assignment: Omitting cardNumber auto-generates unique random MG-YEA-...', async () => {
    // Create customer 5
    const ts = Date.now();
    const cust5Res = await request('POST', '/api/customers', {
      token: superAdminToken,
      body: {
        firstName: 'CardUser',
        lastName: 'Five',
        email: `carduser5_${ts}@test.com`,
        password: 'Password@123456',
        phoneNumber: '9876543205',
        customerCode: `CUST-${ts}-5`
      }
    });
    const testCustomer5 = cust5Res.data.data;
    createdUsers.push(testCustomer5._id);

    const res = await request('POST', '/api/cards/assign', {
      token: superAdminToken,
      body: {
        customerUserId: testCustomer5._id,
        cardPlanId: yearlyPlan._id,
        paymentMethod: 'CASH'
        // cardNumber omitted
      }
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.activeCard.cardNumber.startsWith('MG-YEA-')).toBe(true);
  });
});
