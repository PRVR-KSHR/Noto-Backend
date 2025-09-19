import { TextExtractionService } from './services/textExtraction.js';
import fs from 'fs';
import path from 'path';

async function testOCRDirectly() {
  try {
    console.log('🧪 Testing OCR directly on a sample...');
    
    // Let's test the OCR method directly
    const pdfPath = path.join(process.cwd(), 'temp-uploads', 'temp-1758180374581-quepdf.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ PDF file not found');
      return;
    }
    
    console.log('📄 Testing OCR extraction on:', pdfPath);
    
    try {
      const ocrResult = await TextExtractionService.tryOCRExtraction(pdfPath, 'test.pdf', 2);
      console.log('✅ OCR completed');
      console.log('📝 OCR Result length:', ocrResult?.length || 0);
      console.log('📋 OCR Preview:', ocrResult?.substring(0, 300) || 'No text extracted');
    } catch (ocrError) {
      console.log('❌ OCR failed:', ocrError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testOCRDirectly();