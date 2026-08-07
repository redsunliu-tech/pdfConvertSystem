// FileResponse.java
package org.example.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileResponse {
    private Long id;
    private String fileName;
    private Long fileSize;
    private String fileType;
    private String status;
    private String fileUrl;
    private LocalDateTime uploadDate;
    private LocalDateTime downloadDate;
    private String convertedUrl;
    private LocalDateTime uploadTime;
    // 注意：没有 filePath，保护服务器路径安全
}