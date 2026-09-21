import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import superAdminService from '../modules/superAdmin/superAdmin.service.js';
import managerService from '../modules/manager/manager.service.js';
import employeeService from '../modules/employee/employee.service.js';
import customerService from '../modules/customer/customer.service.js';
import User from '../modules/user/user.model.js';
import { ROLES } from '../constants/roles.js';

const seedAll = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/user_management_db';

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      console.log(`🔌 Connected to MongoDB at ${mongoUri}`);
    }

    console.log('\n====================================================');
    console.log('🌱 Starting MetroGram Database Seeding...');
    console.log('====================================================\n');

    // 1. Seed Super Admin (Boss)
    console.log('1️⃣ Seeding Super Admin...');
    const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'boss@company.com').toLowerCase();
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123456';
    
    let superAdmin = await User.findOne({ email: superAdminEmail });
    if (!superAdmin) {
      const saResult = await superAdminService.seedSuperAdmin({
        email: superAdminEmail,
        password: superAdminPassword,
        firstName: process.env.SUPER_ADMIN_FIRST_NAME || 'Boss',
        lastName: process.env.SUPER_ADMIN_LAST_NAME || 'Admin',
        phoneNumber: process.env.SUPER_ADMIN_PHONE || '+1234567890'
      });
      superAdmin = saResult.user;
      console.log(`   ✅ Super Admin created: ${superAdmin.email} (Password: ${superAdminPassword})`);
    } else {
      console.log(`   ℹ️ Super Admin already exists: ${superAdmin.email}`);
    }

    // 2. Seed Managers
    console.log('\n2️⃣ Seeding Managers...');
    const managersData = [
      {
        userData: {
          firstName: 'John',
          lastName: 'Davis',
          email: 'manager.ops@company.com',
          password: 'Manager@123456',
          phoneNumber: '+1987654321'
        },
        profileData: {
          department: 'Operations & Logistics',
          branch: 'Downtown Headquarters',
          maxTeamSize: 15
        }
      },
      {
        userData: {
          firstName: 'Sarah',
          lastName: 'Wilson',
          email: 'manager.sales@company.com',
          password: 'Manager@123456',
          phoneNumber: '+1987654322'
        },
        profileData: {
          department: 'Customer Relations & Sales',
          branch: 'West Coast Regional Office',
          maxTeamSize: 20
        }
      }
    ];

    const seededManagers = [];
    for (const m of managersData) {
      let existingManager = await User.findOne({ email: m.userData.email });
      if (!existingManager) {
        const newManager = await managerService.createManager({
          userData: m.userData,
          profileData: m.profileData,
          creatorId: superAdmin._id
        });
        seededManagers.push(newManager);
        console.log(`   ✅ Manager created: ${m.userData.email} | Dept: ${m.profileData.department} (Password: ${m.userData.password})`);
      } else {
        seededManagers.push(existingManager);
        console.log(`   ℹ️ Manager already exists: ${existingManager.email}`);
      }
    }

    const opsManager = seededManagers[0];
    const salesManager = seededManagers[1];

    // 3. Seed Employees
    console.log('\n3️⃣ Seeding Employees...');
    const employeesData = [
      {
        userData: {
          firstName: 'Alex',
          lastName: 'Morgan',
          email: 'employee.alex@company.com',
          password: 'Employee@123456',
          phoneNumber: '+1555123456'
        },
        profileData: {
          employeeCode: 'EMP-1001',
          designation: 'Senior Operations Associate',
          department: 'Operations & Logistics',
          manager: opsManager?.profile?._id || opsManager?.profile || null
        },
        creatorId: opsManager._id,
        creatorRole: ROLES.MANAGER
      },
      {
        userData: {
          firstName: 'Lisa',
          lastName: 'Ray',
          email: 'employee.lisa@company.com',
          password: 'Employee@123456',
          phoneNumber: '+1555123457'
        },
        profileData: {
          employeeCode: 'EMP-1002',
          designation: 'Logistics Coordinator',
          department: 'Operations & Logistics',
          manager: opsManager?.profile?._id || opsManager?.profile || null
        },
        creatorId: opsManager._id,
        creatorRole: ROLES.MANAGER
      },
      {
        userData: {
          firstName: 'David',
          lastName: 'Kim',
          email: 'employee.david@company.com',
          password: 'Employee@123456',
          phoneNumber: '+1555123458'
        },
        profileData: {
          employeeCode: 'EMP-2001',
          designation: 'Sales Representative',
          department: 'Customer Relations & Sales',
          manager: salesManager?.profile?._id || salesManager?.profile || null
        },
        creatorId: salesManager._id,
        creatorRole: ROLES.MANAGER
      }
    ];

    const seededEmployees = [];
    for (const emp of employeesData) {
      let existingEmployee = await User.findOne({ email: emp.userData.email });
      if (!existingEmployee) {
        const newEmp = await employeeService.createEmployee({
          userData: emp.userData,
          profileData: emp.profileData,
          creatorId: emp.creatorId,
          creatorRole: emp.creatorRole
        });
        seededEmployees.push(newEmp);
        console.log(`   ✅ Employee created: ${emp.userData.email} | Code: ${emp.profileData.employeeCode} (Password: ${emp.userData.password})`);
      } else {
        seededEmployees.push(existingEmployee);
        console.log(`   ℹ️ Employee already exists: ${existingEmployee.email}`);
      }
    }

    const firstEmployee = seededEmployees[0];

    // 4. Seed Customers
    console.log('\n4️⃣ Seeding Customers...');
    const customersData = [
      {
        userData: {
          firstName: 'Emma',
          lastName: 'Watson',
          email: 'customer.emma@gmail.com',
          password: 'Customer@123456',
          phoneNumber: '+1444123456'
        },
        profileData: {
          customerCode: 'CUST-8001',
          membershipType: 'VIP',
          address: {
            street: '742 Evergreen Terrace',
            city: 'Springfield',
            state: 'OR',
            zipCode: '97477',
            country: 'USA'
          },
          loyaltyPoints: 350
        },
        creatorId: firstEmployee._id
      },
      {
        userData: {
          firstName: 'Michael',
          lastName: 'Scott',
          email: 'customer.michael@gmail.com',
          password: 'Customer@123456',
          phoneNumber: '+1444123457'
        },
        profileData: {
          customerCode: 'CUST-8002',
          membershipType: 'PREMIUM',
          address: {
            street: '1725 Slough Avenue',
            city: 'Scranton',
            state: 'PA',
            zipCode: '18504',
            country: 'USA'
          },
          loyaltyPoints: 180
        },
        creatorId: firstEmployee._id
      },
      {
        userData: {
          firstName: 'Clara',
          lastName: 'Oswald',
          email: 'customer.clara@gmail.com',
          password: 'Customer@123456',
          phoneNumber: '+1444123458'
        },
        profileData: {
          customerCode: 'CUST-8003',
          membershipType: 'REGULAR',
          address: {
            street: '42 Baker Street',
            city: 'London',
            state: 'Greater London',
            zipCode: 'NW1 6XE',
            country: 'UK'
          },
          loyaltyPoints: 50
        },
        creatorId: firstEmployee._id
      }
    ];

    for (const cust of customersData) {
      let existingCustomer = await User.findOne({ email: cust.userData.email });
      if (!existingCustomer) {
        await customerService.createCustomer({
          userData: cust.userData,
          profileData: cust.profileData,
          creatorId: cust.creatorId
        });
        console.log(`   ✅ Customer created: ${cust.userData.email} | Tier: ${cust.profileData.membershipType} (Password: ${cust.userData.password})`);
      } else {
        console.log(`   ℹ️ Customer already exists: ${existingCustomer.email}`);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 MetroGram Database Seeding Completed Successfully!');
    console.log('====================================================\n');
    console.log('🔑 Credentials Summary for Login:');
    console.log('----------------------------------------------------');
    console.log('👑 Super Admin : boss@company.com           / SuperAdmin@123456');
    console.log('👔 Manager (Ops): manager.ops@company.com     / Manager@123456');
    console.log('👔 Manager (Sls): manager.sales@company.com   / Manager@123456');
    console.log('💼 Employee 1  : employee.alex@company.com   / Employee@123456');
    console.log('💼 Employee 2  : employee.lisa@company.com   / Employee@123456');
    console.log('💼 Employee 3  : employee.david@company.com  / Employee@123456');
    console.log('🛍️ Customer 1  : customer.emma@gmail.com     / Customer@123456 (VIP)');
    console.log('🛍️ Customer 2  : customer.michael@gmail.com  / Customer@123456 (PREMIUM)');
    console.log('🛍️ Customer 3  : customer.clara@gmail.com    / Customer@123456 (REGULAR)');
    console.log('====================================================\n');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
};

const isDirectExecution =
  (typeof import.meta.main !== 'undefined' && import.meta.main) ||
  (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]);

if (isDirectExecution) {
  seedAll()
    .then(async () => {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await mongoose.disconnect();
      process.exit(1);
    });
}

export default seedAll;
