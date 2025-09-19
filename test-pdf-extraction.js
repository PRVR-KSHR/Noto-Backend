import { TextExtractionService } from './services/textExtraction.js';
import fs from 'fs';
import path from 'path';

async function testPDFExtraction() {
  try {
    console.log('🧪 Testing PDF extraction...');
    
    // Test with one of the existing PDF files
    const pdfPath = path.join(process.cwd(), 'temp-uploads', 'temp-1758180374581-quepdf.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Test PDF file not found:', pdfPath);
      return;
    }
    
    console.log('📁 Reading PDF file:', pdfPath);
    const buffer = fs.readFileSync(pdfPath);
    console.log('📦 Buffer size:', buffer.length, 'bytes');
    
    // Test the extraction
    const result = await TextExtractionService.extractTextFromBuffer(
      buffer, 
      'quepdf.pdf', 
      'application/pdf'
    );
    
    console.log('📝 Extraction result:');
    console.log('Length:', result.length, 'characters');
    console.log('Preview:', result.substring(0, 300));
    
    if (result.length > 100) {
      console.log('✅ PDF extraction test PASSED');
    } else {
      console.log('⚠️  PDF extraction returned limited content');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPDFExtraction();