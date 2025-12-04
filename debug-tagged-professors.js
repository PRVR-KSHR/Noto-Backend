import mongoose from 'mongoose';
import File from './models/File.js';
import ProfessorValidator from './models/ProfessorValidator.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all professors
    const professors = await ProfessorValidator.find({ status: 'approved' });
    console.log(`\n📋 Found ${professors.length} approved professors:`);
    professors.forEach(prof => {
      console.log(`  - ${prof.fullName} (ID: ${prof._id}, User: ${prof.userId})`);
    });

    // Get all files with tagged professors
    const files = await File.find({ 'taggedProfessors.0': { $exists: true } });
    console.log(`\n📁 Found ${files.length} files with tagged professors:`);
    
    files.forEach(file => {
      console.log(`\n  📄 File: ${file.title}`);
      console.log(`     TaggedProfessors:`, JSON.stringify(file.taggedProfessors, null, 2));
    });

    // Check if any tagged professors match
    if (professors.length > 0 && files.length > 0) {
      console.log('\n🔍 Checking matches:');
      professors.forEach(prof => {
        files.forEach(file => {
          const hasMatch = file.taggedProfessors.some(tp => {
            const isMatch = tp.professorId?.toString() === prof._id.toString();
            if (isMatch) {
              console.log(`  ✅ MATCH: Professor "${prof.fullName}" tagged in "${file.title}"`);
              console.log(`     Professor _id: ${prof._id}`);
              console.log(`     Tagged professorId: ${tp.professorId}`);
            }
            return isMatch;
          });
        });
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
