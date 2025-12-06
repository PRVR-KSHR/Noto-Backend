#!/usr/bin/env node

/**
 * Clear all files from MongoDB
 * Use this to remove old Cloudinary files and start fresh with Filen.io
 * 
 * Usage: node scripts/clear-old-files.js
 */

import mongoose from 'mongoose';
import File from '../models/File.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearOldFiles() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Current file count:', await File.countDocuments());

    // Delete all files
    const result = await File.deleteMany({});
    
    console.log(`\n🗑️ Deleted ${result.deletedCount} files from the database`);
    console.log('✅ Database is now clean - ready for Filen.io uploads!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearOldFiles();
