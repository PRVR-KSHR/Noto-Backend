import mongoose from 'mongoose';
import File from './models/File.js';
import dotenv from 'dotenv';

dotenv.config();

async function migrateTaggedProfessors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all files with old format tagged professors (have _id but not professorId)
    const oldFiles = await File.find({
      'taggedProfessors._id': { $exists: true },
      'taggedProfessors.professorId': { $exists: false }
    });

    console.log(`\n🔄 Found ${oldFiles.length} files with old tagged professor format`);

    if (oldFiles.length === 0) {
      console.log('✅ All files are already in the new format!');
      process.exit(0);
    }

    // Migrate each file
    for (const file of oldFiles) {
      const oldTaggedProfessors = file.taggedProfessors;
      
      file.taggedProfessors = oldTaggedProfessors.map(tp => ({
        professorId: tp._id,  // Move _id to professorId
        professorName: tp.name || tp.fullName || '',
        collegeName: tp.collegeName || '',
        verificationStatus: tp.verificationStatus || 'pending',
        verifiedAt: tp.verifiedAt || undefined,
        feedback: tp.feedback || undefined
      }));

      await file.save();
      console.log(`✅ Migrated: ${file.title}`);
      console.log(`   Old format: ${JSON.stringify(oldTaggedProfessors[0])}`);
      console.log(`   New format: ${JSON.stringify(file.taggedProfessors[0])}`);
    }

    console.log(`\n✅ Successfully migrated ${oldFiles.length} files!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrateTaggedProfessors();
