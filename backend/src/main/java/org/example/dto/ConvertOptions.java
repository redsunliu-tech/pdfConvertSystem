package org.example.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConvertOptions {
    private String imageType;
    private Object dpi; // 支持 Integer 或 String ("auto")
    private Integer jpgQuality;
    
    private String pageSize;
    private String orientation;
    
    private String officeFormat;
    
    private Boolean embedFonts;
}