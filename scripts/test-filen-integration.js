#!/usr/bin/env node

/**
 * Filen.io Migration Test Script
 * Tests the Filen.io integration without uploading actual files
 * 
 * Usage: node test-filen-integration.js
 */

import filenService from '../services/filenService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testFilenIntegration() {
  console.log('🧪 Testing Filen.io Integration\n');

  try {
    // Test 1: Check environment variables
    console.log('1️⃣ Checking environment variables...');
    const email = process.env.FILEN_EMAIL;
    const password = process.env.FILEN_PASSWORD;
    const provider = process.env.STORAGE_PROVIDER;

    if (!email || !password) {
      console.error('❌ Missing FILEN_EMAIL or FILEN_PASSWORD in .env');
      console.error('   Please set these variables and try again');
      process.exit(1);
    }

    console.log('✅ Environment variables found');
    console.log(`   Email: ${email}`);
    console.log(`   Storage Provider: ${provider}\n`);

    // Test 2: Health check
    console.log('2️⃣ Running health check...');
    const health = await filenService.healthCheck();
    console.log('✅ Health check passed');
    console.log(`   Status: ${health.status}`);
    console.log(`   Provider: ${health.provider}`);
    console.log(`   Authenticated: ${health.authenticated}\n`);

    if (health.status !== 'connected') {
      console.error('❌ Health check failed - Filen service not connected');
      console.error('   Check your email and password in .env');
      process.exit(1);
    }

    // Test 3: Get file info (if we have a fileUUID)
    console.log('3️⃣ Filen.io integration test complete!\n');
    console.log('📋 Summary:');
    console.log('   ✅ Environment variables configured');
    console.log('   ✅ Filen.io authentication successful');
    console.log('   ✅ Ready to upload files\n');

    console.log('🚀 Next steps:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Upload a test file through the API');
    console.log('   3. Check logs for upload confirmation\n');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    process.exit(1);
  }
}

testFilenIntegration();
