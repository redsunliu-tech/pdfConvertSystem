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
public class ConvertResponse {
    private Long taskId;
    private String sourceFileName;
    private String convertType;
    private String status;
    private String resultFileUrl;
    private String message;
    private LocalDateTime createdAt;
}