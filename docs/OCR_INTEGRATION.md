# 🖊️ OCR.space Integration for Handwritten Text Extraction

## Overview

NOTO now supports **handwritten text extraction** using OCR.space API (OCR Engine 2). This feature is specifically designed for scanned notes, handwritten documents, and images of handwritten text.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│  Upload Flow with Smart Text Extraction                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User uploads document → Selects "documentType"        │
│         │                                               │
│         ├─→ "Typed" → Standard extraction              │
│         │    (pdf.js-extract, mammoth, etc.)          │
│         │                                               │
│         └─→ "Handwritten" → OCR.space Engine2          │
│              • Compress to < 1MB if needed             │
│              • Send to OCR.space API                   │
│              • Extract handwritten text                │
│                                                         │
│  Text stored in MongoDB → Available for Chatbot        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Features

### ✅ **OCR Engine 2 Capabilities**
- 🖊️ **Optimized for handwritten text**
- 📸 **Works with photos and scans**
- 🔄 **Auto-rotation detection**
- 📊 **Better single character/digit recognition**
- 🌐 **Language auto-detection**
- 📝 **Handles confusing backgrounds**

### 📊 **Free Tier Limits**
- **25,000 requests/month**
- **500 requests/day per IP**
- **1MB file size limit** (we auto-compress)
- **3 PDF pages** max per file

## Setup Instructions

### 1. Get Your Free API Key

1. Visit: https://ocr.space/ocrapi/freekey
2. Register with your email
3. You'll receive an API key instantly

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# OCR.space API Configuration
OCRSPACE_API_KEY=your_api_key_here
OCRSPACE_ENGINE=2
OCRSPACE_API_URL=https://api.ocr.space/parse/image
```

### 3. Test the Integration

Start your backend server:
```bash
cd backend
npm run dev
```

Check OCR service status:
```bash
GET http://localhost:5000/api/ocr/status
```

Expected response:
```json
{
  "success": true,
  "data": {
    "available": true,
    "engine": 2,
    "maxFileSize": "1.00 MB",
    "apiUrl": "https://api.ocr.space/parse/image"
  }
}
```

## Usage

### Frontend Upload Form

Users select document type during upload:

```jsx
// From Upload.jsx
<div>
  <label>Document Type *</label>
  <button 
    onClick={() => setFormData({...formData, documentType: "typed"})}
  >
    Keyboard Typed
  </button>
  <button 
    onClick={() => setFormData({...formData, documentType: "handwritten"})}
  >
    Handwritten
  </button>
</div>
```

### Backend Processing

```javascript
// From fileController.js
const extractedText = await TextExtractionService.extractTextFromBuffer(
  fileBuffer,
  fileName,
  mimeType,
  documentType // "typed" or "handwritten"
);
```

### Chatbot Integration

Extracted text is automatically available in the chatbot:

```javascript
// From Chatbot.jsx
const documentText = file.extractedText;
// Used for context in AI responses
```

## File Size Optimization

Documents larger than 1MB are automatically compressed:

```javascript
// From ocrService.js
if (buffer.length > this.maxFileSize) {
  buffer = await this.compressForOCR(buffer, mimeType);
  // Converts to JPEG with quality=60, max width 2000px
}
```

### Compression Strategy

| Original | Compressed | Method |
|----------|------------|--------|
| 5MB PDF | ~800KB JPEG | First page to image, quality 60% |
| 3MB Image | ~600KB JPEG | Resize to 2000px width, quality 60% |
| 2MB DOCX | Not yet supported | Requires conversion library |

## Supported File Types

### ✅ Fully Supported (with OCR)
- **PDF** - First page converted to image
- **Images** (JPG, PNG, GIF, BMP, TIFF)

### ⚠️ Partially Supported
- **DOCX/PPT** - Requires additional conversion (coming soon)
- **TXT** - Text files don't need OCR

## Error Handling

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "File exceeds 1MB limit" | Original file too large | Compression failed - reduce file size manually |
| "OCR API rate limit reached" | 500 requests/day exceeded | Wait 24 hours or upgrade to PRO |
| "No readable text found" | Poor image quality | Upload higher quality scan |
| "API key invalid" | Wrong or expired key | Check OCRSPACE_API_KEY in .env |

## Performance Metrics

### Typical Processing Times

| File Type | Size | Processing Time |
|-----------|------|-----------------|
| Typed PDF | 2MB | ~2-3 seconds |
| Handwritten PDF | 2MB | ~8-12 seconds (includes compression + OCR) |
| Handwritten Image | 800KB | ~5-7 seconds |

## Upgrade Options

### OCR.space PRO Plan ($30/month)

Benefits:
- ✅ **5MB file size limit** (matches NOTO's upload limit)
- ✅ **300,000 requests/month**
- ✅ **Faster processing** (dedicated servers)
- ✅ **100% uptime SLA**
- ✅ **No watermarks** on PDFs

### When to Upgrade?

Consider upgrading when:
- Daily uploads exceed 500 documents
- 5MB documents are common
- Users report slow processing
- Free tier limits cause issues

## Database Schema

```javascript
// File Model (models/File.js)
{
  extractedText: String,          // Cached text content
  extractionStatus: {             // "pending" | "success" | "failed"
    type: String,
    enum: ['pending', 'success', 'failed', 'not-required']
  },
  extractionError: String,        // Error message if failed
  metadata: {
    documentType: String          // "typed" | "handwritten"
  }
}
```

## API Endpoints

### Check OCR Status
```http
GET /api/ocr/status
Authorization: Bearer <firebase-token>

Response:
{
  "success": true,
  "data": {
    "available": true,
    "engine": 2,
    "maxFileSize": "1.00 MB"
  }
}
```

## Troubleshooting

### OCR Not Working?

1. **Check API Key**
   ```bash
   # In backend directory
   echo $OCRSPACE_API_KEY
   ```

2. **Test API Directly**
   ```bash
   curl -X POST https://api.ocr.space/parse/image \
     -H "apikey: your_key" \
     -F "file=@test.jpg" \
     -F "OCREngine=2"
   ```

3. **Check Logs**
   ```bash
   # Backend logs will show:
   🖊️ [OCR] Starting handwritten text extraction
   ✅ [OCR] Text extraction completed
   ```

4. **Verify Document Type**
   - Ensure `documentType: "handwritten"` is sent from frontend
   - Check MongoDB to see if field is saved correctly

## Best Practices

### For Users
1. **Upload high-quality scans** (300 DPI or higher)
2. **Ensure good lighting** if photographing documents
3. **Keep handwriting clear** and well-spaced
4. **Use "Typed" for digital documents** (faster + better quality)

### For Developers
1. **Cache extracted text** in MongoDB (don't re-OCR)
2. **Handle errors gracefully** (extraction failure shouldn't block upload)
3. **Monitor API usage** to avoid rate limits
4. **Compress aggressively** to stay under 1MB

## Future Enhancements

- [ ] Support for DOCX/PPT handwritten conversions
- [ ] Multi-language support (currently English only)
- [ ] Batch processing for multiple pages
- [ ] User-selectable OCR quality vs speed
- [ ] Fallback to local Tesseract if API fails

## Credits

- **OCR.space** - Handwritten text extraction API
- **Sharp** - Image processing and compression
- **pdf-lib** - PDF manipulation

## Support

For issues with:
- **NOTO Integration**: Create GitHub issue
- **OCR.space API**: Visit https://ocr.space/contact or OCR API Forum

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
