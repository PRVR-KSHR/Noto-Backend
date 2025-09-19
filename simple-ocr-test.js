// Simple OCR test without importing server
async function testOCRSimple() {
  try {
    console.log('🧪 Testing Tesseract OCR...');
    
    // Test OCR on one of the PNG images
    const fs = await import('fs');
    const path = await import('path');
    const Tesseract = await import('tesseract.js');
    
    const imagePath = path.join(process.cwd(), 'temp-uploads', 'ocr-1758180498284-1.png');
    
    if (!fs.existsSync(imagePath)) {
      console.log('❌ Image file not found:', imagePath);
      return;
    }
    
    console.log('📄 Testing OCR on image:', imagePath);
    
    const { data: { text } } = await Tesseract.default.recognize(imagePath, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    console.log('✅ OCR completed');
    console.log('📝 Extracted text length:', text?.length || 0);
    console.log('📋 Extracted text preview:');
    console.log(text?.substring(0, 500) || 'No text found');
    
  } catch (error) {
    console.error('❌ OCR test failed:', error);
  }
}

testOCRSimple();