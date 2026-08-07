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
public class BatchConvertResponse {
    private String taskId;
    private String status;
    private Integer totalCount;
    private Integer successCount;
    private Integer failCount;
    private String taskResultFileUrl;
    private java.util.List<BatchTaskItemResponse> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BatchTaskItemResponse {
        private Long sourceFileId;
        private String sourceFileName;
        private String status;
        private String resultFileUrl;
        private String errorMessage;
    }
}