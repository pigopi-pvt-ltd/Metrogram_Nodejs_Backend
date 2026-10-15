import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/modules/user/user.model.js';
import FranchiseEnquiry from '../src/modules/franchise/franchise.model.js';

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

describe('Franchise Enquiry System & Super Admin Access', () => {
  let superAdminToken;
  let testEnquiryId;

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
  });

  afterAll(async () => {
    if (testEnquiryId) {
      await FranchiseEnquiry.findByIdAndDelete(testEnquiryId);
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('Public submission: rejects submission when required fields are missing', async () => {
    const res = await request('POST', '/api/franchise', {
      body: {
        name: 'Rahul Sharma',
        email: 'rahul@example.com'
        // Missing mobile, location, occupation, address with code
      }
    });

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toContain('Please provide all required fields');
  });

  test('Public submission: rejects invalid email address', async () => {
    const res = await request('POST', '/api/franchise', {
      body: {
        name: 'Rahul Sharma',
        email: 'invalid-email',
        mobile: '9876543210',
        location: 'Patna, Bihar',
        currentOccupation: 'Pharmacist',
        address: 'Boring Road, Near Canal',
        code: '800001'
      }
    });

    expect(res.status).toBe(400);
    expect(res.data.success).toBe(false);
    expect(res.data.message).toContain('valid email address');
  });

  test('Public submission: successfully submits franchise enquiry with all fields', async () => {
    const res = await request('POST', '/api/franchise', {
      body: {
        Name: 'Dr. Ramesh Verma',
        Email: 'ramesh.verma@example.com',
        Mobile: '+91 9876543210',
        Location: 'Kankarbagh, Patna',
        'Current occupation': 'Senior Pathologist & Clinic Owner',
        Address: 'House No. 42, Main Road, Kankarbagh',
        code: '800020'
      }
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.data.enquiryCode).toBeDefined();
    expect(res.data.data.enquiryCode.startsWith('FRN-')).toBe(true);
    expect(res.data.data.fullName).toBe('Dr. Ramesh Verma');
    expect(res.data.data.email).toBe('ramesh.verma@example.com');
    expect(res.data.data.phone).toBe('+91 9876543210');
    expect(res.data.data.location).toBe('Kankarbagh, Patna');
    expect(res.data.data.currentOccupation).toBe('Senior Pathologist & Clinic Owner');
    expect(res.data.data.addressWithCode).toContain('House No. 42, Main Road, Kankarbagh');
    expect(res.data.data.addressWithCode).toContain('800020');
    expect(res.data.data.status).toBe('PENDING');

    const createdDoc = await FranchiseEnquiry.findOne({ email: 'ramesh.verma@example.com' });
    expect(createdDoc).toBeDefined();
    testEnquiryId = createdDoc._id.toString();
  });

  test('Super Admin Access: unauthenticated request to /api/franchise is rejected', async () => {
    const res = await request('GET', '/api/franchise');
    expect(res.status).toBe(401);
    expect(res.data.success).toBe(false);
  });

  test('Super Admin Access: Super Admin can list franchise enquiries', async () => {
    const res = await request('GET', '/api/franchise', {
      token: superAdminToken
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
    const found = res.data.data.find(e => e._id.toString() === testEnquiryId);
    expect(found).toBeDefined();
    expect(found.fullName).toBe('Dr. Ramesh Verma');
  });

  test('Super Admin Access: Super Admin can view enquiry stats', async () => {
    const res = await request('GET', '/api/franchise/stats', {
      token: superAdminToken
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.total).toBeGreaterThanOrEqual(1);
    expect(res.data.data.pending).toBeGreaterThanOrEqual(1);
  });

  test('Super Admin Access: Super Admin can view single enquiry by ID', async () => {
    const res = await request('GET', `/api/franchise/${testEnquiryId}`, {
      token: superAdminToken
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.fullName).toBe('Dr. Ramesh Verma');
    expect(res.data.data.location).toBe('Kankarbagh, Patna');
  });

  test('Super Admin Access: Super Admin can update enquiry status and admin remarks', async () => {
    const res = await request('PATCH', `/api/franchise/${testEnquiryId}/status`, {
      token: superAdminToken,
      body: {
        status: 'CONTACTED',
        adminNotes: 'Spoke with Dr. Ramesh. Scheduled in-person discovery meeting for Saturday.'
      }
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.status).toBe('CONTACTED');
    expect(res.data.data.adminNotes).toContain('Scheduled in-person discovery meeting');
    expect(res.data.data.contactedAt).toBeDefined();
  });

  test('Dashboard Integration: Super Admin dashboard stats include franchise metrics', async () => {
    const res = await request('GET', '/api/dashboard/stats', {
      token: superAdminToken
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.data.summary.totalFranchiseEnquiries).toBeGreaterThanOrEqual(1);
    expect(res.data.data.recentFranchiseEnquiries).toBeDefined();
  });

  test('Super Admin Access: Super Admin can delete an enquiry', async () => {
    const res = await request('DELETE', `/api/franchise/${testEnquiryId}`, {
      token: superAdminToken
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);

    const doc = await FranchiseEnquiry.findById(testEnquiryId);
    expect(doc).toBeNull();
    testEnquiryId = null;
  });
});
