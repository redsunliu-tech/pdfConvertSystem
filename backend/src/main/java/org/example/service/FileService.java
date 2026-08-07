package org.example.service;

import org.example.dto.FileUploadRequest;
import org.example.dto.FileResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface FileService {

    /**
     * 上传文件
     * @param file 上传的文件
     * @param userId 用户ID
     * @param request 请求参数（可选）
     * @return 文件响应
     */
    FileResponse uploadFile(MultipartFile file, Long userId, FileUploadRequest request);

    /**
     * 获取单个文件信息
     * @param id 文件ID
     * @return 文件响应
     */
    FileResponse getFileById(Long id);

    /**
     * 获取用户的所有文件
     * @param userId 用户ID
     * @return 文件响应列表
     */
    List<FileResponse> getUserFiles(Long userId);

    /**
     * 删除文件
     * @param id 文件ID
     * @param userId 用户ID
     * @return 是否删除成功
     */
    boolean deleteFile(Long id, Long userId);

    /**
     * 更新文件状态
     * @param id 文件ID
     * @param status 新状态
     */
    void updateFileStatus(Long id, String status);

    /**
     * 设置转换后文件URL
     * @param id 文件ID
     * @param convertedUrl 转换后文件URL
     */
    void setConvertedUrl(Long id, String convertedUrl);

    /**
     * 支持批量上传文件
     * @param files 上传的文件
     * @param userId 用户ID
     * @return 文件响应
     */
    List<FileResponse> uploadFiles(List<MultipartFile> files, Long userId);

}

