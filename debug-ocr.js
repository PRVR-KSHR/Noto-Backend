// Debug script to check OCR extraction results
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import File from './models/File.js';

dotenv.config();

async function debugOCR() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!\n');

    // Find the most recent handwritten file
    console.log('📋 Looking for recent handwritten files...\n');
    const handwrittenFiles = await File.find({ 
      'metadata.documentType': 'handwritten' 
    })
    .sort({ uploadedAt: -1 })
    .limit(5);

    if (handwrittenFiles.length === 0) {
      console.log('❌ No handwritten files found!');
      console.log('Make sure you selected "Handwritten" when uploading.\n');
    } else {
      console.log(`Found ${handwrittenFiles.length} handwritten file(s):\n`);
      
      handwrittenFiles.forEach((file, index) => {
        console.log(`═══════════════════════════════════════════════════`);
        console.log(`📄 File ${index + 1}: ${file.fileName}`);
        console.log(`═══════════════════════════════════════════════════`);
        console.log(`🆔 ID: ${file._id}`);
        console.log(`📅 Uploaded: ${file.uploadedAt}`);
        console.log(`📦 Document Type: ${file.metadata?.documentType || 'NOT SET'}`);
        console.log(`📊 Extraction Status: ${file.extractionStatus || 'NOT SET'}`);
        
        if (file.extractionError) {
          console.log(`❌ Extraction Error: ${file.extractionError}`);
        }
        
        if (file.extractedText) {
          console.log(`\n📝 Extracted Text (first 500 chars):`);
          console.log('─'.repeat(50));
          console.log(file.extractedText.substring(0, 500));
          console.log('─'.repeat(50));
          console.log(`\n📏 Total extracted text length: ${file.extractedText.length} chars`);
          
          // Analyze text quality
          const hasRealWords = /\b[a-zA-Z]{4,}\b/.test(file.extractedText);
          const symbolRatio = (file.extractedText.match(/[^a-zA-Z0-9\s]/g) || []).length / file.extractedText.length;
          
          console.log(`\n🔍 Quality Analysis:`);
          console.log(`   - Has real words (4+ letters): ${hasRealWords ? '✅ YES' : '❌ NO'}`);
          console.log(`   - Symbol ratio: ${(symbolRatio * 100).toFixed(1)}% ${symbolRatio > 0.3 ? '⚠️ HIGH' : '✅ OK'}`);
        } else {
          console.log(`\n❌ NO EXTRACTED TEXT STORED!`);
          console.log(`   This means OCR extraction didn't run or failed.`);
        }
        console.log('\n');
      });
    }

    // Check OCR configuration
    console.log(`═══════════════════════════════════════════════════`);
    console.log(`🔧 OCR Configuration Check`);
    console.log(`═══════════════════════════════════════════════════`);
    console.log(`API Key: ${process.env.OCRSPACE_API_KEY === 'helloworld' ? '❌ TEST KEY (helloworld)' : '✅ Real API Key'}`);
    console.log(`API Key Value: ${process.env.OCRSPACE_API_KEY?.substring(0, 10)}...`);
    console.log(`Engine: ${process.env.OCRSPACE_ENGINE || 'NOT SET'}`);
    console.log(`API URL: ${process.env.OCRSPACE_API_URL || 'NOT SET'}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugOCR();
