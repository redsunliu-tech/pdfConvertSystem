package org.example.dto;

import lombok.Data;

import java.util.List;

@Data
public class PdfEditRequest {
    private Long pdfTaskId;
    private List<AnnotationRequest> annotations;
    private WatermarkRequest watermark;
    private List<PageOperationRequest> pageOperations;

    @Data
    public static class AnnotationRequest {
        private Integer pageIndex;
        private String type;
        private Float x;
        private Float y;
        private Float width;
        private Float height;
        private String content;
        private String color;
        private String imageData;
    }

    @Data
    public static class WatermarkRequest {
        private String type;
        private String text;
        private Float fontSize;
        private String color;
        private Float opacity;
        private Float rotation;
        private String imageUrl;
        private Float imageWidth;
        private Float imageHeight;
    }

    @Data
    public static class PageOperationRequest {
        private String operation;
        private Integer pageIndex;
        private Integer angle;
        private List<Integer> pageIndices;
    }
}