# PDF Convert System

基于 Spring Boot 3 + React 19 的在线 PDF 文档处理与转换平台，支持 PDF 转换、批量处理、PDF 在线编辑（批注、页面操作、签名、水印）等功能。

## 功能特性

### PDF 转换

| 转换类型 | 说明 | 可选参数 |
|:---|:---|:---|
| PDF → 图片 | 将 PDF 每页渲染为图片 | 格式（PNG/JPG/Auto）、DPI（72/150/300/600/Auto）、JPG 质量 |
| 图片 → PDF | 将图片转为 PDF 文件 | 页面尺寸（A4/A3/Letter/Legal/适应图片）、方向（竖向/横向） |
| Office → PDF | 将 Word/Excel/PPT 转为 PDF | 嵌入字体开关 |

### 批量处理

| 批量功能 | 说明 |
|:---|:---|
| 合并 PDF | 将多个 PDF 按顺序合并为单个文件，支持拖拽排序 |
| 图片批量转 PDF | 支持每张图独立输出或所有图合并为一个 PDF |
| PDF 批量转图片 | 多文件并行转换，结果打包下载 |
| Office 批量转 PDF | 批量转换 Word/Excel/PPT 文档 |

### PDF 在线编辑

| 功能 | 说明 |
|:---|:---|
| 批注 - 高亮 | 矩形区域高亮标注，带透明度 |
| 批注 - 文字 | 在 PDF 上添加文字注释 |
| 批注 - 矩形 | 绘制矩形框标注，支持颜色自定义 |
| 批注 - 签名 | 手写签名、签名库管理、图片上传签名 |
| 页面旋转 | 单页左转/右转 90°，支持重置 |
| 页面删除 | 标记删除指定页面，导出时生效 |
| 页面重排序 | 上移/下移调整页面顺序 |
| 文字水印 | 全页平铺文字水印，支持自定义文字/字号/透明度/旋转角度 |
| 图片水印 | 全页平铺图片水印 |
| 批注管理 | 编辑、复制到其他页、移动到其他页、删除 |

### 系统功能

- 用户注册/登录，JWT Token 认证
- 文件上传（单文件/批量）
- 文件管理（查看/下载/删除）
- 转换历史记录
- 账户设置

## 技术栈

### 后端

| 技术 | 版本 | 说明 |
|:---|:---|:---|
| Java | 17 | JDK 版本 |
| Spring Boot | 3.1.0 | 框架版本 |
| Spring Security Crypto | 6.1.0 | 密码加密 |
| Spring Data JPA / Hibernate | 6.2.x | ORM 框架 |
| PostgreSQL | 42.6.0 | 数据库驱动 |
| Apache PDFBox | 2.0.32 | PDF 解析、渲染、编辑 |
| JODConverter | 4.4.8 | LibreOffice 文档转换桥接 |
| JJWT | 0.12.3 | JWT 令牌 |
| Kaptcha | 2.3.2 | 图形验证码 |
| Lombok | 1.18.28 | 代码简化 |

### 前端

| 技术 | 版本 | 说明 |
|:---|:---|:---|
| React | 19.2.7 | UI 框架 |
| TypeScript | 7.0.2 | 类型系统 |
| Vite | 8.1.5 | 构建工具 |
| React Router DOM | 6.30.4 | 路由管理 |
| PDF.js | 4.4.168 | PDF 渲染引擎 |

## 项目结构

```
pdfConvertSystem/
├── backend/                          # Spring Boot 后端
│   ├── config/
│   │   └── application.yml           # 外部运行配置（不打进 jar）
│   ├── src/main/
│   │   ├── java/org/example/
│   │   │   ├── config/               # Spring 配置类
│   │   │   ├── controller/           # REST API 控制器
│   │   │   ├── dto/                  # 数据传输对象
│   │   │   ├── entity/               # JPA 实体
│   │   │   ├── repository/           # 数据访问层
│   │   │   ├── service/              # 业务逻辑层
│   │   │   ├── util/                 # 工具类
│   │   │   └── Main.java             # 启动入口
│   │   └── resources/
│   │       ├── application.yml       # 内部默认配置（占位符）
│   │       ├── static/               # 前端静态资源（打包后放入）
│   │       └── fonts/                # PDF 编辑用中文字体
│   └── start.sh                      # 启动脚本
├── frontend/                         # React 前端
│   ├── src/
│   │   ├── components/               # UI 组件
│   │   ├── types/                    # TypeScript 类型定义
│   │   ├── utils/                    # 前端工具函数
│   │   └── config.ts                 # API 地址配置
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

## 环境要求

| 依赖 | 最低版本 | 说明 |
|:---|:---|:---|
| JDK | 17 | 后端运行环境 |
| Maven | 3.8+ | 后端构建 |
| Node.js | 18+ | 前端构建 |
| PostgreSQL | 14+ | 数据库 |
| LibreOffice | 7.x | Office → PDF 转换必需 |

## 快速开始

### 1. 数据库准备

创建数据库：

```bash
createdb pdf_convert_db
```

### 2. 后端启动

```bash
cd backend

# 创建外部配置文件
mkdir -p config
cat > config/application.yml << 'EOF'
IP_ADDRESS: 127.0.0.1
DB_USER: postgres
DB_PWD: your_password
UPLOAD_DIR: /tmp/pdf_uploads
CONVERTED_DIR: /tmp/pdf_converted
SERVER_URL: http://127.0.0.1:8080
EOF

# 打包
mvn clean package -DskipTests

# 启动
./start.sh
```

后端启动后访问 <http://127.0.0.1:8080>。

### 3. 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 开发模式（默认端口 5173，自动代理 /api 到后端 8080）
npm run dev
```

前端开发模式访问 <http://127.0.0.1:5173>。

### 4. 生产构建（前后端一体化部署）

```bash
# 1. 前端打包
cd frontend
npm run build

# 2. 将前端产物拷贝到 Spring Boot 静态资源目录
rm -rf ../backend/src/main/resources/static
mkdir -p ../backend/src/main/resources/static
cp -r dist/* ../backend/src/main/resources/static/

# 3. 后端打包（包含前端静态资源）
cd ../backend
mvn clean package -DskipTests

# 4. 启动
java -jar target/pdfConvertSystem-1.0-SNAPSHOT.jar \
  --spring.config.location="classpath:/,file:./config/"
```

## 配置说明

### 后端配置加载优先级

| 优先级 | 配置来源 | 说明 |
|:---|:---|:---|
| 1（最高） | 外部 `config/application.yml` | 外置配置，不参与打包 |
| 2 | 内部 `classpath:application.yml` | jar 内默认配置，使用占位符 |
| 3 | 命令行 `--key=value` | 启动参数 |

【来源出处】Spring Boot 3.1.0 Reference Documentation - Property Source Precedence
https://docs.spring.io/spring-boot/docs/3.1.0/reference/html/core.html#properties
【可靠等级】★★★

### 内部 application.yml（jar 内）

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

### 外部 config/application.yml

```yaml
IP_ADDRESS: 127.0.0.1
DB_USER: postgres
DB_PWD: your_password
UPLOAD_DIR: /data/uploads
CONVERTED_DIR: /data/converted
SERVER_URL: http://127.0.0.1:8080
```

### 前端配置

前端通过 `frontend/src/config.ts` 中的 `API_BASE_URL` 连接后端：

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

开发模式下，Vite 已配置 `/api` 代理到 `http://127.0.0.1:8080`。
生产部署时前后端同源，`VITE_API_BASE_URL` 留空即可。

## API 概览

所有接口前缀为 `/api`，需要认证的接口通过 Cookie 传递 JWT Token。

### 认证

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/logout` | 用户登出 |
| GET | `/api/auth/info` | 获取当前用户信息 |
| GET | `/api/auth/captcha` | 获取图形验证码 |

### 文件管理

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | `/api/files/upload` | 单文件上传 |
| POST | `/api/files/upload/batch` | 批量文件上传 |
| GET | `/api/files` | 获取当前用户文件列表 |
| GET | `/api/files/{id}/preview` | 文件预览 |
| GET | `/api/files/{id}/download` | 文件下载 |
| GET | `/api/files/{id}/view` | 文件查看 |
| DELETE | `/api/files/{id}` | 删除文件 |

### 转换

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | `/api/convert/start` | 启动单个转换任务 |
| GET | `/api/convert/status/{taskId}` | 查询转换状态 |
| GET | `/api/convert/result/{taskId}` | 获取转换结果 |
| GET | `/api/convert/history` | 获取转换历史 |
| POST | `/api/convert/batch` | 启动批量转换任务 |
| GET | `/api/convert/batch/{taskId}` | 查询批量任务状态 |

### PDF 编辑

| 方法 | 路径 | 说明 |
|:---|:---|:---|
| POST | `/api/pdf/edit` | 提交 PDF 编辑（批注 + 页面操作 + 水印） |

## 部署

### 交付文件清单

```
deploy/
├── pdfConvertSystem-1.0-SNAPSHOT.jar   # 可执行 jar（含前端静态资源）
├── start.sh                             # 启动脚本
└── config/
    └── application.yml                  # 部署时填写实际配置
```

### 服务器要求

- JDK 17+
- PostgreSQL 14+（已运行并创建 `pdf_convert_db`）
- LibreOffice 7.x（Office 转 PDF 功能需要，需可通过命令行启动）
- 文件上传/下载目录需有读写权限

### 启动命令

```bash
java -jar pdfConvertSystem-1.0-SNAPSHOT.jar \
  --spring.config.location="classpath:/,file:./config/"
```

或使用启动脚本：

```bash
chmod +x start.sh
./start.sh
```

## 常见问题

### Office 转 PDF 失败

确保服务器已安装 LibreOffice 且 `soffice` 命令可用：

```bash
which soffice
soffice --version
```

【来源出处】JODConverter 4.4.8 Documentation - Prerequisites
https://jodconverter.readthedocs.io/en/latest/
【可靠等级】★★

### 文件上传大小限制

默认单文件最大 50MB，请求最大 200MB。修改 `application.yml`：

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 100MB
      max-request-size: 500MB
```

【来源出处】Spring Boot 3.1.0 Reference Documentation - Servlet MultiPart
https://docs.spring.io/spring-boot/docs/3.1.0/reference/html/web.html#web.servlet.spring-mvc.multipart
【可靠等级】★★★

### 生产环境安全建议

1. 将 `jwt.secret` 替换为高强度随机密钥
2. 设置 `app.cookie.secure=true`（HTTPS 环境）
3. 设置 `spring.jpa.show-sql=false` 关闭 SQL 日志
4. 配置 HTTPS 证书和反向代理（如 Nginx）
5. 定期清理 `upload-dir` 和 `converted-dir` 中的临时文件

## 技术架构说明

### 前后端一体化部署

本项目采用 Spring Boot 内嵌静态资源方案，将前端 `dist/` 产物放入 `backend/src/main/resources/static/`，打包成单一 fat jar 部署。

【方案内容】Spring Boot 自动从 classpath 的 `/static`、`/public`、`/resources` 目录加载静态资源，前端 SPA 的路由 fallback 通过 `WebConfig.addViewControllers` 实现
【来源出处】Spring Boot 4.0 Reference Documentation - Web Servlet MVC Static Resources
https://docs.spring.io/spring-boot/4.0/reference/web/servlet.html
【可靠等级】★★★

### PDF 处理架构

- **PDF 渲染**：Apache PDFBox 2.0.32 将 PDF 页渲染为 BufferedImage，支持 DPI 控制
- **PDF 编辑**：PDFBox 直接操作 PDF 文档结构，支持批注（高亮/文字/矩形/签名）、页面旋转、页面删除、页面重排序、文字/图片水印
- **Office 转换**：JODConverter 调用本地 LibreOffice 进程完成 DOC/DOCX/XLS/XLSX/PPT/PPTX → PDF 转换
- **PDF 转图片**：分析页面类型（扫描件/矢量），扫描件直接提取内嵌图片，矢量页使用 PDFRenderer 渲染

### 批量任务处理

批量任务使用有界线程池（核心 2 线程，最大 5 线程，队列容量 10）执行，防止 OOM。任务状态通过数据库持久化，前端轮询查询进度。

## License

本项目基于 [MIT License](https://opensource.org/licenses/MIT-license) 开源，版权所有 (c) 2026 Hubert Liu。
