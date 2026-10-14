import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/modules/user/user.model.js';
import Customer from '../src/modules/customer/customer.model.js';

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

describe('Customer Ownership, Visibility & Assignment System', () => {
  let superAdminToken;
  let opsManagerToken;
  let salesManagerToken;
  let alexEmployeeToken;
  let lisaEmployeeToken;
  let davidEmployeeToken;

  let alexUser;
  let lisaUser;
  let davidUser;
  let emmaUser;
  let selfRegUser;

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

    superAdminToken = await login('boss@company.com', 'SuperAdmin@123456');
    opsManagerToken = await login('manager.ops@company.com', 'Manager@123456');
    salesManagerToken = await login('manager.sales@company.com', 'Manager@123456');
    alexEmployeeToken = await login('employee.alex@company.com', 'Employee@123456');
    lisaEmployeeToken = await login('employee.lisa@company.com', 'Employee@123456');
    davidEmployeeToken = await login('employee.david@company.com', 'Employee@123456');

    alexUser = await User.findOne({ email: 'employee.alex@company.com' });
    lisaUser = await User.findOne({ email: 'employee.lisa@company.com' });
    davidUser = await User.findOne({ email: 'employee.david@company.com' });
    emmaUser = await User.findOne({ email: 'customer.emma@gmail.com' });
    selfRegUser = await User.findOne({ email: 'customer.self@gmail.com' });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  test('Employee can see ONLY customers registered by or assigned to them', async () => {
    const res = await request('GET', '/api/customers', { token: alexEmployeeToken });
    expect(res.status).toBe(200);
    expect(res.data.count).toBeGreaterThanOrEqual(1);

    const customerEmails = res.data.data.map((c) => c.user.email);
    expect(customerEmails).toContain('customer.emma@gmail.com');
    // Cannot see self-registered unassigned customer
    expect(customerEmails).not.toContain('customer.self@gmail.com');
  });

  test("Employee cannot see other employee's customers (even under same manager)", async () => {
    const res = await request('GET', '/api/customers', { token: lisaEmployeeToken });
    expect(res.status).toBe(200);
    expect(res.data.count).toBe(0);
  });

  test("Employee cannot see other employee's customers under different manager", async () => {
    const res = await request('GET', '/api/customers', { token: davidEmployeeToken });
    expect(res.status).toBe(200);
    expect(res.data.count).toBe(0);
  });

  test("Manager sees customers registered by employees under their management", async () => {
    const res = await request('GET', '/api/customers', { token: opsManagerToken });
    expect(res.status).toBe(200);
    expect(res.data.count).toBeGreaterThanOrEqual(1);

    const customerEmails = res.data.data.map((c) => c.user.email);
    expect(customerEmails).toContain('customer.emma@gmail.com');
    // Manager cannot see self-registered customer
    expect(customerEmails).not.toContain('customer.self@gmail.com');
  });

  test('Manager cannot see customers registered by employees under other managers', async () => {
    const res = await request('GET', '/api/customers', { token: salesManagerToken });
    expect(res.status).toBe(200);
    expect(res.data.count).toBe(0);
  });

  test('Self-registered customers do not fall under any employee or manager', async () => {
    const alexRes = await request('GET', `/api/customers/${selfRegUser._id}`, { token: alexEmployeeToken });
    expect(alexRes.status).toBe(403);

    const lisaRes = await request('GET', `/api/customers/${selfRegUser._id}`, { token: lisaEmployeeToken });
    expect(lisaRes.status).toBe(403);

    const davidRes = await request('GET', `/api/customers/${selfRegUser._id}`, { token: davidEmployeeToken });
    expect(davidRes.status).toBe(403);

    const opsMgrRes = await request('GET', `/api/customers/${selfRegUser._id}`, { token: opsManagerToken });
    expect(opsMgrRes.status).toBe(403);

    const salesMgrRes = await request('GET', `/api/customers/${selfRegUser._id}`, { token: salesManagerToken });
    expect(salesMgrRes.status).toBe(403);
  });

  test('Super Admin can view self-registered customers and filter by unassigned', async () => {
    const saRes = await request('GET', '/api/customers?unassigned=true', { token: superAdminToken });
    expect(saRes.status).toBe(200);
    const emails = saRes.data.data.map((c) => c.user.email);
    expect(emails).toContain('customer.self@gmail.com');
  });

  test('Super Admin can assign an employee to a self-registered customer', async () => {
    const assignRes = await request('PATCH', `/api/customers/${selfRegUser._id}/assign-employee`, {
      token: superAdminToken,
      body: { employeeId: davidUser._id }
    });
    expect(assignRes.status).toBe(200);

    // David can now see this customer
    const davidRes = await request('GET', '/api/customers', { token: davidEmployeeToken });
    expect(davidRes.status).toBe(200);
    expect(davidRes.data.count).toBe(1);
    expect(davidRes.data.data[0].user.email).toBe('customer.self@gmail.com');

    // Sales Manager Sarah (David's manager) can now see this customer
    const salesMgrRes = await request('GET', '/api/customers', { token: salesManagerToken });
    expect(salesMgrRes.status).toBe(200);
    expect(salesMgrRes.data.count).toBe(1);

    // Ops team still cannot see this customer
    const alexRes = await request('GET', '/api/customers', { token: alexEmployeeToken });
    const alexEmails = alexRes.data.data.map((c) => c.user.email);
    expect(alexEmails).not.toContain('customer.self@gmail.com');
  });

  test('Super Admin can reassign customer to another employee under different manager', async () => {
    const reassignRes = await request('PATCH', `/api/customers/${selfRegUser._id}/assign-employee`, {
      token: superAdminToken,
      body: { employeeId: lisaUser._id }
    });
    expect(reassignRes.status).toBe(200);

    // Lisa can now see it
    const lisaRes = await request('GET', '/api/customers', { token: lisaEmployeeToken });
    expect(lisaRes.status).toBe(200);
    expect(lisaRes.data.count).toBe(1);
    expect(lisaRes.data.data[0].user.email).toBe('customer.self@gmail.com');

    // David can NO LONGER see it
    const davidRes = await request('GET', '/api/customers', { token: davidEmployeeToken });
    expect(davidRes.data.count).toBe(0);

    // Sales Manager can NO LONGER see it
    const salesMgrRes = await request('GET', '/api/customers', { token: salesManagerToken });
    expect(salesMgrRes.data.count).toBe(0);

    // Ops Manager can now see it
    const opsMgrRes = await request('GET', '/api/customers', { token: opsManagerToken });
    const opsEmails = opsMgrRes.data.data.map((c) => c.user.email);
    expect(opsEmails).toContain('customer.self@gmail.com');
  });

  test('Super Admin can unassign employee from customer', async () => {
    const unassignRes = await request('PATCH', `/api/customers/${selfRegUser._id}/assign-employee`, {
      token: superAdminToken,
      body: { employeeId: null }
    });
    expect(unassignRes.status).toBe(200);

    // Lisa can no longer see it
    const lisaRes = await request('GET', '/api/customers', { token: lisaEmployeeToken });
    expect(lisaRes.data.count).toBe(0);
  });

  test('Dashboard metrics are strictly scoped by team', async () => {
    const davidStats = await request('GET', '/api/dashboard/stats', { token: davidEmployeeToken });
    expect(davidStats.status).toBe(200);
    expect(davidStats.data.data.summary.totalCustomers).toBe(0);

    const salesMgrStats = await request('GET', '/api/dashboard/stats', { token: salesManagerToken });
    expect(salesMgrStats.status).toBe(200);
    expect(salesMgrStats.data.data.summary.totalCustomers).toBe(0);

    const saStats = await request('GET', '/api/dashboard/stats', { token: superAdminToken });
    expect(saStats.status).toBe(200);
    expect(saStats.data.data.summary.unassignedCustomers).toBeGreaterThanOrEqual(1);
  });
});
