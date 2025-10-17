import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function splitPDF(inputPath, maxSizeKB = 900) {
  try {
    console.log('📄 Reading PDF:', inputPath);
    
    const pdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    
    console.log(`📊 Total pages: ${totalPages}`);
    console.log(`📦 Original size: ${(pdfBytes.length / 1024).toFixed(2)} KB`);
    console.log(`🎯 Target max size: ${maxSizeKB} KB per chunk\n`);

    const outputDir = path.dirname(inputPath);
    const baseName = path.basename(inputPath, '.pdf');
    const chunks = [];
    
    // Try different page ranges
    let chunkNum = 1;
    let startPage = 0;
    
    while (startPage < totalPages) {
      // Start with 3 pages per chunk
      let endPage = Math.min(startPage + 3, totalPages);
      let chunkDoc = await PDFDocument.create();
      
      // Copy pages
      const pages = await chunkDoc.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, i) => startPage + i));
      pages.forEach(page => chunkDoc.addPage(page));
      
      // Save and check size
      let chunkBytes = await chunkDoc.save();
      let chunkSizeKB = chunkBytes.length / 1024;
      
      // If too large, reduce pages
      while (chunkSizeKB > maxSizeKB && (endPage - startPage) > 1) {
        endPage--;
        chunkDoc = await PDFDocument.create();
        const newPages = await chunkDoc.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, i) => startPage + i));
        newPages.forEach(page => chunkDoc.addPage(page));
        chunkBytes = await chunkDoc.save();
        chunkSizeKB = chunkBytes.length / 1024;
      }
      
      // Save chunk
      const outputPath = path.join(outputDir, `${baseName}_part${chunkNum}.pdf`);
      await fs.writeFile(outputPath, chunkBytes);
      
      console.log(`✅ Created chunk ${chunkNum}:`);
      console.log(`   - Pages: ${startPage + 1}-${endPage}`);
      console.log(`   - Size: ${chunkSizeKB.toFixed(2)} KB`);
      console.log(`   - File: ${path.basename(outputPath)}\n`);
      
      chunks.push({
        file: outputPath,
        pages: `${startPage + 1}-${endPage}`,
        size: chunkSizeKB
      });
      
      startPage = endPage;
      chunkNum++;
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log(`🎉 Successfully split into ${chunks.length} chunks!`);
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('📋 Upload these files to NOTO (select "Handwritten" for each):');
    chunks.forEach((chunk, i) => {
      console.log(`   ${i + 1}. ${path.basename(chunk.file)} (${chunk.pages}, ${chunk.size.toFixed(2)} KB)`);
    });
    
    return chunks;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Usage: node split-pdf.js <input-file>
const inputFile = process.argv[2];

if (!inputFile) {
  console.log('Usage: node split-pdf.js <pdf-file>');
  console.log('Example: node split-pdf.js "hand notes.pdf"');
  process.exit(1);
}

splitPDF(inputFile);
