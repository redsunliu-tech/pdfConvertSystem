package org.example.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "pdf_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PdfTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fileName;          // 原始文件名

    @Column(nullable = false)
    private String filePath;          // 文件存储路径

    @Column(nullable = false)
    private Long fileSize;            // 文件大小（字节）

    @Column(nullable = false)
    private String fileType;          // 文件类型（如 PDF）

    @Column(name = "base_file_url")
    private String baseFileUrl;       // 下载链接

    @Column(name = "converted_url")
    private String convertedUrl;      // 转换后文件链接

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;                // 关联用户

    @Column(name = "upload_time")
    private LocalDateTime uploadTime; // 上传时间

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;  // 更新时间

    @PrePersist
    protected void onCreate() {
        uploadTime = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}