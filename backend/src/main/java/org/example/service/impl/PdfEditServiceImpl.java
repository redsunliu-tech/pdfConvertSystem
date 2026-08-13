package org.example.service.impl;

import lombok.extern.slf4j.Slf4j;
import org.example.dto.PdfEditRequest;
import org.example.dto.PdfEditResponse;
import org.example.entity.PdfTask;
import org.example.repository.PdfTaskRepository;
import org.example.service.PdfEditService;
import org.example.util.FileNameUtil;
import org.example.util.PdfEditUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@Service
@Slf4j
public class PdfEditServiceImpl implements PdfEditService {

    private final PdfTaskRepository pdfTaskRepository;

    @Value("${file.converted-dir}")
    private String convertedDir;

    public PdfEditServiceImpl(PdfTaskRepository pdfTaskRepository) {
        this.pdfTaskRepository = pdfTaskRepository;
    }

    @Override
    @Transactional
    public PdfEditResponse applyEdits(PdfEditRequest request) throws IOException {
        PdfTask pdfTask = pdfTaskRepository.findById(request.getPdfTaskId())
                .orElseThrow(() -> new RuntimeException("PDF任务不存在"));

        File sourceFile = new File(pdfTask.getFilePath());
        if (!sourceFile.exists()) {
            throw new RuntimeException("源文件不存在: " + pdfTask.getFilePath());
        }

        String outputFileName = createOutputFileName(pdfTask.getFileName());
        File outputFile = new File(convertedDir, outputFileName);
        Files.createDirectories(outputFile.toPath().getParent());

        File workingFile = sourceFile;

        if (request.getPageOperations() != null && !request.getPageOperations().isEmpty()) {
            File pageResultFile = applyPageOperations(workingFile, request.getPageOperations());
            if (workingFile != sourceFile) {
                Files.deleteIfExists(workingFile.toPath());
            }
            workingFile = pageResultFile;
        }

        if (request.getAnnotations() != null && !request.getAnnotations().isEmpty()) {
            File annotationResultFile = File.createTempFile("pdf_annotation_", ".pdf");
            PdfEditUtil.addAnnotation(workingFile, annotationResultFile, request.getAnnotations());
            if (workingFile != sourceFile && !workingFile.getPath().equals(sourceFile.getPath())) {
                Files.deleteIfExists(workingFile.toPath());
            }
            workingFile = annotationResultFile;
        }

        if (request.getWatermark() != null) {
            File watermarkResultFile = File.createTempFile("pdf_watermark_", ".pdf");
            applyWatermark(workingFile, watermarkResultFile, request.getWatermark());
            if (!workingFile.getPath().equals(sourceFile.getPath())) {
                Files.deleteIfExists(workingFile.toPath());
            }
            workingFile = watermarkResultFile;
        }

        if (workingFile.getPath().equals(outputFile.getPath())) {
            log.info("Output file already at target location");
        } else {
            Files.copy(workingFile.toPath(), outputFile.toPath(),
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            Files.deleteIfExists(workingFile.toPath());
        }

        return new PdfEditResponse("/api/files/view/" + outputFileName, "编辑成功", pdfTask.getId());
    }

    private File applyPageOperations(File sourceFile,
                                     List<PdfEditRequest.PageOperationRequest> operations) throws IOException {
        File currentSource = sourceFile;

        for (PdfEditRequest.PageOperationRequest operation : operations) {
            File nextTarget = File.createTempFile("pdf_page_", ".pdf");

            switch (operation.getOperation()) {
                case "rotate":
                    PdfEditUtil.rotatePage(currentSource, nextTarget,
                            operation.getPageIndex(), operation.getAngle());
                    break;
                case "delete":
                    PdfEditUtil.deletePages(currentSource, nextTarget, operation.getPageIndices());
                    break;
                case "reorder":
                    PdfEditUtil.reorderPages(currentSource, nextTarget, operation.getPageIndices());
                    break;
                default:
                    Files.copy(currentSource.toPath(), nextTarget.toPath(),
                            java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    break;
            }

            if (currentSource != sourceFile) {
                Files.deleteIfExists(currentSource.toPath());
            }
            currentSource = nextTarget;
        }

        return currentSource;
    }

    private void applyWatermark(File sourceFile, File targetFile,
                                PdfEditRequest.WatermarkRequest watermarkRequest) throws IOException {
        if ("text".equals(watermarkRequest.getType())) {
            PdfEditUtil.addTextWatermark(sourceFile, targetFile,
                    watermarkRequest.getText(),
                    watermarkRequest.getFontSize() != null ? watermarkRequest.getFontSize() : 36,
                    watermarkRequest.getOpacity() != null ? watermarkRequest.getOpacity() : 0.5f,
                    watermarkRequest.getRotation() != null ? watermarkRequest.getRotation() : 30);
        } else if ("image".equals(watermarkRequest.getType())) {
            float width = watermarkRequest.getImageWidth() != null ? watermarkRequest.getImageWidth() : 100;
            float height = watermarkRequest.getImageHeight() != null ? watermarkRequest.getImageHeight() : 100;
            PdfEditUtil.addImageWatermark(sourceFile, targetFile,
                    watermarkRequest.getImageUrl(),
                    watermarkRequest.getOpacity() != null ? watermarkRequest.getOpacity() : 0.5f,
                    width, height);
        }
    }

    private String createOutputFileName(String originalFileName) {
        String baseName = originalFileName.contains(".")
                ? originalFileName.substring(0, originalFileName.lastIndexOf("."))
                : originalFileName;
        String ext = originalFileName.contains(".")
                ? originalFileName.substring(originalFileName.lastIndexOf("."))
                : ".pdf";
        return baseName + "_edited_" + FileNameUtil.generateSuffix() + ext;
    }
}