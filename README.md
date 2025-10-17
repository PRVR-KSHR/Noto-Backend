Based on your comprehensive backend README, here's a **short and crisp description**:

***

# 📚 Noto Backend - Educational Document API

**Robust Node.js/Express API powering intelligent document management, OCR processing, and AI-driven educational assistance.**

## Overview

Noto Backend is a production-ready RESTful API built with Node.js 18+ and Express 5.1 that handles document processing, handwritten text extraction via OCR, multi-provider AI chatbot functionality, and secure user authentication through Firebase Admin SDK.

### 🌟 Core Features

- **📄 Smart Document Processing** - Upload and manage PDF, DOCX, PPTX, TXT files with intelligent routing
- **✍️ Advanced OCR Integration** - OCR.space API with Engine 2 for handwritten text extraction (25k/month, 500/day limit)
- **🤖 Multi-Provider AI Chatbot** - Groq and Gemini integration with document-specific and global knowledge modes
- **🔐 Firebase Authentication** - JWT token verification with Firebase Admin SDK
- **📅 Event Management** - CRUD operations with Cloudinary image storage
- **☁️ Cloud Storage** - Cloudinary CDN integration for optimized image delivery
- **🛡️ Enterprise Security** - Helmet, CORS, rate limiting (100 req/15min), HPP protection
- **💾 Intelligent Storage** - 98% MongoDB savings by storing only handwritten document text

### 🛠️ Tech Stack

**Backend:** Node.js 18+ | Express 5.1 | MongoDB Atlas  
**Authentication:** Firebase Admin SDK 13.5  
**Storage:** Cloudinary 2.7  
**Document Processing:** pdf-parse | mammoth | pptx-parser | OCR.space API  
**AI:** Groq SDK | Google Generative AI 0.24  
**Security:** Helmet | CORS | express-rate-limit | HPP

### 🚀 Quick Start

```bash
git clone https://github.com/PRVR-KSHR/noto-backend.git
cd noto-backend
npm install
# Configure .env with credentials
npm run dev
```

### 🔌 Key API Endpoints

- **Auth:** `/api/auth/register` | `/api/auth/login` | `/api/auth/verify`
- **Files:** `/api/files/upload` | `/api/files` | `/api/files/:id` | `/api/files/chat`
- **Events:** `/api/events` (CRUD with admin protection)
- **Donations:** `/api/donations` (UPI integration)
- **Messages:** `/api/messages` (inquiry system)

### 📊 Intelligent Processing Pipeline

1. **Typed Documents** (PDF/DOCX/PPTX) → Client-side extraction → No MongoDB storage
2. **Handwritten Documents** → Server-side OCR.space (Engine 2) → MongoDB storage → 3-page chunking

**Result:** 98% storage cost reduction with intelligent routing

### 🤖 AI Chatbot Features

- **Document Mode:** Context-aware Q&A about uploaded files
- **Global Mode:** General knowledge queries
- **Provider Chain:** Groq (4 models) → Gemini fallback → 3 retry attempts
- **Error Handling:** Rate limits, OCR quotas, authentication errors, service overload with user-friendly guidance

### 🛡️ Security Layers

✅ Helmet security headers | ✅ CORS allowlist | ✅ Rate limiting (100/15min) | ✅ Firebase JWT verification | ✅ HPP protection | ✅ Input sanitization | ✅ Trust proxy configuration

### 📦 Production Ready

- **PM2 support** for process management
- **Winston logging** with configurable levels
- **MongoDB indexing** for optimized queries
- **Gzip compression** for responses
- **Comprehensive error handling** with structured JSON responses
- **Health check endpoint** for monitoring

### 🎯 Perfect For

Educational institutions managing document repositories, platforms requiring OCR processing, applications needing AI-powered document Q&A, and systems with secure multi-role authentication.

**Free Tier Optimizations:** OCR.space (25k/month) | MongoDB selective storage | Cloudinary CDN | Groq/Gemini AI APIs

***
