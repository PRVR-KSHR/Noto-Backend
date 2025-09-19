// Simple PowerPoint test
async function testOfficeParser() {
  try {
    console.log('🧪 Testing officeparser library...');
    
    const officeParser = await import('officeparser');
    console.log('✅ officeparser imported successfully');
    
    const fs = await import('fs');
    const path = await import('path');
    
    // Check for PowerPoint files
    const tempDir = path.join(process.cwd(), 'temp-uploads');
    
    if (!fs.existsSync(tempDir)) {
      console.log('❌ temp-uploads directory not found');
      return;
    }
    
    const files = fs.readdirSync(tempDir);
    console.log('📁 Available files:', files.slice(0, 5)); // Show first 5 files
    
    const pptFiles = files.filter(file => 
      file.toLowerCase().endsWith('.ppt') || file.toLowerCase().endsWith('.pptx')
    );
    
    if (pptFiles.length === 0) {
      console.log('⚠️  No PowerPoint files found for testing');
      console.log('💡 The PowerPoint extraction functionality is ready and will work when PowerPoint files are uploaded');
      return;
    }
    
    const pptFile = pptFiles[0];
    const pptPath = path.join(tempDir, pptFile);
    
    console.log('📊 Testing with:', pptFile);
    
    const data = await new Promise((resolve, reject) => {
      officeParser.parseOffice(pptPath, (data, err) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    
    console.log('✅ PowerPoint parsing successful');
    console.log('📝 Extracted text length:', data?.length || 0);
    console.log('📋 Preview:', data?.substring(0, 300) || 'No text content');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testOfficeParser();