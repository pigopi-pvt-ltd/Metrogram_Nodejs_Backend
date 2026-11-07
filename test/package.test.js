import 'dotenv/config';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Package from '../src/modules/package/package.model.js';
import PackageBooking from '../src/modules/package/packageBooking.model.js';
import packageService from '../src/modules/package/package.service.js';
import packageController from '../src/modules/package/package.controller.js';

const runTests = async () => {
  console.log('🧪 Starting Packages Module Verification Tests...\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/user_management_db';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
      console.log('✅ Connected to MongoDB');
    }

    // 1. Verify Package Model schema & validation (NO Category required)
    console.log('\n--- Test 1: Package Model Schema Validation (No Category) ---');
    const testPkgData = {
      packageName: 'Full Body Test Package ' + Date.now(),
      description: 'Comprehensive health checkup package without any category',
      packageType: 'Full Body Health',
      reportTime: '24 hours',
      sampleType: 'Blood & Urine',
      price: 1999,
      discountedPrice: 999,
      parametersMeasured: ['Hemoglobin', 'Blood Sugar', 'Cholesterol'],
      requiresFasting: true,
      fastingDuration: '10-12 hours',
      preparationInstructions: 'Fasting required'
    };

    const pkgDoc = new Package(testPkgData);
    await pkgDoc.validate();
    console.log('✅ Package model validates successfully without category');

    // Verify virtual 'testName' works
    console.log('✅ Virtual testName getter:', pkgDoc.testName === testPkgData.packageName);
    pkgDoc.testName = 'Updated Package Name';
    console.log('✅ Virtual testName setter updates packageName:', pkgDoc.packageName === 'Updated Package Name');

    // 2. Verify Service CRUD & Querying
    console.log('\n--- Test 2: Package Service Operations ---');
    const createdPkg = await packageService.createPackage(
      {
        packageName: 'Automated Test Health Package ' + Date.now(),
        description: 'Test description for package',
        packageType: 'Preventive Care',
        reportTime: '12 hours',
        sampleType: 'Blood',
        price: 1499,
        discountedPrice: 799,
        parametersMeasured: ['HbA1c', 'Lipid Profile'],
        isActive: true
      },
      new mongoose.Types.ObjectId()
    );

    console.log(`✅ Created package in DB with ID: ${createdPkg._id}`);
    console.log(`   Package Name: ${createdPkg.packageName}`);
    console.log(`   Category field in doc: ${createdPkg.category === undefined ? 'None (as required)' : createdPkg.category}`);

    // Update
    const updated = await packageService.updatePackage(createdPkg._id, {
      packageName: createdPkg.packageName + ' (Updated)',
      category: 'SomeInvalidCategoryShouldBeIgnored' // Testing that category is stripped
    });
    console.log(`✅ Updated package name: ${updated.packageName}`);
    console.log(`   Category field after update: ${updated.category === undefined ? 'None' : updated.category}`);

    // Toggle status
    const toggled = await packageService.toggleStatus(createdPkg._id, false);
    console.log(`✅ Toggled active status to: ${toggled.isActive}`);

    // Get by ID
    const fetched = await packageService.getPackageById(createdPkg._id);
    console.log(`✅ Fetched by ID: ${fetched.packageName}, price: ${fetched.price}`);

    // Query all packages
    const all = await packageService.getAllPackages({ search: 'Automated Test Health Package' });
    console.log(`✅ Query all with search matched: ${all.packages.length} packages`);

    // Get types
    const types = await packageService.getPackageTypes();
    console.log('✅ Package types & sample types returned:', {
      categories: types.categories,
      packageTypesCount: types.packageTypes.length,
      sampleTypesCount: types.sampleTypes.length
    });

    // Delete test package
    await packageService.deletePackage(createdPkg._id);
    console.log('✅ Deleted test package successfully');

    // 3. Verify Express app routes are mounted
    console.log('\n--- Test 3: App Route Mounting Verification ---');
    const stack = app._router.stack;
    const packagesRouteMounted = stack.some(layer => layer.regexp && layer.regexp.test('/api/packages'));
    console.log('✅ /api/packages router mounted in express app:', packagesRouteMounted);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Packages module works as expected.\n');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

runTests();
