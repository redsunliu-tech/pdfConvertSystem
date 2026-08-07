package org.example.service.impl;

import org.example.dto.FileUploadRequest;
import org.example.dto.FileResponse;
import org.example.entity.ConvertTask;
import org.example.entity.PdfTask;
import org.example.entity.User;
import org.example.repository.ConvertTaskRepository;
import org.example.repository.PdfTaskRepository;
import org.example.repository.UserRepository;
import org.example.service.FileService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class FileServiceImpl implements FileService {

    private final PdfTaskRepository pdfTaskRepository;
    private final ConvertTaskRepository convertTaskRepository;
    private final UserRepository userRepository;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Value("${file.server-url}")
    private String serverUrl;

    public FileServiceImpl(PdfTaskRepository pdfTaskRepository,
                          ConvertTaskRepository convertTaskRepository,
                          UserRepository userRepository) {
        this.pdfTaskRepository = pdfTaskRepository;
        this.convertTaskRepository = convertTaskRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public FileResponse uploadFile(MultipartFile file, Long userId, FileUploadRequest request) {
        // 1. 验证文件
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("上传文件不能为空");
        }

        // 2. 验证用户
        Optional<User> userOptional = userRepository.findById(userId);
        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException("用户不存在");
        }
        User user = userOptional.get();

        // 3. 创建存储目录
        try {
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
        } catch (IOException e) {
            throw new RuntimeException("创建存储目录失败", e);
        }

        // 4. 生成唯一文件名
        String originalFileName = file.getOriginalFilename();

        // 如果请求中指定了文件名，则使用指定的文件名
        String finalFileName = (request != null && request.getFileName() != null && !request.getFileName().isEmpty())
                ? request.getFileName()
                : originalFileName;

        String extension = "";
        if (finalFileName != null && finalFileName.contains(".")) {
            extension = finalFileName.substring(finalFileName.lastIndexOf("."));
        }
        String storedFileName = UUID.randomUUID().toString() + extension;

        // 5. 保存文件到服务器
        try {
            Path filePath = Paths.get(uploadDir, storedFileName);
            file.transferTo(filePath.toFile());
        } catch (IOException e) {
            throw new RuntimeException("保存文件失败", e);
        }

        // 6. 构建下载URL
        String baseUrl = serverUrl + "/api/files/view/" + storedFileName;

        // 7. 确定文件类型
        String fileType = (request != null && request.getFileType() != null && !request.getFileType().isEmpty())
                ? request.getFileType()
                : getFileType(finalFileName);

        // 8. 创建文件记录
        PdfTask pdfTask = new PdfTask();
        pdfTask.setFileName(finalFileName);
        pdfTask.setFilePath(uploadDir + "/" + storedFileName);
        pdfTask.setFileSize(file.getSize());
        pdfTask.setFileType(fileType);
        pdfTask.setBaseFileUrl(baseUrl);
        pdfTask.setUser(user);

        // 9. 保存到数据库
        PdfTask savedTask = pdfTaskRepository.save(pdfTask);

        // 10. 转换为 Response DTO
        return convertToResponse(savedTask);
    }

    @Override
    public FileResponse getFileById(Long id) {
        return pdfTaskRepository.findById(id)
                .map(this::convertToResponse)
                .orElse(null);
    }

    @Override
    public List<FileResponse> getUserFiles(Long userId) {
        return pdfTaskRepository.findByUserIdOrderByUploadTimeDesc(userId)
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    @Override
    @Transactional
    public boolean deleteFile(Long id, Long userId) {
        Optional<PdfTask> taskOptional = pdfTaskRepository.findById(id);
        if (taskOptional.isEmpty()) {
            return false;
        }

        PdfTask task = taskOptional.get();

        // 验证文件是否属于该用户
        if (!task.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("无权删除该文件");
        }

        // 删除服务器上的文件
        try {
            Path filePath = Paths.get(task.getFilePath());
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            // 建议：记录错误日志，考虑是否回滚事务
            // log.warn("删除物理文件失败: {}", task.getFilePath(), e);
            // 如果需要严格一致性，可以抛出异常回滚事务
            throw new RuntimeException("删除文件失败: " + task.getFilePath(), e);
        }

        // 删除数据库记录
        pdfTaskRepository.delete(task);
        return true;
    }

    @Override
    @Transactional
    public void updateFileStatus(Long id, String status) {
        // 不再使用，保留为兼容接口
        // 状态现在由 ConvertTask 管理
    }

    @Override
    @Transactional
    public void setConvertedUrl(Long id, String convertedUrl) {
        pdfTaskRepository.findById(id).ifPresent(task -> {
            task.setConvertedUrl(convertedUrl);
            pdfTaskRepository.save(task);
        });
    }

    /**
     * 将实体转换为 Response DTO
     */
    private FileResponse convertToResponse(PdfTask task) {
        // 从最新的 ConvertTask 获取状态
        String status = "uploaded"; // 默认状态
        String convertedUrl = task.getConvertedUrl();
        
        ConvertTask latestConvertTask = convertTaskRepository.findTopBySourceFileIdOrderByCreatedAtDesc(task.getId());
        if (latestConvertTask != null) {
            status = latestConvertTask.getStatus();
            if (latestConvertTask.getResultFileUrl() != null) {
                convertedUrl = latestConvertTask.getResultFileUrl();
            }
        }
        
        return FileResponse.builder()
                .id(task.getId())
                .fileName(task.getFileName())
                .fileSize(task.getFileSize())
                .fileType(task.getFileType())
                .status(status)
                .fileUrl(task.getBaseFileUrl())
                .convertedUrl(convertedUrl)
                .uploadTime(task.getUploadTime())
                .build();
    }

    /**
     * 获取文件类型
     */
    private String getFileType(String fileName) {
        if (fileName == null) return "UNKNOWN";
        String lowerName = fileName.toLowerCase();

        // 文档
        if (lowerName.endsWith(".pdf")) return "PDF";
        else if (lowerName.endsWith(".docx")) return "DOCX";
        else if (lowerName.endsWith(".doc")) return "DOC";
        else if (lowerName.endsWith(".txt")) return "TXT";
        else if (lowerName.endsWith(".rtf")) return "RTF";

            // 表格
        else if (lowerName.endsWith(".xlsx")) return "XLSX";
        else if (lowerName.endsWith(".xls")) return "XLS";
        else if (lowerName.endsWith(".csv")) return "CSV";
        else if (lowerName.endsWith(".ods")) return "ODS";

            // 图片
        else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "JPG";
        else if (lowerName.endsWith(".png")) return "PNG";
        else if (lowerName.endsWith(".gif")) return "GIF";
        else if (lowerName.endsWith(".bmp")) return "BMP";
        else if (lowerName.endsWith(".webp")) return "WEBP";
        else if (lowerName.endsWith(".svg")) return "SVG";

            // 演示文稿
        else if (lowerName.endsWith(".pptx")) return "PPTX";
        else if (lowerName.endsWith(".ppt")) return "PPT";

            // 压缩文件
        else if (lowerName.endsWith(".zip")) return "ZIP";
        else if (lowerName.endsWith(".rar")) return "RAR";
        else if (lowerName.endsWith(".7z")) return "7Z";

        else return "OTHER";
    }

    @Override
    @Transactional
    public List<FileResponse> uploadFiles(List<MultipartFile> files, Long userId) {
        // 1. 验证文件
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("上传文件列表不能为空");
        }

        // 2. 验证用户
        Optional<User> userOptional = userRepository.findById(userId);
        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException("用户不存在");
        }
        User user = userOptional.get();

        // 3. 创建存储目录
        try {
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
        } catch (IOException e) {
            throw new RuntimeException("创建存储目录失败", e);
        }

        return files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .map(file -> processUploadFile(file, user))
                .toList();
    }

    private FileResponse processUploadFile(MultipartFile file, User user) {
        String originalFileName = file.getOriginalFilename();
        String extension = "";
        if (originalFileName != null && originalFileName.contains(".")) {
            extension = originalFileName.substring(originalFileName.lastIndexOf("."));
        }
        String storedFileName = UUID.randomUUID().toString() + extension;

        try {
            Path filePath = Paths.get(uploadDir, storedFileName);
            file.transferTo(filePath.toFile());
        } catch (IOException e) {
            throw new RuntimeException("保存文件失败", e);
        }

        String baseUrl = serverUrl + "/api/files/view/" + storedFileName;
        String fileType = getFileType(originalFileName);

        PdfTask pdfTask = new PdfTask();
        pdfTask.setFileName(originalFileName);
        pdfTask.setFilePath(uploadDir + "/" + storedFileName);
        pdfTask.setFileSize(file.getSize());
        pdfTask.setFileType(fileType);
        pdfTask.setBaseFileUrl(baseUrl);
        pdfTask.setUser(user);

        PdfTask savedTask = pdfTaskRepository.save(pdfTask);
        return convertToResponse(savedTask);
    }

}