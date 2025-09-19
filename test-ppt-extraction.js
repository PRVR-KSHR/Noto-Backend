import { TextExtractionService } from './services/textExtraction.js';
import fs from 'fs';
import path from 'path';

async function testPowerPointExtraction() {
  try {
    console.log('🧪 Testing PowerPoint extraction...');
    
    // Check if there are any PowerPoint files in temp-uploads
    const tempDir = path.join(process.cwd(), 'temp-uploads');
    const files = fs.readdirSync(tempDir);
    
    console.log('📁 Files in temp-uploads:', files);
    
    const pptFiles = files.filter(file => 
      file.toLowerCase().endsWith('.ppt') || file.toLowerCase().endsWith('.pptx')
    );
    
    if (pptFiles.length === 0) {
      console.log('⚠️  No PowerPoint files found in temp-uploads for testing');
      console.log('💡 Try uploading a PowerPoint file to test the extraction');
      return;
    }
    
    const pptFile = pptFiles[0];
    const pptPath = path.join(tempDir, pptFile);
    
    console.log('📊 Testing PowerPoint file:', pptFile);
    const buffer = fs.readFileSync(pptPath);
    console.log('📦 Buffer size:', buffer.length, 'bytes');
    
    // Test the extraction
    const result = await TextExtractionService.extractTextFromBuffer(
      buffer, 
      pptFile, 
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    
    console.log('📝 Extraction result:');
    console.log('Length:', result.length, 'characters');
    console.log('Preview:', result.substring(0, 500));
    
    if (result.length > 100 && !result.includes('could not be processed')) {
      console.log('✅ PowerPoint extraction test PASSED');
    } else if (result.includes('very little readable text')) {
      console.log('⚠️  PowerPoint contains limited text content (expected for image-heavy slides)');
    } else {
      console.log('❌ PowerPoint extraction needs attention');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPowerPointExtraction();