package org.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PdfEditResponse {
    private String fileUrl;
    private String message;
    private Long taskId;
}