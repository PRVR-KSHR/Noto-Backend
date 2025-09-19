import { TextExtractionService } from './services/textExtraction.js';
import fs from 'fs';
import path from 'path';

async function testOCRExtraction() {
  try {
    console.log('🧪 Testing OCR extraction...');
    
    // Test with one of the existing PDF files (assuming it might be scanned)
    const pdfPath = path.join(process.cwd(), 'temp-uploads', '1758172938777-444836393-quepdf.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Test PDF file not found:', pdfPath);
      return;
    }
    
    console.log('📁 Reading PDF file:', pdfPath);
    const buffer = fs.readFileSync(pdfPath);
    console.log('📦 Buffer size:', buffer.length, 'bytes');
    
    // Test the extraction (this will automatically try OCR if needed)
    const result = await TextExtractionService.extractTextFromBuffer(
      buffer, 
      'quepdf.pdf', 
      'application/pdf'
    );
    
    console.log('📝 Extraction result:');
    console.log('Length:', result.length, 'characters');
    console.log('Preview:', result.substring(0, 500));
    
    if (result.includes('OCR Text Extraction Results')) {
      console.log('✅ OCR was used for extraction');
    } else if (result.length > 100) {
      console.log('✅ Regular PDF text extraction worked');
    } else {
      console.log('⚠️  Limited content extracted');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testOCRExtraction();