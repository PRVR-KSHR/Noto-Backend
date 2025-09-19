// Test officeparser with Word document
async function testWithWordDoc() {
  try {
    console.log('🧪 Testing officeparser with Word document...');
    
    const officeParser = await import('officeparser');
    const fs = await import('fs');
    const path = await import('path');
    
    const tempDir = path.join(process.cwd(), 'temp-uploads');
    const files = fs.readdirSync(tempDir);
    
    const wordFiles = files.filter(file => 
      file.toLowerCase().endsWith('.doc') || file.toLowerCase().endsWith('.docx')
    );
    
    if (wordFiles.length === 0) {
      console.log('⚠️  No Word files found for testing');
      return;
    }
    
    const wordFile = wordFiles[0];
    const wordPath = path.join(tempDir, wordFile);
    
    console.log('📄 Testing with Word document:', wordFile);
    
    const data = await new Promise((resolve, reject) => {
      officeParser.parseOffice(wordPath, (data, err) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    
    console.log('✅ Word document parsing successful');
    console.log('📝 Extracted text length:', data?.length || 0);
    console.log('📋 Preview:', data?.substring(0, 300) || 'No text content');
    
    if (data && data.length > 50) {
      console.log('✅ officeparser is working correctly - PowerPoint extraction should work too!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testWithWordDoc();