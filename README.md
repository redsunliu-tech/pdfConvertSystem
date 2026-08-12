# PDF Convert System

> 一款基于 Spring Boot + React 的在线 PDF 文档转换与编辑平台，支持 PDF ↔ 图片、Office ↔ PDF、PDF 编辑（旋转/删除页面/水印/签名）、批量转换等功能。

---

## 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术架构](#技术架构)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
  - [1. 数据库准备](#1-数据库准备)
  - [2. 后端启动](#2-后端启动)
  - [3. 前端启动](#3-前端启动)
- [API 接口文档](#api-接口文档)
- [使用指南](#使用指南)
- [配置说明](#配置说明)
- [部署说明](#部署说明)
- [许可证](#许可证)

---

## 项目简介

PDF Convert System 是一个全栈 Web 应用，旨在提供一站式 PDF 文档处理解决方案。用户可以通过浏览器上传文件，完成格式转换、编辑、预览和下载等操作，无需安装任何桌面软件。

核心功能包括：
- **格式转换**：PDF ↔ 图片、Office（Word/Excel/PPT）→ PDF、图片 → PDF
- **PDF 编辑**：页面旋转、页面删除、水印添加、电子签名
- **批量处理**：多文件批量转换、PDF 合并、图片合并为 PDF
- **用户系统**：注册登录、JWT 鉴权、个人设置管理
- **在线预览**：内置 PDF 查看器，支持缩放、翻页、跳转

---

## 功能特性

| 功能模块 | 说明 |
|---------|------|
| 用户认证 | 注册、登录（含图形验证码）、JWT Access/Refresh Token 双令牌机制 |
| 文件管理 | 上传（单文件/批量）、删除、列表查询、在线预览、下载 |
| PDF → 图片 | 支持 PNG/JPG/TIFF 等格式，智能 DPI 分析（自动识别扫描件/矢量图） |
| 图片 → PDF | 支持单张/批量图片转 PDF，可选 A4/A3/Letter/Legal 页面尺寸 |
| Office → PDF | 基于 LibreOffice，支持 DOCX/XLSX/PPTX 转 PDF，支持字体嵌入 |
| PDF 编辑 | 页面旋转、页面删除、文字/图片水印、电子签名板 |
| 批量转换 | 多文件批量处理，独立任务进度追踪 |
| PDF 合并 | 多个 PDF 合并为一个文件 |
| 图片合并 | 多张图片合并为一个 PDF（支持多页排列） |
| 转换历史 | 查看所有历史转换记录，支持重新下载 |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户浏览器                           │
│              React 19 + TypeScript                      │
│                   Vite 构建                              │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP / REST API
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Spring Boot 3.1 后端服务                    │
│  ┌───────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ AuthController  │ ConvertController │ FileController │    │
│  └─────┬─────┘ └──────┬───────┘ └────────┬─────────┘    │
│        │              │                   │              │
│  ┌─────┴──────────────┴───────────────────┴─────┐        │
│  │              Service 层                       │        │
│  │  AuthService / ConvertService / PdfEditService│        │
│  └─────┬──────────────┬───────────────────┬─────┘        │
│        │              │                   │              │
│  ┌─────┴─────┐  ┌─────┴─────┐  ┌─────────┴─────────┐   │
│  │  JPA Repository │  JWT Util  │   OfficeConfig      │   │
│  └─────┬─────┘  └───────────┘  └─────────┬─────────┘   │
│        │                                  │              │
│  ┌─────┴──────────────────────────────────┴─────┐       │
│  │            Apache PDFBox  /  JODConverter    │       │
│  └──────────────────────────────────────────────┘       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL 数据库                           │
│         用户 / 文件 / 转换任务 / 批量任务                │
└─────────────────────────────────────────────────────────┘
```

---

## 技术栈

### 后端

| 技术 | 版本 | 用途 |
|-----|------|------|
| Java | 17 | 编程语言 |
| Spring Boot | 3.1.0 | 应用框架 |
| Spring Data JPA | 3.1.0 | ORM 持久层 |
| PostgreSQL | 15+ | 关系型数据库 |
| Apache PDFBox | 2.0.32 | PDF 解析与操作 |
| JODConverter | 4.4.8 | LibreOffice 集成（Office 转 PDF） |
| Apache Commons Compress | 1.26.0 | ZIP 压缩（多图打包） |
| Apache POI | 5.2.5 | Word 文档处理 |
| JJWT | 0.12.3 | JWT 令牌 |
| Kaptcha | 2.3.2 | 图形验证码 |
| Lombok | 1.18.28 | 简化代码 |

### 前端

| 技术 | 版本 | 用途 |
|-----|------|------|
| React | 19.2.7 | UI 框架 |
| TypeScript | 7.0.2 | 类型安全 |
| Vite | 8.1.5 | 构建工具 |
| React Router | 6.30.4 | 路由管理 |
| PDF.js | 4.4.168 | PDF 前端预览 |
| OxLint | 1.71.0 | 代码检查 |

### 外部依赖

| 依赖 | 用途 |
|-----|------|
| LibreOffice | Office 文档转 PDF 的底层引擎 |

---

## 目录结构

```
pdfConvertSystem/
├── backend/                              # Spring Boot 后端
│   ├── src/
│   │   └── main/
│   │       ├── java/org/example/
│   │       │   ├── config/              # 配置类（CORS、Office、JWT 等）
│   │       │   ├── controller/         # REST API 控制层
│   │       │   │   ├── AuthController.java
│   │       │   │   ├── ConvertController.java
│   │       │   │   ├── FileController.java
│   │       │   │   └── PdfEditController.java
│   │       │   ├── dto/                 # 数据传输对象
│   │       │   ├── entity/              # JPA 实体类
│   │       │   ├── repository/          # 数据访问层
│   │       │   ├── service/             # 业务逻辑层
│   │       │   │   └── impl/
│   │       │   ├── util/                # 工具类（JWT、文件名、PDF 操作等）
│   │       │   └── Main.java            # 启动类
│   │       └── resources/
│   │           ├── application.yml      # 应用配置
│   │           └── fonts/              # CJK 字体文件
│   └── pom.xml                          # Maven 依赖
│
├── frontend/                            # React 前端
│   ├── src/
│   │   ├── components/                  # React 组件
│   │   │   ├── Login.tsx               # 登录页
│   │   │   ├── Register.tsx            # 注册页
│   │   │   ├── Dashboard.tsx           # 主面板
│   │   │   ├── FileList.tsx            # 文件列表
│   │   │   ├── History.tsx             # 转换历史
│   │   │   ├── Settings.tsx            # 账户设置
│   │   │   ├── PdfEditor.tsx           # PDF 编辑器
│   │   │   ├── PdfViewer.tsx           # PDF 查看器
│   │   │   ├── SignaturePad.tsx        # 电子签名板
│   │   │   ├── Sidebar.tsx             # 侧边栏
│   │   │   └── Topbar.tsx              # 顶部导航
│   │   ├── types/                      # TypeScript 类型定义
│   │   ├── utils/                      # 工具函数
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── config.ts
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

## 环境要求

| 依赖 | 版本要求 | 说明 |
|-----|---------|------|
| JDK | 17+ | 推荐使用 Oracle JDK 或 OpenJDK |
| Maven | 3.8+ | 后端构建工具（Spring Boot 自带 mvnw） |
| Node.js | 20+ | 前端构建运行 |
| npm / pnpm | 最新版 | 包管理器 |
| PostgreSQL | 15+ | 数据库 |
| LibreOffice | 7.x+ | Office 转 PDF 必需 |

---

## 快速开始

### 1. 数据库准备

```bash
# 启动 PostgreSQL（macOS 使用 brew）
brew services start postgresql

# 创建数据库
createdb pdf_convert_db

# 或使用 SQL 命令
psql -c "CREATE DATABASE pdf_convert_db;"
```

### 2. 后端启动

**第一步：配置环境变量**

```bash
# 配置数据库连接
export IP_ADDRESS=127.0.0.1
export DB_USER=your_username
export DB_PWD=your_password
```

**第二步：修改配置文件**

编辑 `backend/src/main/resources/application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:postgresql://${IP_ADDRESS}:5432/pdf_convert_db
    username: ${DB_USER}
    password: ${DB_PWD}

file:
  upload-dir: /path/to/uploads        # 文件上传存储目录
  converted-dir: /path/to/converted    # 转换后文件存储目录
  server-url: http://127.0.0.1:8080
```

**第三步：配置 LibreOffice 路径**

编辑 `backend/src/main/java/org/example/config/OfficeConfig.java`：

```java
.officeHome("/Applications/LibreOffice.app/Contents")  // macOS 默认路径
// Windows 示例：
// .officeHome("C:/Program Files/LibreOffice")
// Linux 示例：
// .officeHome("/usr/lib/libreoffice")
```

**第四步：构建与运行**

```bash
cd backend

# 使用 Maven Wrapper 构建
./mvnw clean package -DskipTests

# 运行 Spring Boot
./mvnw spring-boot:run
```

后端启动成功后访问：`http://127.0.0.1:8080`

### 3. 前端启动

**第一步：配置环境变量**

编辑 `frontend/.env.development`：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8080
```

**第二步：安装依赖与启动**

```bash
cd frontend

# 安装依赖
npm install

# 开发模式启动
npm run dev
```

前端访问地址：`http://127.0.0.1:5173`

---

## API 接口文档

### 基础路径

```
http://127.0.0.1:8080/api
```

### 认证相关 `/api/auth`

| 方法 | 路径 | 说明 |
|-----|------|------|
| GET | `/captcha` | 获取图形验证码 |
| POST | `/register` | 用户注册 |
| POST | `/login` | 用户登录（Set-Cookie: refresh_token） |
| POST | `/refresh` | 刷新 Access Token |
| GET | `/profile/{userId}` | 获取用户信息 |
| POST | `/profile/{userId}/change-password` | 修改密码 |
| POST | `/profile/{userId}/change-email` | 修改邮箱 |

### 文件管理 `/api/files`

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/upload` | 单文件上传 |
| POST | `/upload/batch` | 批量文件上传 |
| GET | `/` | 获取用户文件列表 |
| GET | `/{id}` | 获取单个文件信息 |
| DELETE | `/{id}` | 删除文件 |
| GET | `/view/{fileName}/{option}` | 查看/下载文件 |
| GET | `/preview/{pdfTaskId}` | PDF 预览 |
| GET | `/converted/{fileName}` | 获取已转换文件 |

### 格式转换 `/api/convert`

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/start` | 创建单个转换任务 |
| GET | `/status/{taskId}` | 查询转换状态 |
| GET | `/result/{taskId}` | 获取转换结果 |
| GET | `/history` | 转换历史列表 |
| POST | `/batch` | 创建批量转换任务 |
| GET | `/batch/{taskId}` | 批量任务进度查询 |

### PDF 编辑 `/api/pdf`

| 方法 | 路径 | 说明 |
|-----|------|------|
| POST | `/edit` | 批量编辑操作（旋转/删除/水印/签名） |
| POST | `/pages/rotate` | 页面旋转 |
| POST | `/pages/delete` | 页面删除 |
| POST | `/watermark` | 添加水印 |

### 认证机制

所有需要认证的接口通过 Cookie 中的 `refresh_token` 进行身份验证。登录成功后，后端自动设置 HttpOnly Cookie。

---

## 使用指南

### 1. 注册与登录
- 访问系统首页，点击"注册"创建账号
- 登录时需要输入图形验证码
- 登录成功后自动进入主面板

### 2. 上传文件
- 点击"上传文件"按钮，支持拖拽上传
- 支持格式：PDF、JPG、PNG、TIFF、DOCX、XLSX、PPTX
- 单文件最大 50MB，批量请求最大 200MB

### 3. 格式转换
- **PDF → 图片**：选择 DPI（72/150/300/600）和输出格式
- **图片 → PDF**：选择页面尺寸（A4/A3/Letter/Legal）和方向
- **Office → PDF**：支持 Word/Excel/PPT 转 PDF
- 转换完成后可在"转换历史"中下载结果

### 4. PDF 编辑
- 在文件列表中点击 PDF 文件的"编辑"按钮
- 支持操作：页面旋转（90°/180°/270°）、页面删除、添加水印、电子签名
- 编辑完成后保存为新文件

### 5. 批量处理
- 在文件列表中勾选多个文件
- 选择批量操作（批量转换、PDF 合并、图片合并）
- 实时查看批量任务进度

---

## 配置说明

### JWT 配置

```yaml
jwt:
  secret: your-secret-key    # 生产环境请使用强密钥
  access-token-expire: 3600000    # Access Token 有效期（毫秒），默认1小时
  refresh-token-expire: 604800000  # Refresh Token 有效期（毫秒），默认7天
```

### 文件存储配置

```yaml
file:
  upload-dir: /path/to/uploads       # 上传文件存储路径
  converted-dir: /path/to/converted   # 转换后文件存储路径
  server-url: http://your-server:8080  # 服务器公开地址
```

### Cookie 安全配置

```yaml
app:
  cookie:
    http-only: true      # 禁止 JavaScript 访问
    secure: false        # 本地开发 false，HTTPS 生产环境改为 true
    same-site: Lax       # 防 CSRF
    path: /
```

### 文件上传限制

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 50MB        # 单文件上限
      max-request-size: 200MB    # 请求体上限
```

---

## 部署说明

### 生产环境部署

**1. 打包后端**

```bash
cd backend
./mvnw clean package -DskipTests
# 生成 jar: target/pdfConvertSystem-1.0-SNAPSHOT.jar
```

**2. 打包前端**

```bash
cd frontend
npm run build
# 生成 dist/ 目录
```

**3. Nginx 反向代理配置示例**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 文件大小限制
    client_max_body_size 200M;
}
```

**4. 后端启动命令**

```bash
# 生产环境启动
java -jar pdfConvertSystem-1.0-SNAPSHOT.jar \
  --spring.datasource.url=jdbc:postgresql://db-host:5432/pdf_convert_db \
  --spring.datasource.username=prod_user \
  --spring.datasource.password=prod_password \
  --file.upload-dir=/data/uploads \
  --file.converted-dir=/data/converted \
  --file.server-url=https://your-domain.com
```

**5. 使用 Systemd 管理后端服务（Linux）**

```ini
# /etc/systemd/system/pdfconvert.service
[Unit]
Description=PDF Convert System
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
ExecStart=/usr/bin/java -jar /opt/pdfconvert/pdfConvertSystem-1.0-SNAPSHOT.jar
WorkingDirectory=/opt/pdfconvert
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable pdfconvert
systemctl start pdfconvert
```

**6. Docker Compose 一键部署（可选）**

```yaml
version: '3.8'
services:
  backend:
    image: eclipse-temurin:17-jre
    volumes:
      - ./backend/target/pdfConvertSystem-1.0-SNAPSHOT.jar:/app/app.jar
      - uploads:/data/uploads
      - converted:/data/converted
    environment:
      - IP_ADDRESS=postgres
      - DB_USER=pdfconvert
      - DB_PWD=pdfconvert_pass
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/pdf_convert_db
      - FILE_UPLOAD_DIR=/data/uploads
      - FILE_CONVERTED_DIR=/data/converted
    command: java -jar /app/app.jar
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - libreoffice

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: pdf_convert_db
      POSTGRES_USER: pdfconvert
      POSTGRES_PASSWORD: pdfconvert_pass
    volumes:
      - pgdata:/var/lib/postgresql/data

  libreoffice:
    image: lscr.io/linuxserver/libreoffice:latest
    # 用于 Office 转 PDF 功能

volumes:
  pgdata:
  uploads:
  converted:
```

---

## 许可证

本项目仅供学习交流使用。
READMEEOF 