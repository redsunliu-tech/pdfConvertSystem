# PDF Convert System

An online PDF document processing and conversion platform built with Spring Boot 3 and React 19. Supports PDF conversion, batch processing, and online PDF editing (annotations, page operations, signatures, watermarks).

[中文文档](README.md)

## Features

### PDF Conversion

| Type | Description | Options |
|:---|:---|:---|
| PDF to Image | Render PDF pages as images | Format (PNG/JPG/Auto), DPI (72/150/300/600/Auto), JPG quality |
| Image to PDF | Convert images to PDF | Page size (A4/A3/Letter/Legal/Fit), Orientation (Portrait/Landscape) |
| Office to PDF | Convert Word/Excel/PPT to PDF | Embed fonts toggle |

### Batch Processing

| Feature | Description |
|:---|:---|
| Merge PDF | Combine multiple PDFs into one file with drag-and-drop ordering |
| Batch Image to PDF | Each image as separate PDF or all images merged into one PDF |
| Batch PDF to Image | Multi-file parallel conversion, results packaged for download |
| Batch Office to PDF | Batch convert Word/Excel/PPT documents |

### Online PDF Editing

| Feature | Description |
|:---|:---|
| Annotation - Highlight | Rectangular area highlight with transparency control |
| Annotation - Text | Add text annotations on PDF |
| Annotation - Rectangle | Draw rectangle annotations with custom colors |
| Annotation - Signature | Handwritten signature, signature library, image upload |
| Page Rotation | Rotate single page left/right 90°, supports reset |
| Page Deletion | Mark pages for deletion, applied on export |
| Page Reordering | Move pages up/down to adjust order |
| Text Watermark | Full-page tiled text watermark with custom text/font size/opacity/rotation |
| Image Watermark | Full-page tiled image watermark |
| Annotation Management | Edit, copy to other pages, move to other pages, delete |

### System Features

- User registration/login with JWT Token authentication
- File upload (single/batch)
- File management (view/download/delete)
- Conversion history
- Account settings

## Tech Stack

### Backend

| Technology | Version | Description |
|:---|:---|:---|
| Java | 17 | JDK version |
| Spring Boot | 3.1.0 | Framework |
| Spring Security Crypto | 6.1.0 | Password encryption |
| Spring Data JPA / Hibernate | 6.2.x | ORM framework |
| PostgreSQL | 42.6.0 | Database driver |
| Apache PDFBox | 2.0.32 | PDF parsing, rendering, editing |
| JODConverter | 4.4.8 | LibreOffice document conversion bridge |
| JJWT | 0.12.3 | JWT tokens |
| Kaptcha | 2.3.2 | CAPTCHA |
| Lombok | 1.18.28 | Code simplification |

### Frontend

| Technology | Version | Description |
|:---|:---|:---|
| React | 19.2.7 | UI framework |
| TypeScript | 7.0.2 | Type system |
| Vite | 8.1.5 | Build tool |
| React Router DOM | 6.30.4 | Routing |
| PDF.js | 4.4.168 | PDF rendering engine |

## Project Structure

```
pdfConvertSystem/
├── backend/                          # Spring Boot Backend
│   ├── config/
│   │   └── application.yml           # External runtime config (not bundled)
│   ├── src/main/
│   │   ├── java/org/example/
│   │   │   ├── config/               # Spring configuration classes
│   │   │   ├── controller/           # REST API controllers
│   │   │   ├── dto/                  # Data Transfer Objects
│   │   │   ├── entity/               # JPA entities
│   │   │   ├── repository/           # Data access layer
│   │   │   ├── service/              # Business logic layer
│   │   │   ├── util/                 # Utility classes
│   │   │   └── Main.java             # Application entry point
│   │   └── resources/
│   │       ├── application.yml       # Internal default config (with placeholders)
│   │       ├── static/               # Frontend static assets (after build)
│   │       └── fonts/                # Chinese fonts for PDF editing
│   └── start.sh                      # Startup script
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── components/               # UI components
│   │   ├── types/                    # TypeScript type definitions
│   │   ├── utils/                    # Frontend utilities
│   │   └── config.ts                 # API base URL config
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

## Prerequisites

| Dependency | Minimum Version | Description |
|:---|:---|:---|
| JDK | 17 | Backend runtime |
| Maven | 3.8+ | Backend build |
| Node.js | 18+ | Frontend build |
| PostgreSQL | 14+ | Database |
| LibreOffice | 7.x | Required for Office to PDF conversion |

## Quick Start

### 1. Prepare Database

Create the database:

```bash
createdb pdf_convert_db
```

### 2. Start Backend

```bash
cd backend

# Create external config
mkdir -p config
cat > config/application.yml << 'EOF'
IP_ADDRESS: 127.0.0.1
DB_USER: postgres
DB_PWD: your_password
UPLOAD_DIR: /tmp/pdf_uploads
CONVERTED_DIR: /tmp/pdf_converted
SERVER_URL: http://127.0.0.1:8080
EOF

# Build
mvn clean package -DskipTests

# Run
./start.sh
```

Backend will be available at <http://127.0.0.1:8080>.

### 3. Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Dev mode (default port 5173, /api proxies to backend 8080)
npm run dev
```

Frontend dev server at <http://127.0.0.1:5173>.

### 4. Production Build (Integrated Deployment)

```bash
# 1. Build frontend
cd frontend
npm run build

# 2. Copy frontend output to Spring Boot static resources
rm -rf ../backend/src/main/resources/static
mkdir -p ../backend/src/main/resources/static
cp -r dist/* ../backend/src/main/resources/static/

# 3. Build backend (includes frontend static assets)
cd ../backend
mvn clean package -DskipTests

# 4. Run
java -jar target/pdfConvertSystem-1.0-SNAPSHOT.jar \
  --spring.config.location="classpath:/,file:./config/"
```

## Configuration

### Backend Configuration Loading Order

| Priority | Source | Description |
|:---|:---|:---|
| 1 (highest) | External `config/application.yml` | External config, not bundled |
| 2 | Internal `classpath:application.yml` | Default config with placeholders inside jar |
| 3 | Command line `--key=value` | Launch arguments |

【Source】Spring Boot 3.1.0 Reference Documentation - Property Source Precedence
https://docs.spring.io/spring-boot/docs/3.1.0/reference/html/core.html#properties
【Reliability】★★★

### Internal application.yml (inside jar)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${IP_ADDRESS}:5432/pdf_convert_db
    username: ${DB_USER}
    password: ${DB_PWD}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
  servlet:
    multipart:
      enabled: true
      max-file-size: 50MB
      max-request-size: 200MB

jwt:
  secret: 9iX9BeXyQxe/SDb5TQyk1l9YfdfgQAPobxCuAStv9rc=
  access-token-expire: 3600000
  refresh-token-expire: 604800000

file:
  upload-dir: ${UPLOAD_DIR}
  converted-dir: ${CONVERTED_DIR}
  server-url: ${SERVER_URL}

app:
  cookie:
    http-only: true
    secure: false
    same-site: Lax
    path: /
    access-token-max-age: 3600
    refresh-token-max-age: 604800
```

### External config/application.yml

```yaml
IP_ADDRESS: 127.0.0.1
DB_USER: postgres
DB_PWD: your_password
UPLOAD_DIR: /data/uploads
CONVERTED_DIR: /data/converted
SERVER_URL: http://127.0.0.1:8080
```

### Frontend Configuration

The frontend connects to the backend via `API_BASE_URL` in `frontend/src/config.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

In dev mode, Vite proxies `/api` to `http://127.0.0.1:8080`.
For production deployment (same origin), leave `VITE_API_BASE_URL` empty.

## API Overview

All endpoints are prefixed with `/api`. Authenticated endpoints use cookies for JWT token transfer.

### Authentication

| Method | Path | Description |
|:---|:---|:---|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/info` | Get current user info |
| GET | `/api/auth/captcha` | Get CAPTCHA |

### File Management

| Method | Path | Description |
|:---|:---|:---|
| POST | `/api/files/upload` | Single file upload |
| POST | `/api/files/upload/batch` | Batch file upload |
| GET | `/api/files` | Get current user's file list |
| GET | `/api/files/{id}/preview` | File preview |
| GET | `/api/files/{id}/download` | File download |
| GET | `/api/files/{id}/view` | File view |
| DELETE | `/api/files/{id}` | Delete file |

### Conversion

| Method | Path | Description |
|:---|:---|:---|
| POST | `/api/convert/start` | Start a single conversion task |
| GET | `/api/convert/status/{taskId}` | Query conversion status |
| GET | `/api/convert/result/{taskId}` | Get conversion result |
| GET | `/api/convert/history` | Get conversion history |
| POST | `/api/convert/batch` | Start batch conversion task |
| GET | `/api/convert/batch/{taskId}` | Query batch task status |

### PDF Editing

| Method | Path | Description |
|:---|:---|:---|
| POST | `/api/pdf/edit` | Submit PDF editing (annotations + page operations + watermarks) |

## Deployment

### Delivery Package

```
deploy/
├── pdfConvertSystem-1.0-SNAPSHOT.jar   # Executable jar (includes frontend static assets)
├── start.sh                             # Startup script
└── config/
    └── application.yml                  # Fill in actual config for deployment
```

### Server Requirements

- JDK 17+
- PostgreSQL 14+ (running with `pdf_convert_db` created)
- LibreOffice 7.x (required for Office to PDF conversion, `soffice` must be available in PATH)
- Read/write permissions for upload/download directories

### Startup Command

```bash
java -jar pdfConvertSystem-1.0-SNAPSHOT.jar \
  --spring.config.location="classpath:/,file:./config/"
```

Or use the startup script:

```bash
chmod +x start.sh
./start.sh
```

## FAQ

### Office to PDF Conversion Fails

Ensure LibreOffice is installed and `soffice` is available:

```bash
which soffice
soffice --version
```

【Source】JODConverter 4.4.8 Documentation - Prerequisites
https://jodconverter.readthedocs.io/en/latest/
【Reliability】★★

### File Upload Size Limit

Default max file size: 50MB, max request size: 200MB. Modify `application.yml`:

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 100MB
      max-request-size: 500MB
```

【Source】Spring Boot 3.1.0 Reference Documentation - Servlet MultiPart
https://docs.spring.io/spring-boot/docs/3.1.0/reference/html/web.html#web.servlet.spring-mvc.multipart
【Reliability】★★★

### Production Security Recommendations

1. Replace `jwt.secret` with a high-strength random key
2. Set `app.cookie.secure=true` (for HTTPS environments)
3. Set `spring.jpa.show-sql=false` to disable SQL logging
4. Configure HTTPS certificates and a reverse proxy (e.g., Nginx)
5. Periodically clean up temporary files in `upload-dir` and `converted-dir`

## Architecture

### Integrated Frontend-Backend Deployment

This project uses the Spring Boot embedded static resources approach: the frontend `dist/` output is placed into `backend/src/main/resources/static/` and packaged into a single fat jar.

【Approach】Spring Boot automatically serves static resources from `/static`, `/public`, `/resources` on the classpath. SPA route fallback is handled via a custom Filter.
【Source】Spring Boot 4.0 Reference Documentation - Web Servlet MVC Static Resources
https://docs.spring.io/spring-boot/4.0/reference/web/servlet.html
【Reliability】★★★

### PDF Processing Architecture

- **PDF Rendering**: Apache PDFBox 2.0.32 renders PDF pages to BufferedImage with DPI control
- **PDF Editing**: PDFBox directly manipulates PDF document structure, supporting annotations (highlight/text/rectangle/signature), page rotation, page deletion, page reordering, text/image watermarks
- **Office Conversion**: JODConverter invokes local LibreOffice processes for DOC/DOCX/XLS/XLSX/PPT/PPTX to PDF conversion
- **PDF to Image**: Analyzes page type (scan/vector), extracts embedded images for scanned pages, renders vector pages using PDFRenderer

### Batch Task Processing

Batch tasks use a bounded thread pool (core 2 threads, max 5 threads, queue capacity 10) to prevent OOM. Task state is persisted in the database, and the frontend polls for progress.

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT-license). Copyright (c) 2026 Hubert Liu. 