import axios from 'axios';
import ocrService from './ocrService.js';

export class TextExtractionService {
  /**
   * Main extraction method with document type detection
   * @param {Buffer} buffer - File buffer
   * @param {String} fileName - Original file name
   * @param {String} mimeType - MIME type
   * @param {String} documentType - "typed" or "handwritten"
   */
  static async extractTextFromBuffer(buffer, fileName, mimeType, documentType = 'typed') {
    try {
      console.log('📖 Extracting text from buffer:', fileName, 'Type:', mimeType, 'Document Type:', documentType);
      console.log('📦 Buffer size:', buffer.length, 'bytes');
      
      // 🖊️ NEW: Route handwritten documents to OCR.space
      if (documentType === 'handwritten') {
        console.log('🖊️ Handwritten document detected, using OCR.space...');
        return await ocrService.extractTextFromHandwritten(buffer, fileName, mimeType);
      }

      // ⌨️ Continue with existing extraction for typed documents
      console.log('⌨️ Typed document detected, using standard extraction...');
      
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(buffer, fileName);
          
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractFromWord(buffer, fileName);
          
        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return await this.extractFromPowerPoint(buffer, fileName);
          
        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return await this.extractFromPowerPoint(buffer, fileName);
          
        case 'text/plain':
          const textContent = buffer.toString('utf-8');
          console.log('✅ Text file processed, length:', textContent.length);
          if (textContent.length < 50) {
            return `Text file "${fileName}" is very short or empty. Content length: ${textContent.length} characters.`;
          }
          return textContent;
          
        default:
          return `Document "${fileName}" (${mimeType}) is supported for download but text extraction is not available for this file type.`;
      }
    } catch (error) {
      console.error('❌ Text extraction from buffer failed:', error);
      return `Unable to extract text from "${fileName}". Error: ${error.message}`;
    }
  }

  static async extractTextFromFile(fileUrl, fileName, mimeType) {
    try {
      console.log('📖 Extracting text from:', fileName);
      
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log('✅ File downloaded successfully');
      const buffer = Buffer.from(response.data);
      
      return await this.extractTextFromBuffer(buffer, fileName, mimeType);
    } catch (error) {
      console.error('❌ Text extraction failed:', error);
      return `Unable to extract text from "${fileName}". Error: ${error.message}`;
    }
  }

  static async extractFromPDF(buffer, fileName) {
    try {
      // Use pdf.js-extract which is already installed
      const PDFExtract = (await import('pdf.js-extract')).PDFExtract;
      const pdfExtract = new PDFExtract();
      
      console.log('📄 Processing PDF:', fileName);
      
      // Create a temporary file for pdf.js-extract to read
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const tempPath = path.join(os.tmpdir(), `temp-${Date.now()}-${fileName}`);
      await fs.promises.writeFile(tempPath, buffer);
      
      try {
        const options = {
          firstPage: 1,
          lastPage: undefined,
          password: '',
          verbosity: -1,
          normalizeWhitespace: false,
          disableCombineTextItems: false
        };
        
        const data = await new Promise((resolve, reject) => {
          pdfExtract.extract(tempPath, options, (err, data) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        
        // Clean up temp file
        await fs.promises.unlink(tempPath).catch(() => {});
        
        if (!data || !data.pages || data.pages.length === 0) {
          return `PDF "${fileName}" was processed but contains no readable pages.

📊 Document Information:
• File: ${fileName}
• Pages: 0 or corrupted

🔍 This might be due to:
• Scanned document with images only (requires OCR)
• Password-protected PDF
• Corrupted file

💡 Suggestions:
• Download the file to view it manually
• If this is a scanned PDF, try online OCR tools
• Switch to Global Mode for general AI assistance`;
        }
        
        // Extract text from all pages
        let extractedText = '';
        let pageCount = data.pages.length;
        
        data.pages.forEach((page, index) => {
          if (page.content && Array.isArray(page.content)) {
            page.content.forEach(item => {
              if (item.str && item.str.trim()) {
                extractedText += item.str + ' ';
              }
            });
            if (index < pageCount - 1) {
              extractedText += '\n\n'; // Add page break
            }
          }
        });
        
        console.log('✅ PDF text extracted, length:', extractedText.length);
        console.log('📊 PDF metadata - Pages:', pageCount);
        
        // If we got very little text, try OCR on the first few pages
        if (extractedText.length < 100) {
          console.log('🔍 Low text content detected, attempting OCR...');
          try {
            const ocrText = await this.tryOCRExtraction(tempPath, fileName, Math.min(pageCount, 3));
            if (ocrText && ocrText.length > extractedText.length) {
              console.log('✅ OCR provided better results');
              return this.formatOCRResult(ocrText, fileName, pageCount);
            }
          } catch (ocrError) {
            console.log('⚠️ OCR failed:', ocrError.message);
          }
          
          return `PDF "${fileName}" was processed but contains very little readable text.

📊 Document Information:
• File: ${fileName}
• Pages: ${pageCount}
• Content Length: ${extractedText.length} characters

🔍 This might be due to:
• Scanned document with images only (requires OCR)
• Handwritten or drawn content
• Complex formatting with embedded objects

💡 Suggestions:
• Download the file to view it manually
• If this is a scanned PDF, try online OCR tools
• Switch to Global Mode for general AI assistance

📋 Content Preview:
${extractedText.substring(0, 200) || '[No text content found]'}`;
        }
        
        // Clean and normalize the text
        const cleanText = extractedText
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log('✅ PDF text cleaned and processed');
        
        // Add document metadata if available
        let finalText = cleanText;
        if (data.meta && data.meta.info && data.meta.info.Title && data.meta.info.Title !== fileName) {
          finalText = `Document Title: ${data.meta.info.Title}\n\n${cleanText}`;
        }
        
        return finalText;
        
      } catch (extractError) {
        // Clean up temp file on error
        await fs.promises.unlink(tempPath).catch(() => {});
        throw extractError;
      }
      
    } catch (error) {
      console.error('❌ PDF extraction error:', error);
      return `PDF "${fileName}" could not be processed for text extraction. Error: ${error.message}`;
    }
  }

  static async tryOCRExtraction(pdfPath, fileName, maxPages = 3) {
    try {
      console.log(`🔍 Starting OCR for first ${maxPages} pages of ${fileName}`);
      
      // Import OCR dependencies
      const pdf2pic = await import('pdf2pic');
      const Tesseract = await import('tesseract.js');
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      // Convert PDF pages to images
      const convert = pdf2pic.fromPath(pdfPath, {
        density: 100,
        saveFilename: "page",
        savePath: os.tmpdir(),
        format: "png",
        width: 600,
        height: 800
      });
      
      let allText = '';
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          console.log(`📄 Processing page ${pageNum} with OCR...`);
          
          // Convert page to image
          const pageResult = await convert(pageNum, { responseType: "image" });
          const imagePath = pageResult.path;
          
          // Perform OCR on the image
          const { data: { text } } = await Tesseract.default.recognize(imagePath, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
              }
            }
          });
          
          if (text && text.trim()) {
            allText += `--- Page ${pageNum} ---\n${text.trim()}\n\n`;
          }
          
          // Clean up image file
          await fs.promises.unlink(imagePath).catch(() => {});
          
        } catch (pageError) {
          console.log(`⚠️ OCR failed for page ${pageNum}:`, pageError.message);
        }
      }
      
      return allText.trim();
      
    } catch (error) {
      console.error('❌ OCR extraction failed:', error);
      throw error;
    }
  }

  static formatOCRResult(ocrText, fileName, pageCount) {
    return `📄 OCR Text Extraction Results for "${fileName}"

📊 Document Information:
• File: ${fileName}
• Pages: ${pageCount}
• Extraction Method: OCR (Optical Character Recognition)
• Content Length: ${ocrText.length} characters

⚠️ Note: OCR results may contain some errors or formatting issues.

📝 Extracted Content:
${ocrText}`;
  }

  static async extractFromPowerPoint(buffer, fileName) {
    try {
      const officeParser = await import('officeparser');
      
      console.log('📊 Processing PowerPoint:', fileName);
      
      // Create a temporary file for officeparser to read
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      const tempPath = path.join(os.tmpdir(), `temp-${Date.now()}-${fileName}`);
      await fs.promises.writeFile(tempPath, buffer);
      
      try {
        const data = await new Promise((resolve, reject) => {
          officeParser.parseOffice(tempPath, (data, err) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
        
        // Clean up temp file
        await fs.promises.unlink(tempPath).catch(() => {});
        
        if (!data || typeof data !== 'string' || data.length < 10) {
          return `PowerPoint presentation "${fileName}" was processed but contains very little readable text.

📊 Document Information:
• File: ${fileName}
• Type: PowerPoint Presentation
• Content Length: ${data?.length || 0} characters

🔍 This might be due to:
• Slides with mainly images or graphics
• Complex formatting or embedded objects
• Handwritten or drawn content

💡 Suggestions:
• Download the file to view it manually
• Switch to Global Mode for general AI assistance

📋 Content Preview:
${data?.substring(0, 200) || '[No text content found]'}`;
        }
        
        // Clean and normalize the text
        const cleanText = data
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/\s+/g, ' ')
          .trim();
        
        console.log('✅ PowerPoint text extracted, length:', cleanText.length);
        console.log('✅ PowerPoint text cleaned and processed');
        
        return cleanText;
        
      } catch (extractError) {
        // Clean up temp file on error
        await fs.promises.unlink(tempPath).catch(() => {});
        throw extractError;
      }
      
    } catch (error) {
      console.error('❌ PowerPoint extraction error:', error);
      return `PowerPoint presentation "${fileName}" could not be processed for text extraction. Error: ${error.message}`;
    }
  }

  static async extractFromWord(buffer, fileName) {
    try {
      const mammoth = await import('mammoth');
      
      console.log('📝 Processing Word document:', fileName);
      
      const result = await mammoth.extractRawText({ 
        buffer: buffer,
        convertImage: mammoth.images.ignoreAll
      });
      
      const text = result.value || '';
      console.log('✅ Word text extracted, length:', text.length);
      
      if (text.length < 50) {
        return `Word document "${fileName}" was processed but contains very little readable text.`;
      }
      
      const cleanText = text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      
      console.log('✅ Word document successfully processed');
      return cleanText;
    } catch (error) {
      console.error('❌ Word extraction error:', error);
      return `Word document "${fileName}" could not be processed. Error: ${error.message}`;
    }
  }
}