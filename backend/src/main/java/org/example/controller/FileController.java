package org.example.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.example.dto.FileUploadRequest;
import org.example.dto.FileResponse;
import org.example.entity.PdfTask;
import org.example.repository.PdfTaskRepository;
import org.example.service.FileService;
import org.example.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;
import java.nio.file.Paths;
import java.nio.file.Path;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import java.net.URLEncoder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;
    private final JwtUtil jwtUtil;
    private final PdfTaskRepository pdfTaskRepository;
    @Value("${file.upload-dir}")
    private String uploadDir;
    @Value("${file.converted-dir}")
    private String convertedDir;

    public FileController(FileService fileService, JwtUtil jwtUtil, PdfTaskRepository pdfTaskRepository) {
        this.fileService = fileService;
        this.jwtUtil = jwtUtil;
        this.pdfTaskRepository = pdfTaskRepository;
    }

    /**
     * 上传文件
     * POST /api/files/upload
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, Object>> uploadFile(
            @RequestParam("files") MultipartFile file,
            @RequestParam(value = "fileName", required = false) String fileName,
            @RequestParam(value = "fileType", required = false) String fileType,
            HttpServletRequest request) {

        try {
            // 1. 获取用户ID
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            // 2. 构建请求 DTO
            FileUploadRequest uploadRequest = new FileUploadRequest();
            uploadRequest.setFileName(fileName);
            uploadRequest.setFileType(fileType);

            // 3. 调用 Service 上传文件
            FileResponse response = fileService.uploadFile(file, userId, uploadRequest);

            // 4. 返回响应
            return buildSuccessResponse(response, "文件上传成功");

        } catch (IllegalArgumentException e) {
            return buildErrorResponse(400, e.getMessage());
        } catch (Exception e) {
            return buildErrorResponse(500, "上传失败: " + e.getMessage());
        }
    }

    /**
     * 上传文件
     * POST /api/files/upload/batch
     */
    @PostMapping("/upload/batch")
    public ResponseEntity<Map<String, Object>> uploadFiles(
            @RequestParam("files") List<MultipartFile> files,
            HttpServletRequest request) {

        try {
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            List<MultipartFile> validFiles = files.stream()
                    .filter(f -> f != null && !f.isEmpty())
                    .collect(Collectors.toList());

            if (validFiles.isEmpty()) {
                return buildErrorResponse(400, "上传文件列表不能为空");
            }

            List<FileResponse> responses = fileService.uploadFiles(validFiles, userId);

            Map<String, Object> result = new HashMap<>();
            result.put("totalCount", validFiles.size());
            result.put("successCount", responses.size());
            result.put("files", responses);
            return buildSuccessResponse(result, "批量上传完成");

        } catch (IllegalArgumentException e) {
            return buildErrorResponse(400, e.getMessage());
        } catch (Exception e) {
            return buildErrorResponse(500, "批量上传失败: " + e.getMessage());
        }
    }

    /**
     * 获取用户文件列表
     * GET /api/files
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getUserFiles(HttpServletRequest request) {
        try {
            // 1. 获取用户ID
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            // 2. 调用 Service 获取文件列表
            List<FileResponse> files = fileService.getUserFiles(userId);

            // 3. 返回响应
            return buildSuccessResponse(files, "操作成功");

        } catch (Exception e) {
            return buildErrorResponse(500, "获取文件列表失败: " + e.getMessage());
        }
    }

    /**
     * 获取单个文件信息
     * GET /api/files/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getFileInfo(
            @PathVariable Long id,
            HttpServletRequest request) {

        try {
            // 1. 获取用户ID
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            // 2. 调用 Service 获取文件信息
            FileResponse file = fileService.getFileById(id);

            if (file == null) {
                return buildErrorResponse(404, "文件不存在");
            }

            // 3. 验证权限（简化版：实际应检查文件所属用户）
            // 这里可以添加权限验证逻辑

            // 4. 返回响应
            return buildSuccessResponse(file, "操作成功");

        } catch (Exception e) {
            return buildErrorResponse(500, "获取文件信息失败: " + e.getMessage());
        }
    }

    /**
     * 删除文件
     * DELETE /api/files/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteFile(
            @PathVariable Long id,
            HttpServletRequest request) {

        try {
            // 1. 获取用户ID
            Long userId = getUserIdFromRequest(request);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            // 2. 调用 Service 删除文件
            boolean deleted = fileService.deleteFile(id, userId);

            if (deleted) {
                return buildSuccessResponse(null, "文件删除成功");
            } else {
                return buildErrorResponse(404, "文件不存在");
            }

        } catch (IllegalArgumentException e) {
            return buildErrorResponse(403, e.getMessage());
        } catch (Exception e) {
            return buildErrorResponse(500, "删除文件失败: " + e.getMessage());
        }
    }

    /**
     * 从请求中获取用户ID
     */
    private Long getUserIdFromRequest(HttpServletRequest request) {
        // 从 Cookie 中获取 refreshToken
        String refreshToken = getRefreshTokenFromCookie(request);
        if (refreshToken == null || refreshToken.isEmpty()) {
            return null;
        }

        // 从 Token 中提取用户ID
        try {
            return jwtUtil.getUserIdFromToken(refreshToken);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 从 Cookie 中提取 refreshToken
     */
    private String getRefreshTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("refresh_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    /**
     * 构建成功响应
     */
    private ResponseEntity<Map<String, Object>> buildSuccessResponse(Object data) {
        return buildSuccessResponse(data, "操作成功");
    }

    private ResponseEntity<Map<String, Object>> buildSuccessResponse(Object data, String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", message);
        response.put("data", data);
        return ResponseEntity.ok(response);
    }

    /**
     * 构建错误响应
     */
    private ResponseEntity<Map<String, Object>> buildErrorResponse(int status, String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", message);
        response.put("data", null);
        return ResponseEntity.status(status).body(response);
    }

    /**
     * 统一文件接口
     * GET /api/files/view/{fileName}
     */
    @GetMapping("/view/{fileName}/{option}")
    public ResponseEntity<Resource> viewFile(
            @PathVariable String fileName,
            @PathVariable String option,
            HttpServletRequest request) {

        try {
            // 1. 获取文件路径
            Path filePath_upload = Paths.get(uploadDir).resolve(fileName).normalize();
            Path filePath_converted = Paths.get(convertedDir).resolve(fileName).normalize();

            Resource resource_upload = new UrlResource(filePath_upload.toUri());
            Resource resource_converted = new UrlResource(filePath_converted.toUri());

            if ((!resource_upload.exists() || !resource_upload.isReadable()) && (!resource_converted.exists() || !resource_converted.isReadable())){
                return ResponseEntity.notFound().build();
            }
            else if (resource_upload.exists() && resource_upload.isReadable()){
                // 2. 获取文件MIME类型
                String contentType = request.getServletContext().getMimeType(resource_upload.getFile().getAbsolutePath());
                if (contentType == null) {
                    contentType = "application/octet-stream";
                }

                // 3. 返回文件流
                if ("download".equals(option.toLowerCase())) {
                    String encodedFileName = URLEncoder.encode(fileName, "UTF-8").replace("+", "%20");
                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType(contentType))
                            .header(HttpHeaders.CONTENT_DISPOSITION,
                                    "attachment; filename=\"" + encodedFileName + "\"; filename*=UTF-8''" + encodedFileName)
                            .body(resource_upload);
                }
                else{
                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType(contentType))
                            //.header(HttpHeaders.CONTENT_DISPOSITION,
                            //        "attachment; filename=\"" + URLEncoder.encode(fileName, "UTF-8") + "\"")
                            .body(resource_upload);
                }
            }
            else if (resource_converted.exists() && resource_converted.isReadable()){
                // 2. 获取文件MIME类型
                String contentType = request.getServletContext().getMimeType(resource_converted.getFile().getAbsolutePath());
                if (contentType == null) {
                    contentType = "application/octet-stream";
                }

                // 3. 返回文件流
                if ("download".equals(option.toLowerCase())) {
                    String encodedFileName = URLEncoder.encode(fileName, "UTF-8").replace("+", "%20");
                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType(contentType))
                            .header(HttpHeaders.CONTENT_DISPOSITION,
                                    "attachment; filename=\"" + encodedFileName + "\"; filename*=UTF-8''" + encodedFileName)
                            .body(resource_converted);
                }
                else{
                    return ResponseEntity.ok()
                            .contentType(MediaType.parseMediaType(contentType))
                            //.header(HttpHeaders.CONTENT_DISPOSITION,
                            //        "attachment; filename=\"" + URLEncoder.encode(fileName, "UTF-8") + "\"")
                            .body(resource_converted);
                }
            }
            else return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }

    }

    /**
     * PDF预览接口
     * GET /api/files/preview/{pdfTaskId}
     */
    @GetMapping("/preview/{pdfTaskId}")
    public ResponseEntity<Resource> previewPdf(
            @PathVariable Long pdfTaskId,
            @RequestParam(required = false) String token,
            HttpServletRequest request) {

        try {
            Long userId = getUserIdFromRequest(request);

            if (userId == null && token != null && !token.isEmpty()) {
                try {
                    if (!jwtUtil.isTokenExpired(token)) {
                        userId = jwtUtil.getUserIdFromToken(token);
                    }
                } catch (Exception e) {
                }
            }

            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            PdfTask pdfTask = pdfTaskRepository.findById(pdfTaskId).orElse(null);
            if (pdfTask == null || !pdfTask.getUser().getId().equals(userId)) {
                return ResponseEntity.notFound().build();
            }

            Path filePath = Paths.get(pdfTask.getFilePath()).normalize();
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + pdfTask.getFileName() + "\"")
                    .body(resource);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/converted/{fileName}")
    public ResponseEntity<Resource> getConvertedFile(
            @PathVariable String fileName,
            @RequestParam(required = false) String option) {

        try {
            Path filePath = Paths.get(convertedDir).resolve(fileName).normalize();
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            String contentType = "application/pdf";
            String disposition = "inline";

            if ("download".equalsIgnoreCase(option)) {
                String encodedFileName = URLEncoder.encode(fileName, "UTF-8").replace("+", "%20");
                disposition = "attachment; filename=\"" + encodedFileName + "\"; filename*=UTF-8''" + encodedFileName;
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                    .body(resource);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}