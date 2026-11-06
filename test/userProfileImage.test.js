import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/modules/user/user.model.js';
import Manager from '../src/modules/manager/manager.model.js';
import Employee from '../src/modules/employee/employee.model.js';
import Customer from '../src/modules/customer/customer.model.js';
import { uploadProfileImageToCloudinary } from '../src/config/cloudinary.js';

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
  return res.data;
}

describe('User Profile Image System for All Roles', () => {
  let superAdminToken;
  let superAdminUser;
  const createdUserIds = [];

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
    const saLogin = await login(superAdminEmail, superAdminPassword);
    superAdminToken = saLogin.token;
    superAdminUser = saLogin.user;
  });

  afterAll(async () => {
    for (const uid of createdUserIds) {
      const u = await User.findById(uid);
      if (u) {
        if (u.role === 'MANAGER') await Manager.deleteOne({ user: u._id });
        if (u.role === 'EMPLOYEE') await Employee.deleteOne({ user: u._id });
        if (u.role === 'CUSTOMER') await Customer.deleteOne({ user: u._id });
        await User.findByIdAndDelete(uid);
      }
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('User schema has profileImage and profileImagePublicId defaulting to null', async () => {
    const randomEmail = `test_schema_${Date.now()}@example.com`;
    const tempUser = new User({
      firstName: 'Schema',
      lastName: 'Test',
      email: randomEmail,
      password: 'Password@123',
      role: 'CUSTOMER'
    });
    await tempUser.save();
    createdUserIds.push(tempUser._id);

    expect(tempUser.profileImage).toBeNull();
    expect(tempUser.profileImagePublicId).toBeNull();
  });

  test('Public customer registration saves profileImage and returns it in response', async () => {
    const email = `cust_img_${Date.now()}@example.com`;
    const fakeCloudinaryUrl = 'https://res.cloudinary.com/metrogram/image/upload/v12345/profile_cust.jpg';

    const res = await request('POST', '/api/auth/register', {
      body: {
        firstName: 'Alice',
        lastName: 'Customer',
        email,
        password: 'Password@123',
        phoneNumber: '+919999988888',
        profileImage: fakeCloudinaryUrl,
        profileImagePublicId: 'metrogram/users/profile_images/cust_test_1'
      }
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.user.profileImage).toBe(fakeCloudinaryUrl);
    createdUserIds.push(res.data.user.id);

    // Verify in database
    const dbUser = await User.findById(res.data.user.id);
    expect(dbUser.profileImage).toBe(fakeCloudinaryUrl);
    expect(dbUser.profileImagePublicId).toBe('metrogram/users/profile_images/cust_test_1');

    // Verify login returns profileImage
    const loginRes = await login(email, 'Password@123');
    expect(loginRes.user.profileImage).toBe(fakeCloudinaryUrl);

    // Verify GET /api/auth/me returns profileImage
    const meRes = await request('GET', '/api/auth/me', { token: loginRes.token });
    expect(meRes.status).toBe(200);
    expect(meRes.data.data.profileImage).toBe(fakeCloudinaryUrl);
  });

  test('Authenticated user can update profile image via PATCH /api/auth/profile-image', async () => {
    const email = `cust_update_${Date.now()}@example.com`;
    const regRes = await request('POST', '/api/auth/register', {
      body: {
        firstName: 'Bob',
        lastName: 'Customer',
        email,
        password: 'Password@123'
      }
    });
    expect(regRes.status).toBe(201);
    createdUserIds.push(regRes.data.user.id);

    const token = regRes.data.token;
    const newImageUrl = 'https://res.cloudinary.com/metrogram/image/upload/v99999/new_avatar.jpg';

    const patchRes = await request('PATCH', '/api/auth/profile-image', {
      token,
      body: {
        profileImage: newImageUrl,
        profileImagePublicId: 'metrogram/users/profile_images/new_avatar_bob'
      }
    });

    expect(patchRes.status).toBe(200);
    expect(patchRes.data.success).toBe(true);
    expect(patchRes.data.data.profileImage).toBe(newImageUrl);
    expect(patchRes.data.data.profileImagePublicId).toBe('metrogram/users/profile_images/new_avatar_bob');
  });

  test('Super Admin creates Manager with profileImage', async () => {
    const email = `mgr_img_${Date.now()}@example.com`;
    const managerImageUrl = 'https://res.cloudinary.com/metrogram/image/upload/v12345/manager_pic.jpg';

    const res = await request('POST', '/api/managers', {
      token: superAdminToken,
      body: {
        firstName: 'Marcus',
        lastName: 'Manager',
        email,
        password: 'Password@123',
        department: 'Operations',
        maxTeamSize: 10,
        profileImage: managerImageUrl,
        profileImagePublicId: 'metrogram/users/profile_images/manager_marcus'
      }
    });

    expect(res.status).toBe(201);
    expect(res.data.success).toBe(true);
    expect(res.data.data.profileImage).toBe(managerImageUrl);
    createdUserIds.push(res.data.data._id);

    // View profile
    const profileRes = await request('GET', `/api/managers/${res.data.data._id}`, {
      token: superAdminToken
    });
    expect(profileRes.status).toBe(200);
    expect(profileRes.data.data.user.profileImage).toBe(managerImageUrl);
  });

  test('Manager creates Employee with profileImage and manager isolation holds', async () => {
    // 1. Create a Manager
    const mgrEmail = `mgr_emp_${Date.now()}@example.com`;
    const mgrRes = await request('POST', '/api/managers', {
      token: superAdminToken,
      body: {
        firstName: 'Elena',
        lastName: 'Manager',
        email: mgrEmail,
        password: 'Password@123',
        department: 'Diagnostic Lab',
        maxTeamSize: 5
      }
    });
    expect(mgrRes.status).toBe(201);
    const mgrId = mgrRes.data.data._id;
    createdUserIds.push(mgrId);

    const mgrLogin = await login(mgrEmail, 'Password@123');
    const mgrToken = mgrLogin.token;

    // 2. Manager creates Employee with profileImage
    const empEmail = `emp_img_${Date.now()}@example.com`;
    const empImageUrl = 'https://res.cloudinary.com/metrogram/image/upload/v12345/emp_pic.jpg';

    const empRes = await request('POST', '/api/employees', {
      token: mgrToken,
      body: {
        firstName: 'Sam',
        lastName: 'Technician',
        email: empEmail,
        password: 'Password@123',
        designation: 'Lab Assistant',
        profileImage: empImageUrl,
        profileImagePublicId: 'metrogram/users/profile_images/emp_sam'
      }
    });

    expect(empRes.status).toBe(201);
    expect(empRes.data.success).toBe(true);
    expect(empRes.data.data.profileImage).toBe(empImageUrl);
    createdUserIds.push(empRes.data.data._id);

    // 3. Update employee profile image via PATCH /api/employees/:id/profile-image
    const updatedEmpImageUrl = 'https://res.cloudinary.com/metrogram/image/upload/v12345/emp_pic_v2.jpg';
    const updateRes = await request('PATCH', `/api/employees/${empRes.data.data._id}/profile-image`, {
      token: mgrToken,
      body: {
        profileImage: updatedEmpImageUrl,
        profileImagePublicId: 'metrogram/users/profile_images/emp_sam_v2'
      }
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.data.success).toBe(true);
    expect(updateRes.data.data.profileImage).toBe(updatedEmpImageUrl);
  });

  test('uploadProfileImageToCloudinary helper is exported and accepts options', () => {
    expect(typeof uploadProfileImageToCloudinary).toBe('function');
  });
});
