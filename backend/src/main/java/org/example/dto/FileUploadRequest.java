// FileUploadRequest.java
package org.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FileUploadRequest {
    private String fileName;  // 可选，前端可以指定文件名
    private String fileType;  // 可选，文件类型
}