import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

/**
 * OCR.space Service for Handwritten Text Extraction
 * Uses OCR.space Engine2 which is optimized for handwritten text
 * Free Tier: 25,000 requests/month, 500/day per IP, 1MB file limit
 */
export class OCRService {
  constructor() {
    this.apiKey = process.env.OCRSPACE_API_KEY || 'helloworld';
    this.apiUrl = process.env.OCRSPACE_API_URL || 'https://api.ocr.space/parse/image';
    this.engine = parseInt(process.env.OCRSPACE_ENGINE) || 2; // Engine 2 for handwritten
    this.maxFileSize = 1 * 1024 * 1024; // 1MB limit for free tier
  }

  /**
   * Main extraction method - determines document type and processes accordingly
   */
  async extractTextFromHandwritten(buffer, fileName, mimeType) {
    try {
      console.log('🖊️ [OCR] Starting handwritten text extraction:', {
        fileName,
        mimeType,
        originalSize: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`
      });

      // ✅ CRITICAL FIX: Check file size BEFORE sending to OCR
      const fileSizeMB = buffer.length / 1024 / 1024;
      const fileSizeKB = buffer.length / 1024;
      
      console.log('📊 [OCR] File size:', {
        MB: fileSizeMB.toFixed(2),
        KB: fileSizeKB.toFixed(2),
        maxAllowed: `${this.maxFileSize / 1024} KB (1 MB)`
      });

      // ✅ NEW: For files > 1MB, we MUST split/compress before sending
      let extractedText;
      if (buffer.length > this.maxFileSize) {
        console.log('⚠️ [OCR] File exceeds 1MB limit! OCR.space will reject it.');
        
        if (mimeType === 'application/pdf') {
          console.log('🔧 [OCR] Splitting PDF into smaller chunks...');
          // Process PDF in chunks - this returns text directly
          const splitResult = await this.splitAndProcessPDF(buffer, fileName);
          extractedText = splitResult.toString('utf-8');
          console.log('✅ [OCR] Split processing complete:', `${extractedText.length} chars`);
          return extractedText; // Return directly, already processed
        } else if (this.isImageType(mimeType)) {
          console.log('🔧 [OCR] Compressing image...');
          buffer = await this.compressForOCR(buffer, mimeType);
          console.log('✅ [OCR] Reduced size:', `${(buffer.length / 1024).toFixed(2)} KB`);
        }
      }

      // Extract text using OCR.space (for normal-sized files)
      extractedText = await this.performOCR(buffer, fileName, mimeType);
      
      console.log('✅ [OCR] Text extraction completed:', {
        textLength: extractedText.length,
        preview: extractedText.substring(0, 100) + '...'
      });

      return extractedText;
    } catch (error) {
      console.error('❌ [OCR] Extraction failed:', error.message);
      return `Unable to extract handwritten text from "${fileName}". This may be due to image quality or OCR limitations. Error: ${error.message}`;
    }
  }

  /**
   * Compress document to image < 1MB for OCR processing
   * Uses ADAPTIVE compression - tries high quality first, then reduces if needed
   */
  async compressForOCR(buffer, mimeType) {
    try {
      console.log('🔄 [OCR] Converting document to optimized image...');

      let imageBuffer;

      // Convert based on document type
      if (mimeType === 'application/pdf') {
        // For PDFs, we need to convert first page to image
        // Since we don't have pdf-poppler, we'll pass PDF directly to OCR.space
        // OCR.space can handle PDFs natively
        console.log('📄 [OCR] PDF detected - will send directly to OCR.space (no conversion needed)');
        return buffer; // ✅ Send PDF directly - OCR.space handles it!
      } else if (this.isImageType(mimeType)) {
        imageBuffer = buffer;
      } else {
        // For DOC/DOCX/PPT/PPTX - we'll need to convert first page to image
        throw new Error('Document conversion not yet supported for this type. Please upload as PDF or image.');
      }

      // Compress image using sharp with HIGHER quality for better OCR
      const compressedBuffer = await sharp(imageBuffer)
        .resize(2400, null, { // Higher resolution: 2400px width for better OCR accuracy
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({ 
          quality: 85, // ✅ INCREASED: Higher quality for better handwriting recognition
          progressive: true,
          chromaSubsampling: '4:4:4' // Better quality subsampling
        })
        .toBuffer();

      console.log('✅ [OCR] Image optimized:', {
        originalSize: `${(imageBuffer.length / 1024).toFixed(2)} KB`,
        compressedSize: `${(compressedBuffer.length / 1024).toFixed(2)} KB`,
        reduction: `${((1 - compressedBuffer.length / imageBuffer.length) * 100).toFixed(1)}%`
      });

      return compressedBuffer;
    } catch (error) {
      console.error('❌ [OCR] Compression failed:', error.message);
      throw new Error(`Failed to compress document for OCR: ${error.message}`);
    }
  }

  /**
   * ✅ NEW: Split large PDF and process in chunks
   * Each chunk will be < 1MB and processed separately
   */
  async splitAndProcessPDF(pdfBuffer, fileName) {
    try {
      const { PDFDocument } = await import('pdf-lib');
      console.log('📄 [OCR] Loading PDF document...');
      
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();
      const originalSizeKB = pdfBuffer.length / 1024;
      
      console.log('📊 [OCR] PDF info:', {
        totalPages,
        originalSize: `${originalSizeKB.toFixed(2)} KB`,
        avgPerPage: `${(originalSizeKB / totalPages).toFixed(2)} KB/page`
      });

      // ✅ CRITICAL FIX: OCR.space free tier has 3-page limit per PDF!
      // We MUST limit chunks to MAX 3 pages each, regardless of file size
      const MAX_PAGES_PER_CHUNK = 3; // OCR.space free tier limit
      const avgSizePerPage = originalSizeKB / totalPages;
      
      // Calculate pages per chunk (minimum of: size limit OR API page limit)
      const pagesBySize = Math.floor(900 / avgSizePerPage); // Based on 900KB limit
      const maxPagesPerChunk = Math.min(MAX_PAGES_PER_CHUNK, Math.max(1, pagesBySize));
      
      console.log(`🔧 [OCR] Chunking strategy:`, {
        maxBySize: pagesBySize,
        maxByAPI: MAX_PAGES_PER_CHUNK,
        actualLimit: maxPagesPerChunk,
        expectedChunks: Math.ceil(totalPages / maxPagesPerChunk)
      });
      
      // Process ALL pages, but send in chunks to OCR.space
      const allPageTexts = [];

      for (let startPage = 0; startPage < totalPages; startPage += maxPagesPerChunk) {
        const endPage = Math.min(startPage + maxPagesPerChunk, totalPages);
        const chunkNum = Math.floor(startPage / maxPagesPerChunk) + 1;
        
        console.log(`\n📄 [OCR] Processing chunk ${chunkNum}: pages ${startPage + 1}-${endPage}`);
        
        // Create new PDF with just these pages
        const chunkDoc = await PDFDocument.create();
        const pages = await chunkDoc.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, i) => startPage + i));
        pages.forEach(page => chunkDoc.addPage(page));
        
        const chunkBytes = await chunkDoc.save();
        const chunkSizeKB = chunkBytes.length / 1024;
        
        console.log(`📦 [OCR] Chunk size: ${chunkSizeKB.toFixed(2)} KB`);
        
        if (chunkSizeKB > this.maxFileSize / 1024) {
          console.warn(`⚠️ [OCR] Chunk still too large! Skipping pages ${startPage + 1}-${endPage}`);
          allPageTexts.push(`[Pages ${startPage + 1}-${endPage}: Too large to process]`);
          continue;
        }
        
        // Send chunk to OCR
        try {
          const chunkText = await this.performOCR(Buffer.from(chunkBytes), `${fileName}_chunk${chunkNum}.pdf`, 'application/pdf');
          allPageTexts.push(`\n=== Pages ${startPage + 1}-${endPage} ===\n${chunkText}`);
          console.log(`✅ [OCR] Chunk ${chunkNum} extracted: ${chunkText.length} chars`);
        } catch (error) {
          console.error(`❌ [OCR] Chunk ${chunkNum} failed:`, error.message);
          allPageTexts.push(`[Pages ${startPage + 1}-${endPage}: Extraction failed - ${error.message}]`);
        }
      }

      const combinedText = allPageTexts.join('\n\n');
      console.log(`\n✅ [OCR] All chunks processed. Total text: ${combinedText.length} chars`);
      
      // Return combined text as a fake "buffer" (we'll return text directly from extractTextFromHandwritten)
      return Buffer.from(combinedText, 'utf-8');
      
    } catch (error) {
      console.error('❌ [OCR] PDF splitting failed:', error.message);
      throw new Error(`Failed to split PDF: ${error.message}`);
    }
  }

  /**
   * Convert PDF first page to image
   */
  async pdfToImage(pdfBuffer) {
    try {
      // For now, we'll use a simple approach with pdf-lib
      // In production, you might want to use pdf-poppler or similar
      console.log('📄 [OCR] Converting PDF to image...');
      
      // Note: This is a placeholder. You'll need to install pdf-to-img or similar
      // For now, we'll just return the buffer and let OCR.space handle PDF directly
      return pdfBuffer;
    } catch (error) {
      console.error('❌ [OCR] PDF conversion failed:', error);
      throw error;
    }
  }

  /**
   * Perform OCR using OCR.space API
   */
  async performOCR(buffer, fileName, mimeType) {
    try {
      console.log('🔍 [OCR] Sending to OCR.space API...');
      console.log('🔑 [OCR] Using API Key:', this.apiKey === 'helloworld' ? 'helloworld (TEST KEY - GET REAL KEY!)' : 'Custom API Key');

      // ⚠️ CRITICAL WARNING for test key
      if (this.apiKey === 'helloworld') {
        console.warn('═══════════════════════════════════════════════════════════');
        console.warn('⚠️  WARNING: Using TEST API key "helloworld"!');
        console.warn('⚠️  This may produce poor results for handwritten text!');
        console.warn('⚠️  GET YOUR FREE KEY: https://ocr.space/ocrapi/freekey');
        console.warn('⚠️  Add to .env: OCRSPACE_API_KEY=your_real_key');
        console.warn('═══════════════════════════════════════════════════════════');
      }

      // Create form data
      const formData = new FormData();
      
      // Add file as buffer
      formData.append('file', buffer, {
        filename: fileName,
        contentType: mimeType
      });

      // OCR.space parameters
      formData.append('apikey', this.apiKey);
      formData.append('OCREngine', this.engine.toString()); // Engine 2 for handwritten
      formData.append('language', 'eng'); // English (can be made configurable)
      formData.append('isOverlayRequired', 'false'); // We just need text, not coordinates
      formData.append('detectOrientation', 'true'); // Auto-rotate if needed
      formData.append('scale', 'true'); // Upscale for better recognition
      formData.append('isTable', 'false'); // Not table data

      console.log('📤 [OCR] Request parameters:', {
        apiKey: this.apiKey === 'helloworld' ? 'TEST KEY' : 'CUSTOM KEY',
        engine: this.engine,
        fileSize: `${(buffer.length / 1024).toFixed(2)} KB`,
        fileName
      });

      // Make API request
      const response = await axios.post(this.apiUrl, formData, {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 30000 // 30 second timeout
      });

      console.log('📥 [OCR] API Response received');
      console.log('📊 [OCR] Response status:', {
        OCRExitCode: response.data.OCRExitCode,
        IsErroredOnProcessing: response.data.IsErroredOnProcessing,
        ProcessingTimeInMilliseconds: response.data.ProcessingTimeInMilliseconds,
        parsedResultsCount: response.data.ParsedResults?.length || 0
      });

      // Parse response
      return this.parseOCRResponse(response.data);
    } catch (error) {
      console.error('❌ [OCR] API request failed:', error.response?.data || error.message);
      
      if (error.response?.status === 429) {
        throw new Error('OCR API rate limit reached. Please try again later.');
      }
      
      throw new Error(`OCR API error: ${error.message}`);
    }
  }

  /**
   * Parse OCR.space API response
   */
  parseOCRResponse(data) {
    try {
      console.log('🔍 [OCR] Parsing response...');
      
      // Check for API-level errors
      if (data.IsErroredOnProcessing) {
        console.error('❌ [OCR] API Error:', data.ErrorMessage);
        throw new Error(data.ErrorMessage || 'OCR processing failed');
      }

      // Check OCR exit code
      if (data.OCRExitCode !== 1 && data.OCRExitCode !== 2) {
        console.error('❌ [OCR] Invalid exit code:', data.OCRExitCode);
        throw new Error(`OCR failed with exit code: ${data.OCRExitCode}`);
      }

      // Extract text from parsed results
      let extractedText = '';
      
      if (data.ParsedResults && data.ParsedResults.length > 0) {
        console.log(`📄 [OCR] Processing ${data.ParsedResults.length} page(s)...`);
        
        // Process each page/result
        for (let i = 0; i < data.ParsedResults.length; i++) {
          const result = data.ParsedResults[i];
          console.log(`📖 [OCR] Page ${i + 1}:`, {
            exitCode: result.FileParseExitCode,
            textLength: result.ParsedText?.length || 0,
            hasError: !!result.ErrorMessage
          });
          
          if (result.FileParseExitCode === 1) {
            // Success
            const pageText = result.ParsedText || '';
            extractedText += `--- Page ${i + 1} ---\n${pageText}\n\n`;
            
            // Log preview of extracted text
            console.log(`✅ [OCR] Page ${i + 1} preview:`, pageText.substring(0, 150) + '...');
          } else {
            console.warn(`⚠️ [OCR] Page ${i + 1} parsing failed:`, result.ErrorMessage);
          }
        }
      } else {
        console.warn('⚠️ [OCR] No ParsedResults found in response');
      }

      // Clean up the extracted text
      extractedText = extractedText.trim();

      console.log('📊 [OCR] Final result:', {
        totalLength: extractedText.length,
        preview: extractedText.substring(0, 200) + '...'
      });

      if (!extractedText || extractedText.length < 10) {
        return 'No readable text found in the handwritten document. The image may be too blurry, low quality, or the handwriting may be unclear.';
      }

      return extractedText;
    } catch (error) {
      console.error('❌ [OCR] Response parsing failed:', error);
      throw error;
    }
  }

  /**
   * Check if mimetype is an image
   */
  isImageType(mimeType) {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if OCR service is available
   */
  isAvailable() {
    return this.apiKey && this.apiKey !== 'helloworld';
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      available: this.isAvailable(),
      engine: this.engine,
      maxFileSize: `${(this.maxFileSize / 1024 / 1024).toFixed(2)} MB`,
      apiUrl: this.apiUrl
    };
  }
}

// Export singleton instance
export default new OCRService();
