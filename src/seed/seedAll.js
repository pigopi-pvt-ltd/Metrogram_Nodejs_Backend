import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import superAdminService from '../modules/superAdmin/superAdmin.service.js';
import managerService from '../modules/manager/manager.service.js';
import employeeService from '../modules/employee/employee.service.js';
import customerService from '../modules/customer/customer.service.js';
import categoryService from '../modules/category/category.service.js';
import Category from '../modules/category/category.model.js';
import serviceService from '../modules/service/service.service.js';
import Service from '../modules/service/service.model.js';
import cardService from '../modules/card/card.service.js';
import CardPlan from '../modules/card/cardPlan.model.js';
import User from '../modules/user/user.model.js';
import Job from '../modules/career/job.model.js';
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

    // 2. Seed Test Categories (Pathology, Radiology, Physiotherapy)
    console.log('\n2️⃣ Seeding Test Categories (Pathology, Radiology, Physiotherapy)...');
    const seededCategories = await categoryService.seedDefaultCategories(superAdmin._id);
    const pathologyCategory = seededCategories.find((c) => c.slug === 'pathology') || seededCategories[0];
    for (const cat of seededCategories) {
      console.log(`   ✅ Category: ${cat.name} (${cat.slug})`);
    }

    // Ensure all existing tests in DB without category get assigned to Pathology
    const updateExistingTestsResult = await Service.updateMany(
      { $or: [{ category: { $exists: false } }, { category: null }] },
      { $set: { category: pathologyCategory._id } }
    );
    if (updateExistingTestsResult.modifiedCount > 0) {
      console.log(`   🔄 Assigned Pathology category to ${updateExistingTestsResult.modifiedCount} existing tests in database.`);
    }

    // 3. Seed Diagnostic Tests / Services (Super Admin Configured)
    console.log('\n3️⃣ Seeding Diagnostic Lab Tests / Services (Pathology)...');
    const sampleServices = [
      {
        testName: 'Complete Blood Count (CBC)',
        description: 'Measures key components and cells in blood including red blood cells, white blood cells, hemoglobin, and platelets to assess overall health.',
        testType: 'Blood Test',
        reportTime: '24 Hours',
        sampleType: 'Blood Sample',
        price: 350,
        discountedPrice: 200,
        parametersMeasured: [
          'Red Blood Cells (RBC)',
          'White Blood Cells (WBC)',
          'Platelets',
          'Hemoglobin (Hb)',
          'Hematocrit (PCV)',
          'Mean Corpuscular Volume (MCV)',
          'MCH and MCHC',
          'RBC Distribution Width (RDW)'
        ],
        requiresFasting: false,
        fastingDuration: '',
        preparationInstructions: 'No special dietary preparation required.',
        faqs: [
          {
            question: 'Is fasting required for a Complete Blood Count (CBC) test?',
            answer: 'No, fasting is not required for a CBC test unless it is ordered alongside other tests that do require fasting.'
          },
          {
            question: 'How quickly will I receive my CBC test report?',
            answer: 'CBC reports are typically ready and sent within 24 hours of sample collection.'
          }
        ],
        isActive: true
      },
      {
        testName: 'Lipid Profile Comprehensive',
        description: 'Measures total cholesterol, good cholesterol (HDL), bad cholesterol (LDL), and triglycerides to evaluate cardiovascular risk.',
        testType: 'Blood Test',
        reportTime: '12 Hours',
        sampleType: 'Blood Sample',
        price: 800,
        discountedPrice: 480,
        parametersMeasured: [
          'Total Cholesterol',
          'HDL Cholesterol (Good)',
          'LDL Cholesterol (Bad)',
          'Triglycerides',
          'VLDL Cholesterol',
          'TC / HDL Ratio'
        ],
        requiresFasting: true,
        fastingDuration: '10-12 hours overnight fasting required',
        preparationInstructions: 'Water is permitted during the fasting window.',
        faqs: [
          {
            question: 'Why is fasting required for a Lipid Profile?',
            answer: 'Fasting helps establish an accurate baseline for triglycerides and LDL cholesterol, which fluctuate after meals.'
          },
          {
            question: 'Can I drink water while fasting for this test?',
            answer: 'Yes, drinking plain water is allowed and recommended to prevent dehydration.'
          }
        ],
        isActive: true
      },
      {
        testName: 'Thyroid Function Test (Total T3, T4, TSH)',
        description: 'Evaluates thyroid gland performance and metabolic health by checking total levels of triiodothyronine, thyroxine, and thyroid stimulating hormone.',
        testType: 'Blood Test',
        reportTime: '24 Hours',
        sampleType: 'Blood Sample',
        price: 650,
        discountedPrice: 390,
        parametersMeasured: [
          'Total Triiodothyronine (T3)',
          'Total Thyroxine (T4)',
          'Thyroid Stimulating Hormone (TSH)'
        ],
        requiresFasting: true,
        fastingDuration: '8-10 hours fasting recommended (morning sample preferred)',
        preparationInstructions: 'Avoid biotin supplements 48 hours prior to test.',
        faqs: [
          {
            question: 'What time of day is best for a thyroid test?',
            answer: 'Morning sample collection is best as TSH levels follow a circadian rhythm.'
          }
        ],
        isActive: true
      },
      {
        testName: 'Liver Function Test (LFT)',
        description: 'Comprehensive screening for liver enzymes, bilirubin levels, and protein synthesis to detect liver damage or inflammation.',
        testType: 'Biochemistry',
        reportTime: '24 Hours',
        sampleType: 'Blood Sample',
        price: 750,
        discountedPrice: 450,
        parametersMeasured: [
          'Total Bilirubin',
          'Direct Bilirubin',
          'Indirect Bilirubin',
          'SGOT (AST)',
          'SGPT (ALT)',
          'Alkaline Phosphatase (ALP)',
          'Total Protein',
          'Albumin',
          'Globulin',
          'A/G Ratio'
        ],
        requiresFasting: false,
        fastingDuration: '',
        preparationInstructions: 'Avoid strenuous exercise and alcohol 24 hours prior to sampling.',
        faqs: [
          {
            question: 'Should I stop my medications before taking an LFT?',
            answer: 'Please consult your physician before pausing any prescribed medications prior to the test.'
          }
        ],
        isActive: true
      },
      {
        testName: 'HbA1c (Glycated Hemoglobin)',
        description: 'Provides an average of your blood glucose levels over the past 2-3 months to diagnose and monitor diabetes management.',
        testType: 'Diabetes Screening',
        reportTime: 'Same Day (6 Hours)',
        sampleType: 'Blood Sample',
        price: 500,
        discountedPrice: 300,
        parametersMeasured: [
          'Glycated Hemoglobin (HbA1c)',
          'Estimated Average Glucose (eAG)'
        ],
        requiresFasting: false,
        fastingDuration: '',
        preparationInstructions: 'Can be taken at any time with or without food.',
        faqs: [
          {
            question: 'Does eating sugar the day before affect the HbA1c result?',
            answer: 'No, HbA1c measures your average blood sugar over the preceding 2 to 3 months, so single-day food intake does not alter it.'
          }
        ],
        isActive: true
      },
      {
        testName: 'Complete Urine Routine Examination',
        description: 'Microscopic and physical examination of urine to screen for urinary tract infections, kidney disease, and metabolic disorders.',
        testType: 'Urine Test',
        reportTime: '4 Hours',
        sampleType: 'Urine Sample',
        price: 250,
        discountedPrice: 150,
        parametersMeasured: [
          'Color & Clarity',
          'Specific Gravity & pH',
          'Urine Protein & Glucose',
          'Ketones & Bilirubin',
          'Pus Cells (Leukocytes)',
          'Red Blood Cells (Erythrocytes)',
          'Epithelial Cells & Crystals'
        ],
        requiresFasting: false,
        fastingDuration: '',
        preparationInstructions: 'Mid-stream early morning clean-catch sample is recommended.',
        faqs: [
          {
            question: 'What does "clean-catch mid-stream" urine mean?',
            answer: 'It means you should let the first small stream of urine pass into the toilet, and then collect the middle portion into the sterile container.'
          }
        ],
        isActive: true
      }
    ];

    for (const serv of sampleServices) {
      const existingService = await Service.findOne({ testName: serv.testName });
      if (!existingService) {
        await serviceService.createService({ ...serv, category: pathologyCategory._id }, superAdmin._id);
        console.log(`   ✅ Test Created: ${serv.testName} (Category: Pathology, ₹${serv.price} -> Card Discount: ₹${serv.discountedPrice})`);
      } else {
        if (!existingService.category) {
          existingService.category = pathologyCategory._id;
          await existingService.save();
          console.log(`   ℹ️ Test already exists: ${serv.testName} (Updated category to Pathology)`);
        } else {
          console.log(`   ℹ️ Test already exists: ${serv.testName}`);
        }
      }
    }

    // 4. Seed Membership Card Plans (Super Admin Configured)
    console.log('\n4️⃣ Seeding Membership Card Plans...');
    const cardPlans = [
      {
        name: 'MetroCare Annual Health Card',
        planType: 'YEARLY',
        price: 999,
        validityInDays: 365,
        description: 'Our most comprehensive annual health card providing deep discounts on all diagnostic tests, consultations, and priority service.',
        benefits: [
          'Up to 45% discount on all pathology and diagnostic tests',
          'Free annual baseline full body health checkup',
          'Priority turnaround for all diagnostic lab reports',
          'Zero home sample collection charges throughout the year',
          'Dedicated health manager and tele-consultation support'
        ],
        discountPercentage: 40,
        badge: 'Gold'
      },
      {
        name: 'MetroCare Monthly Health Pass',
        planType: 'MONTHLY',
        price: 199,
        validityInDays: 30,
        description: 'Flexible 30-day health pass designed for ongoing monitoring, chronic disease management, and immediate testing discounts.',
        benefits: [
          'Discounted member pricing across all lab tests',
          'Priority report processing and WhatsApp delivery',
          'Free digital health records storage in client portal'
        ],
        discountPercentage: 25,
        badge: 'Silver'
      }
    ];

    let yearlyCardPlan = null;
    for (const plan of cardPlans) {
      let existingPlan = await CardPlan.findOne({ name: plan.name });
      if (!existingPlan) {
        existingPlan = await cardService.createCardPlan(plan, superAdmin._id);
        console.log(`   ✅ Card Plan created: ${plan.name} (${plan.planType} - ₹${plan.price})`);
      } else {
        console.log(`   ℹ️ Card Plan already exists: ${existingPlan.name}`);
      }
      if (plan.planType === 'YEARLY') {
        yearlyCardPlan = existingPlan;
      }
    }

    // 5. Seed Managers
    console.log('\n5️⃣ Seeding Managers...');
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

    // 6. Seed Employees
    console.log('\n6️⃣ Seeding Employees...');
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

    // 7. Seed Customers (with Aadhar, PAN, Address, and Card Subscriptions)
    console.log('\n7️⃣ Seeding Customers (with Aadhar, PAN & Card Info)...');
    const customersData = [
      {
        userData: {
          firstName: 'Emma',
          lastName: 'Watson',
          email: 'customer.emma@gmail.com',
          password: 'Customer@123456',
          phoneNumber: '+919876543210'
        },
        profileData: {
          customerCode: 'CUST-8001',
          membershipType: 'VIP',
          aadharNumber: '5489 1234 5678',
          panNumber: 'ABCDE1234F',
          address: {
            street: '742 Evergreen Terrace',
            city: 'Mumbai',
            state: 'Maharashtra',
            zipCode: '400001',
            country: 'India'
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
          phoneNumber: '+919876543211'
        },
        profileData: {
          customerCode: 'CUST-8002',
          membershipType: 'PREMIUM',
          aadharNumber: '6789 2345 6789',
          panNumber: 'FGHIJ5678K',
          address: {
            street: '1725 Slough Avenue',
            city: 'Bangalore',
            state: 'Karnataka',
            zipCode: '560001',
            country: 'India'
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
          phoneNumber: '+919876543212'
        },
        profileData: {
          customerCode: 'CUST-8003',
          membershipType: 'REGULAR',
          aadharNumber: '7890 3456 7890',
          panNumber: 'KLMNO9012P',
          address: {
            street: '42 Baker Street',
            city: 'Delhi',
            state: 'Delhi',
            zipCode: '110001',
            country: 'India'
          },
          loyaltyPoints: 50
        },
        creatorId: firstEmployee._id,
        creatorRole: ROLES.EMPLOYEE
      },
      {
        userData: {
          firstName: 'Robert',
          lastName: 'Langdon',
          email: 'customer.self@gmail.com',
          password: 'Customer@123456',
          phoneNumber: '+919876543299'
        },
        profileData: {
          customerCode: 'CUST-SELF-01',
          membershipType: 'REGULAR',
          aadharNumber: '9999 8888 7777',
          panNumber: 'SELF1234Z',
          address: {
            street: '10 Harvard Yard',
            city: 'Cambridge',
            state: 'Massachusetts',
            zipCode: '02138',
            country: 'USA'
          },
          loyaltyPoints: 0
        },
        creatorId: null,
        creatorRole: null
      }
    ];

    for (const cust of customersData) {
      let existingCustomer = await User.findOne({ email: cust.userData.email });
      if (!existingCustomer) {
        const createdCustomer = await customerService.createCustomer({
          userData: cust.userData,
          profileData: cust.profileData,
          creatorId: cust.creatorId,
          creatorRole: cust.creatorRole
        });
        console.log(`   ✅ Customer created: ${cust.userData.email} | Aadhar: ${cust.profileData.aadharNumber} | PAN: ${cust.profileData.panNumber}`);

        // Assign yearly card plan to Emma (VIP customer) as sample
        if (cust.userData.email === 'customer.emma@gmail.com' && yearlyCardPlan) {
          await cardService.assignCardToCustomer({
            targetCustomerUserId: createdCustomer._id,
            cardPlanId: yearlyCardPlan._id,
            assignedById: superAdmin._id
          });
          console.log(`      💳 Assigned '${yearlyCardPlan.name}' to ${cust.userData.email}`);
        }
      } else {
        console.log(`   ℹ️ Customer already exists: ${existingCustomer.email}`);
      }
    }

    // 8. Seed Career Job Openings (Super Admin Configured)
    console.log('\n8️⃣ Seeding Career Job Openings...');
    const sampleJobs = [
      {
        title: 'Senior Consultant Pathologist',
        department: 'Pathology & Diagnostics',
        location: 'Patna, Bihar',
        jobType: 'FULL_TIME',
        workplaceType: 'ON_SITE',
        experienceLevel: '3-5 Years',
        education: 'MD / DNB in Pathology',
        salary: {
          min: 80000,
          max: 120000,
          currency: 'INR',
          period: 'PER_MONTH',
          isDisclosed: true,
          displayText: '₹80,000 - ₹1,20,000 / month'
        },
        description: 'We are seeking an experienced and dedicated Consultant Pathologist to oversee diagnostic lab reporting, hematology, biochemistry, and clinical pathology tests at MetroGram Patna facility.',
        responsibilities: [
          'Verify and authorize clinical pathology, hematology, and biochemistry test reports',
          'Ensure strict adherence to quality control protocols (NABL standards)',
          'Provide consultation and guidance to medical staff and patients regarding lab findings',
          'Lead and supervise the laboratory technical staff'
        ],
        requirements: [
          'MD / DNB in Pathology from a recognized medical institute',
          'Valid Medical Council registration',
          'Minimum 3 years of post-qualification clinical experience in a diagnostic setup',
          'Sound knowledge of automated analyzers and NABL accreditation guidelines'
        ],
        benefits: [
          'Competitive compensation package with performance incentives',
          'Health Card membership for family',
          'Flexible work hours and continuous CME support'
        ],
        skills: ['Clinical Pathology', 'Hematology', 'Biochemistry', 'Quality Control', 'Report Validation'],
        openings: 2,
        status: 'OPEN',
        isActive: true,
        createdBy: superAdmin._id
      },
      {
        title: 'Medical Laboratory Technician (MLT / DMLT)',
        department: 'Diagnostics',
        location: 'Patna, Bihar',
        jobType: 'FULL_TIME',
        workplaceType: 'ON_SITE',
        experienceLevel: '1-3 Years',
        education: 'B.Sc MLT or DMLT',
        salary: {
          min: 18000,
          max: 28000,
          currency: 'INR',
          period: 'PER_MONTH',
          isDisclosed: true,
          displayText: '₹18,000 - ₹28,000 / month'
        },
        description: 'Join our central diagnostics facility as a Lab Technician to operate automated analyzers, perform diagnostic testing, sample processing, and maintain high testing precision.',
        responsibilities: [
          'Perform routine and specialized diagnostic lab tests in hematology, serology, and biochemistry',
          'Calibrate, maintain, and troubleshoot lab equipment and analyzers daily',
          'Maintain meticulous documentation and test logs in compliance with lab protocols',
          'Manage inventory and reagent stock levels'
        ],
        requirements: [
          'Diploma (DMLT) or Bachelor degree (B.Sc MLT) in Medical Laboratory Technology',
          '1-3 years of proven hands-on laboratory experience',
          'Familiarity with fully automated analyzers (e.g. Sysmex, Roche, Beckman)',
          'Attention to detail and patient confidentiality'
        ],
        benefits: [
          'Annual performance bonuses',
          'Free annual health checkup packages',
          'Skill development and technical certifications'
        ],
        skills: ['Sample Analysis', 'Analyzer Operation', 'Hematology', 'Serology', 'Biochemistry'],
        openings: 4,
        status: 'OPEN',
        isActive: true,
        createdBy: superAdmin._id
      },
      {
        title: 'Phlebotomist / Home Sample Collector',
        department: 'Field Operations',
        location: 'Patna & Surrounding Districts',
        jobType: 'FULL_TIME',
        workplaceType: 'ON_SITE',
        experienceLevel: '0-2 Years (Freshers Welcome)',
        education: 'DMLT / Medical Assistant / Certified Phlebotomy Course',
        salary: {
          min: 15000,
          max: 22000,
          currency: 'INR',
          period: 'PER_MONTH',
          isDisclosed: true,
          displayText: '₹15,000 - ₹22,000 / month + Fuel Allowance'
        },
        description: 'MetroGram is expanding doorstep home sample collection services. We are looking for polite, reliable, and skilled Phlebotomists to collect diagnostic samples from patient homes across Patna.',
        responsibilities: [
          'Visit patient homes on scheduled time slots for safe and painless blood / urine sample collection',
          'Verify patient identification, test requirements, and fasting status',
          'Maintain cold-chain integrity and transport samples promptly to the central processing lab',
          'Deliver an empathetic and courteous customer experience'
        ],
        requirements: [
          'Certified Phlebotomist, DMLT, or Nursing Assistant',
          'Strong blood collection skills with minimal patient discomfort',
          'Two-wheeler with valid driving license',
          'Smartphone proficiency for operating the collection app'
        ],
        benefits: [
          'Attractive fuel allowance & per-visit incentive scheme',
          'MetroGram uniform and premium collection kit provided',
          'Health insurance coverage'
        ],
        skills: ['Phlebotomy', 'Blood Collection', 'Patient Handling', 'Cold Chain Management', 'Customer Service'],
        openings: 6,
        status: 'OPEN',
        isActive: true,
        createdBy: superAdmin._id
      }
    ];

    for (const jobData of sampleJobs) {
      const existing = await Job.findOne({ title: jobData.title });
      if (!existing) {
        await Job.create(jobData);
        console.log(`   ✅ Job Opening created: '${jobData.title}' (${jobData.department})`);
      } else {
        console.log(`   ℹ️ Job Opening already exists: '${existing.title}'`);
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
    console.log('🛍️ Customer 1  : customer.emma@gmail.com     / Customer@123456 (VIP + Active Card)');
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
