package org.example.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.multipdf.LayerUtility;
import lombok.extern.slf4j.Slf4j;
import org.example.dto.BatchConvertRequest;
import org.example.dto.BatchConvertResponse;
import org.example.dto.ConvertOptions;
import org.example.dto.ConvertRequest;
import org.example.dto.ConvertResponse;
import org.example.entity.BatchTask;
import org.example.entity.BatchTaskItem;
import org.example.entity.ConvertTask;
import org.example.entity.PdfTask;
import org.example.repository.BatchTaskItemRepository;
import org.example.repository.BatchTaskRepository;
import org.example.repository.ConvertTaskRepository;
import org.example.repository.PdfTaskRepository;
import org.example.service.ConvertService;
import org.example.config.OfficeConfig;
import org.jodconverter.core.DocumentConverter;
import org.jodconverter.core.office.OfficeException;
import org.jodconverter.core.document.DocumentFormat;
import org.jodconverter.core.document.DefaultDocumentFormatRegistry;
import org.jodconverter.core.document.DocumentFamily;
import org.jodconverter.local.LocalConverter;
import org.jodconverter.local.office.LocalOfficeManager;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PreDestroy;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@Slf4j
public class ConvertServiceImpl implements ConvertService {

    private final ConvertTaskRepository convertTaskRepository;
    private final PdfTaskRepository pdfTaskRepository;
    private final BatchTaskRepository batchTaskRepository;
    private final BatchTaskItemRepository batchTaskItemRepository;
    private final ObjectMapper objectMapper;
    private final DocumentConverter converter;
    
    private final ExecutorService batchTaskExecutor;

    @Value("${file.converted-dir}")
    private String convertedDir;

    public ConvertServiceImpl(ConvertTaskRepository convertTaskRepository,
                              PdfTaskRepository pdfTaskRepository,
                              BatchTaskRepository batchTaskRepository,
                              BatchTaskItemRepository batchTaskItemRepository,
                              ObjectMapper objectMapper,
                              OfficeConfig officeConfig) {
        this.convertTaskRepository = convertTaskRepository;
        this.pdfTaskRepository = pdfTaskRepository;
        this.batchTaskRepository = batchTaskRepository;
        this.batchTaskItemRepository = batchTaskItemRepository;
        this.objectMapper = objectMapper;
        // 初始化LibreOffice转换器
        try {
            LocalOfficeManager officeManager = officeConfig.localOfficeManager();
            officeManager.start();
            this.converter = LocalConverter.builder()
                    .officeManager(officeManager)
                    .build();
            log.info("LibreOffice转换器初始化成功");
        } catch (Exception e) {
            log.error("初始化LibreOffice失败", e);
            throw new RuntimeException("初始化LibreOffice失败", e);
        }
        
        // 初始化批量任务线程池（有界队列，防OOM）
        this.batchTaskExecutor = new ThreadPoolExecutor(
            2,  // 核心线程数
            5,  // 最大线程数
            60, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(10),  // 有界队列
            new ThreadPoolExecutor.CallerRunsPolicy()  // 队列满时由调用线程执行
        );
        log.info("批量任务线程池初始化完成");
    }

    @Override
    @Transactional
    public ConvertResponse startConvert(Long userId, ConvertRequest request) {
        PdfTask sourceFile = pdfTaskRepository.findById(request.getFileId())
                .orElseThrow(() -> new IllegalArgumentException("源文件不存在"));

        ConvertTask task = new ConvertTask();
        task.setSourceFileId(request.getFileId());
        task.setSourceFileName(sourceFile.getFileName());
        task.setConvertType(request.getConvertType());
        
        try {
            // 只保存与当前转换类型相关的参数
            ConvertOptions filteredOptions = filterOptionsByConvertType(
                request.getConvertType(), request.getOptions());
            task.setOptionsJson(objectMapper.writeValueAsString(filteredOptions));
        } catch (Exception e) {
            throw new RuntimeException("序列化转换选项失败", e);
        }
        
        task.setStatus("processing");
        task.setUser(sourceFile.getUser());

        ConvertTask savedTask = convertTaskRepository.save(task);

        executeConvertAsync(savedTask, request.getOptions());

        return ConvertResponse.builder()
                .taskId(savedTask.getId())
                .sourceFileName(savedTask.getSourceFileName())
                .convertType(savedTask.getConvertType())
                .status(savedTask.getStatus())
                .message("转换任务已创建")
                .createdAt(savedTask.getCreatedAt())
                .build();
    }

    /**
     * 根据转换类型过滤参数，只保留相关的参数
     */
    private ConvertOptions filterOptionsByConvertType(String convertType, ConvertOptions options) {
        if (options == null) {
            return new ConvertOptions();
        }

        ConvertOptions filtered = new ConvertOptions();

        switch (convertType) {
            case "pdf_to_image":
                filtered.setImageType(options.getImageType());
                filtered.setJpgQuality(options.getJpgQuality());
                filtered.setDpi(options.getDpi());
                break;

            case "pdf_to_office":
                filtered.setOfficeFormat(options.getOfficeFormat());
                break;

            case "image_to_pdf":
                filtered.setPageSize(options.getPageSize());
                filtered.setOrientation(options.getOrientation());
                break;

            case "office_to_pdf":
                filtered.setEmbedFonts(options.getEmbedFonts());
                break;

            default:
                break;
        }

        return filtered;
    }

    @Override
    public ConvertResponse getConvertStatus(Long taskId) {
        ConvertTask task = convertTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("转换任务不存在"));

        return ConvertResponse.builder()
                .taskId(task.getId())
                .sourceFileName(task.getSourceFileName())
                .convertType(task.getConvertType())
                .status(task.getStatus())
                .resultFileUrl(task.getResultFileUrl())
                .message(task.getErrorMessage())
                .createdAt(task.getCreatedAt())
                .build();
    }

    @Override
    public ConvertResponse getConvertResult(Long taskId) {
        return getConvertStatus(taskId);
    }

    @Override
    public java.util.List<ConvertResponse> getConvertHistory(Long userId) {
        java.util.List<ConvertTask> tasks = convertTaskRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return tasks.stream()
                .map(task -> ConvertResponse.builder()
                        .taskId(task.getId())
                        .sourceFileName(task.getSourceFileName())
                        .convertType(task.getConvertType())
                        .status(task.getStatus())
                        .resultFileUrl(task.getResultFileUrl())
                        .message(task.getErrorMessage())
                        .createdAt(task.getCreatedAt())
                        .build())
                .collect(java.util.stream.Collectors.toList());
    }

    private void executeConvertAsync(ConvertTask task, ConvertOptions options) {
        new Thread(() -> {
            try {
                task.setStatus("processing");
                convertTaskRepository.save(task);

                String convertType = task.getConvertType();
                
                if (convertType.equals("pdf_to_image")) {
                    convertPdfToImage(task, options);
                } else if (convertType.equals("pdf_to_office")) {
                    convertPdfToOffice(task, options);
                } else if (convertType.equals("image_to_pdf")) {
                    convertImageToPdf(task, options);
                } else if (convertType.equals("office_to_pdf")) {
                    convertOfficeToPdf(task, options);
                }

                task.setStatus("completed");
                convertTaskRepository.save(task);

            } catch (Exception e) {
                task.setStatus("failed");
                task.setErrorMessage(e.getMessage());
                convertTaskRepository.save(task);
            }
        }).start();
    }

    private void convertPdfToImage(ConvertTask task, ConvertOptions options) throws IOException {
        PdfTask sourceFile = pdfTaskRepository.findById(task.getSourceFileId())
                .orElseThrow(() -> new IllegalArgumentException("源文件不存在"));
        
        Path sourcePath = Paths.get(sourceFile.getFilePath());
        String baseName = task.getSourceFileName().substring(0, task.getSourceFileName().lastIndexOf('.'));
        
        // 获取用户DPI设置（0表示auto）
        int userDpi = 0;
        if (options != null && options.getDpi() != null) {
            if (options.getDpi() instanceof Integer) {
                userDpi = (Integer) options.getDpi();
            } else if (options.getDpi() instanceof String) {
                String dpiStr = (String) options.getDpi();
                if (!"auto".equals(dpiStr)) {
                    userDpi = Integer.parseInt(dpiStr);
                }
            }
        }

        // 获取JPG质量
        int jpgQuality = 90;
        if (options != null && options.getJpgQuality() != null) {
            jpgQuality = options.getJpgQuality();
        }

        // 获取用户选择的图像格式
        String userImageType = "auto";
        if (options != null && options.getImageType() != null) {
            userImageType = options.getImageType().toLowerCase();
        }

        // 创建临时目录存放图片
        Path tempDir = Paths.get(convertedDir, "temp_" + System.currentTimeMillis());
        Files.createDirectories(tempDir);

        try (PDDocument document = PDDocument.load(sourcePath.toFile())) {
            int pageCount = document.getNumberOfPages();
            
            // 分析第一页类型
            PageAnalysis analysis = analyzePage(document, 0);
            
            if (analysis.isPureScan) {
                // 情况1：纯扫描件
                // - auto: 使用原图片格式
                // - 指定格式: 使用用户选择的格式
                String outputFormat = "auto".equals(userImageType) ? "auto" : userImageType;
                convertScanPages(document, baseName, tempDir, pageCount, userDpi, jpgQuality, outputFormat);
            } else {
                // 情况2：矢量/混合型
                // - auto: 固定使用PNG
                // - 指定格式: 使用用户选择的格式
                int dpi = (userDpi != 0) ? userDpi : 300;
                String outputFormat = "auto".equals(userImageType) ? "png" : userImageType;
                convertVectorPages(document, baseName, tempDir, pageCount, dpi, jpgQuality, outputFormat);
            }
        }

        // 保存输出（单页直接保存，多页打包ZIP）
        saveImageOutput(task, baseName, tempDir);

        // 清理临时目录
        deleteDirectory(tempDir.toFile());
    }

    /**
     * 页面分析结果
     */
    private static class PageAnalysis {
        boolean isPureScan;
        int calculatedDpi;
        
        PageAnalysis(boolean isPureScan, int calculatedDpi) {
            this.isPureScan = isPureScan;
            this.calculatedDpi = calculatedDpi;
        }
    }

    /**
     * 分析PDF页面类型
     */
    private PageAnalysis analyzePage(PDDocument document, int pageIndex) throws IOException {
        PDPage page = document.getPage(pageIndex);
        PDResources resources = page.getResources();
        
        int totalImages = 0;
        int firstImageWidth = 0;
        
        if (resources != null && resources.getXObjectNames() != null) {
            for (COSName name : resources.getXObjectNames()) {
                PDImageXObject image = (PDImageXObject) resources.getXObject(name);
                if (image != null) {
                    totalImages++;
                    if (totalImages == 1) {
                        firstImageWidth = image.getWidth();
                    }
                }
            }
        }
        
        // 统计文字
        PDFTextStripper textStripper = new PDFTextStripper();
        textStripper.setStartPage(pageIndex + 1);
        textStripper.setEndPage(pageIndex + 1);
        String pageText = textStripper.getText(document);
        int textCharCount = pageText.replaceAll("\\s+", "").length();
        
        // 判断是否为纯扫描件
        boolean isPureScan = (totalImages > 0 && textCharCount == 0);
        
        // 计算DPI
        int calculatedDpi = 150;
        if (isPureScan && firstImageWidth > 0) {
            float pageWidthInches = page.getMediaBox().getWidth() / 72.0f;
            float actualDpi = firstImageWidth / pageWidthInches;
            
            if (actualDpi < 140) calculatedDpi = 72;
            else if (actualDpi < 290) calculatedDpi = 150;
            else if (actualDpi < 590) calculatedDpi = 300;
            else calculatedDpi = 600;
        }
        
        log.info("页面分析: 纯扫描={}, 计算DPI={}, 文字数={}", isPureScan, calculatedDpi, textCharCount);
        
        return new PageAnalysis(isPureScan, calculatedDpi);
    }

    /**
     * 转换纯扫描件（直接提取内嵌图片）
     * @param outputFormat "auto"表示使用原图片格式，否则使用指定格式
     */
    private void convertScanPages(PDDocument document, String baseName, Path tempDir, 
                                  int pageCount, int userDpi, int jpgQuality, String outputFormat) throws IOException {
        for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            PDPage page = document.getPage(pageIndex);
            PDResources resources = page.getResources();
            
            if (resources == null || resources.getXObjectNames() == null) continue;
            
            for (COSName name : resources.getXObjectNames()) {
                PDImageXObject image = (PDImageXObject) resources.getXObject(name);
                if (image != null) {
                    // 根据outputFormat决定使用原格式还是指定格式
                    String format = "auto".equals(outputFormat) ? image.getSuffix() : outputFormat;
                    BufferedImage bim = image.getImage();
                    
                    int dpi = (userDpi != 0) ? userDpi : analyzePage(document, pageIndex).calculatedDpi;
                    
                    String imageFileName = baseName + "_page_" + (pageIndex + 1) + "_dpi" + dpi + "." + format;
                    File outputFile = tempDir.resolve(imageFileName).toFile();
                    
                    writeImageWithDpi(bim, format, dpi, jpgQuality, outputFile);
                    break;
                }
            }
        }
    }

    /**
     * 转换矢量/混合型PDF（使用PDFRenderer渲染）
     */
    private void convertVectorPages(PDDocument document, String baseName, Path tempDir,
                                    int pageCount, int dpi, int jpgQuality, String imageType) throws IOException {
        PDFRenderer pdfRenderer = new PDFRenderer(document);
        
        for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            BufferedImage bim = pdfRenderer.renderImageWithDPI(pageIndex, dpi);
            
            String imageFileName = baseName + "_page_" + (pageIndex + 1) + "_dpi" + dpi + "." + imageType;
            File outputFile = tempDir.resolve(imageFileName).toFile();
            writeImageWithDpi(bim, imageType, dpi, jpgQuality, outputFile);
        }
    }

    /**
     * 写入图片并附加DPI元数据（仅JPEG和PNG支持）
     */
    private void writeImageWithDpi(BufferedImage image, String format, int dpi, 
                                   int jpgQuality, File outputFile) throws IOException {
        if ("jpg".equalsIgnoreCase(format) || "jpeg".equalsIgnoreCase(format)) {
            // 先写入JPEG到临时字节数组
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageWriter writer = javax.imageio.ImageIO.getImageWritersByFormatName("jpeg").next();
            javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(jpgQuality / 100.0f);
            
            try (javax.imageio.stream.ImageOutputStream ios = javax.imageio.ImageIO.createImageOutputStream(baos)) {
                writer.setOutput(ios);
                writer.write(null, new javax.imageio.IIOImage(image, null, null), param);
            }
            writer.dispose();
            
            // 手动注入JFIF DPI标记
            byte[] jpegBytes = baos.toByteArray();
            byte[] jpegWithDpi = injectJfifDpiMarker(jpegBytes, dpi);
            
            java.nio.file.Files.write(outputFile.toPath(), jpegWithDpi);
            log.info("JPEG文件保存成功，DPI: {}", dpi);
            
        } else if ("png".equalsIgnoreCase(format)) {
            javax.imageio.ImageWriter writer = javax.imageio.ImageIO.getImageWritersByFormatName("png").next();
            javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
            
            javax.imageio.metadata.IIOMetadata metadata = writer.getDefaultImageMetadata(
                javax.imageio.ImageTypeSpecifier.createFromBufferedImageType(image.getType()), param);
            metadata = setPngDpiMetadata(metadata, dpi);
            
            try (javax.imageio.stream.ImageOutputStream ios = javax.imageio.ImageIO.createImageOutputStream(outputFile)) {
                writer.setOutput(ios);
                writer.write(metadata, new javax.imageio.IIOImage(image, null, metadata), param);
            }
            writer.dispose();
            
        } else {
            // 其他格式（TIFF/JPX等）直接保存，不写入DPI元数据
            ImageIO.write(image, format.toUpperCase(), outputFile);
        }
    }

    /**
     * 手动注入JFIF APP0 DPI标记到JPEG字节流
     * 
     * 策略：与前端TS代码保持一致，仅写入JFIF APP0，不写入EXIF
     * 跳过所有现有APP标记（0xFFE0-0xFFEF），在SOI后插入新JFIF
     * 
     * JPEG文件结构：
     * SOI (0xFFD8) → APP0 (JFIF) → 其他标记 → EOI (0xFFD9)
     */
    private byte[] injectJfifDpiMarker(byte[] jpegBytes, int dpi) {
        // JPEG必须以 0xFFD8 开头
        if (jpegBytes.length < 4 || jpegBytes[0] != (byte)0xFF || jpegBytes[1] != (byte)0xD8) {
            log.warn("无效的JPEG文件头");
            return jpegBytes;
        }
        
        // 查找第一个非APP标记的位置（跳过所有0xFFE0-0xFFEF）
        int offset = 2;
        while (offset + 3 < jpegBytes.length) {
            int marker = ((jpegBytes[offset] & 0xFF) << 8) | (jpegBytes[offset + 1] & 0xFF);
            
            // 检查是否是APP标记（0xFFE0-0xFFEF）
            if ((marker & 0xFF00) == 0xFF00 && marker >= 0xFFE0 && marker <= 0xFFEF) {
                int length = ((jpegBytes[offset + 2] & 0xFF) << 8) | (jpegBytes[offset + 3] & 0xFF);
                offset += length + 2;
            } else {
                // 遇到非APP标记，停止
                break;
            }
        }
        
        log.info("跳过{}字节的APP标记，在位置{}插入新JFIF", offset - 2, 2);
        
        // 构建JFIF APP0标记（16字节，不含FF E0标记）
        byte[] jfifHeader = new byte[] {
            (byte)0xFF, (byte)0xE0, // APP0标记
            0x00, 0x10,              // 长度 = 16字节（根据JFIF规范）
            0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
            0x01, 0x01,              // 版本 1.1
            0x01,                    // 单位：1 = DPI
            (byte)((dpi >> 8) & 0xFF), (byte)(dpi & 0xFF), // Xdensity
            (byte)((dpi >> 8) & 0xFF), (byte)(dpi & 0xFF), // Ydensity
            0x00, 0x00               // 缩略图尺寸 0x0
        };
        
        // 组装最终JPEG：SOI + 新JFIF + 剩余内容
        int totalLength = 2 + jfifHeader.length + (jpegBytes.length - offset);
        byte[] result = new byte[totalLength];
        
        // 写入 SOI
        result[0] = (byte)0xFF;
        result[1] = (byte)0xD8;
        
        // 写入 JFIF APP0
        System.arraycopy(jfifHeader, 0, result, 2, jfifHeader.length);
        
        // 写入剩余内容
        System.arraycopy(jpegBytes, offset, result, 2 + jfifHeader.length, jpegBytes.length - offset);
        
        log.info("JFIF APP0注入完成，DPI: {}", dpi);
        
        return result;
    }

    /**
     * 设置PNG的DPI元数据（pHYs块）
     */
    private javax.imageio.metadata.IIOMetadata setPngDpiMetadata(javax.imageio.metadata.IIOMetadata metadata, int dpi) {
        try {
            int dpiPerMeter = (int) Math.round(dpi / 0.0254);
            
            String format = "javax_imageio_png_1.0";
            javax.imageio.metadata.IIOMetadataNode root = new javax.imageio.metadata.IIOMetadataNode(format);
            
            javax.imageio.metadata.IIOMetadataNode pHYs = new javax.imageio.metadata.IIOMetadataNode("pHYs");
            pHYs.setAttribute("pixelsPerUnitXAxis", String.valueOf(dpiPerMeter));
            pHYs.setAttribute("pixelsPerUnitYAxis", String.valueOf(dpiPerMeter));
            pHYs.setAttribute("unitSpecifier", "meter");
            
            root.appendChild(pHYs);
            metadata.mergeTree(format, root);
        } catch (Exception e) {
            log.warn("设置PNG DPI元数据失败: {}", e.getMessage());
        }
        return metadata;
    }

    /**
     * 保存输出（单页直接保存，多页打包ZIP）
     */
    private void saveImageOutput(ConvertTask task, String baseName, Path tempDir) throws IOException {
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        File[] files = tempDir.toFile().listFiles();
        
        if (files == null || files.length == 0) {
            throw new IOException("未生成任何图片文件");
        }
        
        if (files.length == 1) {
            File src = files[0];
            String ext = src.getName().substring(src.getName().lastIndexOf('.'));
            String destName = baseName + "_converted_" + timestamp + ext;
            File dest = Paths.get(convertedDir, destName).toFile();
            Files.copy(src.toPath(), dest.toPath());
            
            task.setResultFilePath(dest.toString());
            task.setResultFileUrl("/api/files/view/" + destName);
        } else {
            String zipFileName = baseName + "_converted_" + timestamp + ".zip";
            Path zipPath = Paths.get(convertedDir, zipFileName);
            
            try (FileOutputStream fos = new FileOutputStream(zipPath.toFile());
                 ZipOutputStream zos = new ZipOutputStream(fos)) {
                
                for (File imageFile : files) {
                    zos.putNextEntry(new ZipEntry(imageFile.getName()));
                    Files.copy(imageFile.toPath(), zos);
                    zos.closeEntry();
                }
            }
            
            task.setResultFilePath(zipPath.toString());
            task.setResultFileUrl("/api/files/view/" + zipFileName);
        }
    }

    private void convertImageToPdf(ConvertTask task, ConvertOptions options) throws IOException {
        PdfTask sourceFile = pdfTaskRepository.findById(task.getSourceFileId())
                .orElseThrow(() -> new IllegalArgumentException("源文件不存在"));
        
        Path sourcePath = Paths.get(sourceFile.getFilePath());
        String baseName = task.getSourceFileName().substring(0, task.getSourceFileName().lastIndexOf('.'));
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        String resultFileName = baseName + "_converted_" + timestamp + ".pdf";
        Path resultPath = Paths.get(convertedDir, resultFileName);

        // 读取图片
        BufferedImage image = ImageIO.read(sourcePath.toFile());
        if (image == null) {
            throw new IOException("无法读取图片文件");
        }

        // 获取页面尺寸
        PDRectangle pageSize;
        String pageSizeStr = options != null ? options.getPageSize() : null;
        if ("A4".equals(pageSizeStr)) {
            pageSize = PDRectangle.A4;
        } else if ("A3".equals(pageSizeStr)) {
            pageSize = PDRectangle.A3;
        } else if ("Letter".equals(pageSizeStr)) {
            pageSize = PDRectangle.LETTER;
        } else if ("Legal".equals(pageSizeStr)) {
            pageSize = PDRectangle.LEGAL;
        } else {
            // FitToImage 或默认：使用图片原始尺寸
            pageSize = new PDRectangle(image.getWidth(), image.getHeight());
        }

        // 获取页面方向
        String orientation = options != null ? options.getOrientation() : null;
        boolean isLandscape = "landscape".equals(orientation);

        // 如果是横向，交换宽高
        // 一次性取出原始宽高，仅调用2次get方法
        final float originalW = pageSize.getWidth();
        final float originalH = pageSize.getHeight();

        // 横向直接交换，纵向直接使用原值
        float pageWidth = isLandscape ? originalH : originalW;
        float pageHeight = isLandscape ? originalW : originalH;

        // 创建PDF
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(new PDRectangle(pageWidth, pageHeight));
            document.addPage(page);

            // 计算图片缩放比例，使其适应页面
            float imageWidth = image.getWidth();
            float imageHeight = image.getHeight();
            float scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
            float scaledWidth = imageWidth * scale;
            float scaledHeight = imageHeight * scale;
            
            // 居中放置图片
            float x = (pageWidth - scaledWidth) / 2;
            float y = (pageHeight - scaledHeight) / 2;

            // 将图片添加到PDF
            PDImageXObject pdImage = PDImageXObject.createFromFile(sourcePath.toString(), document);
            
            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.drawImage(pdImage, x, y, scaledWidth, scaledHeight);
            }

            // 保存PDF
            document.save(resultPath.toFile());
        }

        task.setResultFilePath(resultPath.toString());
        task.setResultFileUrl("/api/files/view/" + resultFileName);
    }

    private void convertPdfToOffice(ConvertTask task, ConvertOptions options) throws IOException {
        //  to do with python api to convert pdf to office format;
        //  调用python脚本，将pdf转换为office格式
    }
    private void convertOfficeToPdf(ConvertTask task, ConvertOptions options) throws IOException {
        PdfTask sourceFile = pdfTaskRepository.findById(task.getSourceFileId())
                .orElseThrow(() -> new IllegalArgumentException("源文件不存在"));
        
        String sourceFileName = task.getSourceFileName();
        String baseName = sourceFileName.substring(0, sourceFileName.lastIndexOf('.'));
        String extension = sourceFileName.substring(sourceFileName.lastIndexOf('.') + 1).toLowerCase();
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        String resultFileName = baseName + "_converted_" + timestamp + ".pdf";
        Path resultPath = Paths.get(convertedDir, resultFileName);
        Path sourcePath = Paths.get(sourceFile.getFilePath());
        
        boolean embedFonts = options != null && Boolean.TRUE.equals(options.getEmbedFonts());
        
        // 通用过滤参数
        java.util.Map<String, Object> filterData = new java.util.HashMap<>();
        filterData.put("SelectPdfVersion", 0); // PDF 1.4
        if (embedFonts) {
            filterData.put("EmbedFonts", true);
        }
        
        // 根据文档类型单独构建Format，三选一
        DocumentFormat.Builder pdfFormatBuilder = DocumentFormat.builder(DefaultDocumentFormatRegistry.PDF);
        
        switch (extension) {
            case "docx":
            case "doc":
                pdfFormatBuilder.storeProperty(DocumentFamily.TEXT, "FilterName", "writer_pdf_Export")
                        .storeProperty(DocumentFamily.TEXT, "FilterData", filterData);
                break;
            case "xlsx":
            case "xls":
                pdfFormatBuilder.storeProperty(DocumentFamily.SPREADSHEET, "FilterName", "calc_pdf_Export")
                        .storeProperty(DocumentFamily.SPREADSHEET, "FilterData", filterData);
                break;
            case "pptx":
            case "ppt":
                pdfFormatBuilder.storeProperty(DocumentFamily.PRESENTATION, "FilterName", "impress_pdf_Export")
                        .storeProperty(DocumentFamily.PRESENTATION, "FilterData", filterData);
                break;
            default:
                throw new IllegalArgumentException("不支持的Office文件后缀：" + extension);
        }
        DocumentFormat pdfFormat = pdfFormatBuilder.build();
        
        try {
            log.info("开始Office转PDF: source={}, target={}, embedFonts={}", sourcePath, resultPath, embedFonts);
            
            converter.convert(sourcePath.toFile())
                    .to(resultPath.toFile())
                    .as(pdfFormat)
                    .execute();
            
            task.setResultFilePath(resultPath.toString());
            task.setResultFileUrl("/api/files/view/" + resultFileName);
        } catch (OfficeException e) {
            log.error("Office转PDF失败, source={}, target={}", sourcePath, resultPath, e);
            throw new IOException("Office转PDF失败: " + e.getMessage(), e);
        }
    }

    private void deleteDirectory(File directory) {
        File[] files = directory.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    deleteDirectory(file);
                } else {
                    file.delete();
                }
            }
        }
        directory.delete();
    }

    @Override
    public BatchConvertResponse startBatchConvert(Long userId, BatchConvertRequest request) {
        String taskType = request.getTaskType();
        java.util.List<String> fileIdList = request.getFileIdList();
        
        if (taskType == null || taskType.isEmpty()) {
            throw new IllegalArgumentException("任务类型不能为空");
        }
        if (fileIdList == null || fileIdList.isEmpty()) {
            throw new IllegalArgumentException("文件列表不能为空");
        }
        
        String taskId = java.util.UUID.randomUUID().toString();
        
        BatchTask batchTask = BatchTask.builder()
                .taskId(taskId)
                .userId(userId)
                .taskType(taskType)
                .status("pending")
                .totalCount(fileIdList.size())
                .successCount(0)
                .failCount(0)
                .configJson(request.getConfig() != null ? request.getConfig().toString() : null)
                .build();
        batchTaskRepository.save(batchTask);
        
        for (int i = 0; i < fileIdList.size(); i++) {
            Long fileId = Long.parseLong(fileIdList.get(i));
            org.example.entity.PdfTask sourceFile = pdfTaskRepository.findById(fileId)
                    .orElseThrow(() -> new IllegalArgumentException("源文件不存在: " + fileId));
            
            BatchTaskItem item = BatchTaskItem.builder()
                    .batchTaskId(batchTask.getId())
                    .sourceFileId(fileId)
                    .sourceFileName(sourceFile.getFileName())
                    .status("pending")
                    .sortOrder(i)
                    .build();
            batchTaskItemRepository.save(item);
        }
        
        batchTask.setStatus("processing");
        batchTaskRepository.save(batchTask);
        
        batchTaskExecutor.submit(() -> executeBatchTask(batchTask.getId(), taskType, request.getConfig()));
        
        return BatchConvertResponse.builder()
                .taskId(taskId)
                .status("processing")
                .totalCount(fileIdList.size())
                .successCount(0)
                .failCount(0)
                .build();
    }

    @Override
    public BatchConvertResponse getBatchTaskStatus(String taskId) {
        BatchTask batchTask = batchTaskRepository.findByTaskId(taskId)
                .orElseThrow(() -> new IllegalArgumentException("批量任务不存在"));
        
        java.util.List<BatchTaskItem> items = batchTaskItemRepository.findByBatchTaskIdOrderBySortOrder(batchTask.getId());
        java.util.List<BatchConvertResponse.BatchTaskItemResponse> itemResponses = items.stream()
                .map(item -> BatchConvertResponse.BatchTaskItemResponse.builder()
                        .sourceFileId(item.getSourceFileId())
                        .sourceFileName(item.getSourceFileName())
                        .status(item.getStatus())
                        .resultFileUrl(item.getResultFileUrl())
                        .errorMessage(item.getErrorMessage())
                        .build())
                .collect(java.util.stream.Collectors.toList());
        
        return BatchConvertResponse.builder()
                .taskId(batchTask.getTaskId())
                .status(batchTask.getStatus())
                .totalCount(batchTask.getTotalCount())
                .successCount(batchTask.getSuccessCount())
                .failCount(batchTask.getFailCount())
                .taskResultFileUrl(batchTask.getResultFileUrl())
                .items(itemResponses)
                .build();
    }

    private void executeBatchTask(Long batchTaskId, String taskType, java.util.Map<String, Object> config) {
        try {
            java.util.List<BatchTaskItem> items = batchTaskItemRepository.findByBatchTaskIdOrderBySortOrder(batchTaskId);
            int successCount = 0;
            int failCount = 0;
            
            // 图片批量转PDF（合并模式）
            boolean isImageMergeMode = "image_to_pdf_batch".equals(taskType) && "merge".equals(config.get("outputMode"));
            // PDF合并模式
            boolean isMergePdfMode = "merge_pdf".equals(taskType);
            
            if (isImageMergeMode) {
                handleImageToPdfMerge(batchTaskId, items, config);
                return;
            }
            
            if (isMergePdfMode) {
                handleMergePdfBatch(batchTaskId, items, config);
                return;
            }
            
            for (BatchTaskItem item : items) {
                try {
                    item.setStatus("processing");
                    batchTaskItemRepository.save(item);
                    
                    switch (taskType) {
                        case "image_to_pdf_batch":
                            handleImageToPdf(item, config);
                            break;
                        case "office_to_pdf_batch":
                            handleOfficeToPdf(item, config);
                            break;
                        case "pdf_to_image_batch":
                            handlePdfToImage(item, config);
                            break;
                        default:
                            throw new IllegalArgumentException("不支持的任务类型: " + taskType);
                    }
                    
                    item.setStatus("completed");
                    successCount++;
                } catch (Exception e) {
                    log.error("批量任务处理失败: itemId={}", item.getId(), e);
                    item.setStatus("failed");
                    item.setErrorMessage(e.getMessage());
                    failCount++;
                }
                batchTaskItemRepository.save(item);
                
                BatchTask batchTask = batchTaskRepository.findById(batchTaskId).orElse(null);
                if (batchTask != null) {
                    batchTask.setSuccessCount(successCount);
                    batchTask.setFailCount(failCount);
                    batchTaskRepository.save(batchTask);
                }
            }
            
            BatchTask batchTask = batchTaskRepository.findById(batchTaskId).orElse(null);
            if (batchTask != null) {
                batchTask.setStatus("completed");
                batchTaskRepository.save(batchTask);
            }
        } catch (Exception e) {
            log.error("批量任务执行异常: batchTaskId={}", batchTaskId, e);
            BatchTask batchTask = batchTaskRepository.findById(batchTaskId).orElse(null);
            if (batchTask != null) {
                batchTask.setStatus("failed");
                batchTask.setErrorMessage(e.getMessage());
                batchTaskRepository.save(batchTask);
            }
        }
    }

    private void handleImageToPdfMerge(Long batchTaskId, java.util.List<BatchTaskItem> items, java.util.Map<String, Object> config) throws Exception {
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        String resultFileName = "merged_images_" + timestamp + ".pdf";
        Path resultPath = Paths.get(convertedDir, resultFileName);
        
        String pageSizeStr = config != null ? (String) config.get("pageSize") : "A4";
        String orientation = config != null ? (String) config.get("orientation") : "portrait";
        
        try (PDDocument document = new PDDocument()) {
            for (BatchTaskItem item : items) {
                try {
                    item.setStatus("processing");
                    batchTaskItemRepository.save(item);
                    
                    PdfTask sourceFile = pdfTaskRepository.findById(item.getSourceFileId())
                            .orElseThrow(() -> new IllegalArgumentException("源文件不存在: " + item.getSourceFileId()));
                    
                    Path sourcePath = Paths.get(sourceFile.getFilePath());
                    BufferedImage image = ImageIO.read(sourcePath.toFile());
                    if (image == null) {
                        throw new IOException("无法读取图片文件");
                    }
                    
                    PDRectangle pageSize;
                    if ("A4".equals(pageSizeStr)) {
                        pageSize = PDRectangle.A4;
                    } else if ("A3".equals(pageSizeStr)) {
                        pageSize = PDRectangle.A3;
                    } else if ("Letter".equals(pageSizeStr)) {
                        pageSize = PDRectangle.LETTER;
                    } else if ("Legal".equals(pageSizeStr)) {
                        pageSize = PDRectangle.LEGAL;
                    } else {
                        pageSize = new PDRectangle(image.getWidth(), image.getHeight());
                    }
                    
                    boolean isLandscape = "landscape".equals(orientation);
                    float originalW = pageSize.getWidth();
                    float originalH = pageSize.getHeight();
                    float pageWidth = isLandscape ? originalH : originalW;
                    float pageHeight = isLandscape ? originalW : originalH;
                    
                    PDPage page = new PDPage(new PDRectangle(pageWidth, pageHeight));
                    document.addPage(page);
                    
                    float imageWidth = image.getWidth();
                    float imageHeight = image.getHeight();
                    float scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
                    float scaledWidth = imageWidth * scale;
                    float scaledHeight = imageHeight * scale;
                    float x = (pageWidth - scaledWidth) / 2;
                    float y = (pageHeight - scaledHeight) / 2;
                    
                    PDImageXObject pdImage = PDImageXObject.createFromFile(sourcePath.toString(), document);
                    try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                        contentStream.drawImage(pdImage, x, y, scaledWidth, scaledHeight);
                    }
                    
                    item.setStatus("completed");
                    batchTaskItemRepository.save(item);
                } catch (Exception e) {
                    log.error("合并PDF处理失败: itemId={}", item.getId(), e);
                    item.setStatus("failed");
                    item.setErrorMessage(e.getMessage());
                    batchTaskItemRepository.save(item);
                }
            }
            
            document.save(resultPath.toFile());
        }
        
        BatchTask batchTask = batchTaskRepository.findById(batchTaskId).orElse(null);
        if (batchTask != null) {
            batchTask.setResultFilePath(resultPath.toString());
            batchTask.setResultFileUrl("/api/files/view/" + resultFileName);
            int successCount = (int) items.stream().filter(i -> "completed".equals(i.getStatus())).count();
            int failCount = (int) items.stream().filter(i -> "failed".equals(i.getStatus())).count();
            batchTask.setSuccessCount(successCount);
            batchTask.setFailCount(failCount);
            batchTask.setStatus("completed");
            batchTaskRepository.save(batchTask);
        }
        
        for (BatchTaskItem item : items) {
            if ("completed".equals(item.getStatus())) {
                batchTaskItemRepository.save(item);
            }
        }
    }

    private void handleMergePdfBatch(Long batchTaskId, java.util.List<BatchTaskItem> items, java.util.Map<String, Object> config) throws Exception {
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        String resultFileName = "merged_pdf_" + timestamp + ".pdf";
        Path resultPath = Paths.get(convertedDir, resultFileName);
        
        int successCount = 0;
        int failCount = 0;
        
        // 获取页面尺寸配置
        String pageSizeStr = config != null ? (String) config.get("pageSize") : "original";
        boolean keepOriginal = "original".equals(pageSizeStr);
        
        // 只有非original时才需要处理orientation
        String orientation = keepOriginal ? null : (String) config.get("orientation");
        boolean isLandscape = "landscape".equals(orientation);
        
        // 先收集所有需要合并的源文件路径
        java.util.List<Path> sourcePaths = new java.util.ArrayList<>();
        java.util.List<BatchTaskItem> validItems = new java.util.ArrayList<>();
        
        for (BatchTaskItem item : items) {
            try {
                item.setStatus("processing");
                batchTaskItemRepository.save(item);
                
                PdfTask sourceFile = pdfTaskRepository.findById(item.getSourceFileId())
                        .orElseThrow(() -> new IllegalArgumentException("源文件不存在: " + item.getSourceFileId()));
                
                Path sourcePath = Paths.get(sourceFile.getFilePath());
                sourcePaths.add(sourcePath);
                validItems.add(item);
            } catch (Exception e) {
                log.error("准备合并PDF失败: itemId={}", item.getId(), e);
                item.setStatus("failed");
                item.setErrorMessage(e.getMessage());
                failCount++;
                batchTaskItemRepository.save(item);
            }
        }
        
        if (keepOriginal) {
            // 保持原格式：使用 PDFMergerUtility 直接合并
            org.apache.pdfbox.multipdf.PDFMergerUtility merger = new org.apache.pdfbox.multipdf.PDFMergerUtility();
            merger.setDestinationFileName(resultPath.toString());
            
            for (Path sourcePath : sourcePaths) {
                merger.addSource(sourcePath.toFile());
            }
            
            merger.mergeDocuments(null);
        } else {

            // 第一步：先用 PDFMergerUtility 合并所有PDF
            Path tempMergedPath = Paths.get(convertedDir, "temp_merged_" + System.currentTimeMillis() + ".pdf");
            org.apache.pdfbox.multipdf.PDFMergerUtility merger = new org.apache.pdfbox.multipdf.PDFMergerUtility();
            merger.setDestinationFileName(tempMergedPath.toString());
            
            for (Path sourcePath : sourcePaths) {
                merger.addSource(sourcePath.toFile());
            }
            
            merger.mergeDocuments(null);
            
            // 第二步：打开合并后的文档，逐页处理
            try (PDDocument mergedDocument = PDDocument.load(tempMergedPath.toFile())) {
                int pageCount = mergedDocument.getNumberOfPages();
                // 统一页面尺寸或横向：先合并，再处理页面
                PDRectangle targetPageSize = getPageSizeByName(pageSizeStr);
                if (isLandscape) targetPageSize = new PDRectangle(targetPageSize.getHeight(), targetPageSize.getWidth());

                for (int i = 0; i < pageCount; i++) {
                    PDPage oldPage = mergedDocument.getPage(i);
                    PDRectangle oldPageSize = oldPage.getMediaBox();

                    // 计算缩放比例（保持宽高比，适应新页面）
                    float scaleX = targetPageSize.getWidth() / oldPageSize.getWidth();
                    float scaleY = targetPageSize.getHeight() / oldPageSize.getHeight();
                    float scale = Math.min(scaleX, scaleY);
                    
                    // 计算居中偏移
                    float offsetX = (targetPageSize.getWidth() - oldPageSize.getWidth() * scale) / 2;
                    float offsetY = (targetPageSize.getHeight() - oldPageSize.getHeight() * scale) / 2;
                    
                    // 创建新页面
                    PDPage newPage = new PDPage(targetPageSize);
                    mergedDocument.addPage(newPage);
                    
                    // 使用 LayerUtility 导入旧页面为表单
                    LayerUtility layerUtility = new LayerUtility(mergedDocument);
                    PDFormXObject form = layerUtility.importPageAsForm(mergedDocument, oldPage);
                    
                    // 在新页面上绘制缩放后的内容
                    try (PDPageContentStream contentStream = new PDPageContentStream(mergedDocument, newPage)) {
                        contentStream.saveGraphicsState();
                        contentStream.transform(new org.apache.pdfbox.util.Matrix(scale, 0, 0, scale, offsetX, offsetY));
                        contentStream.drawForm(form);
                        contentStream.restoreGraphicsState();
                    }
                }
                
                // 删除旧页面（前 pageCount 页）
                for (int i = pageCount - 1; i >= 0; i--) {
                    mergedDocument.removePage(i);
                }
                
                mergedDocument.save(resultPath.toFile());
            }
            
            // 删除临时文件
            tempMergedPath.toFile().delete();
        }
        
        // 更新任务状态
        for (BatchTaskItem item : validItems) {
            item.setStatus("completed");
            item.setResultFilePath(resultPath.toString());
            item.setResultFileUrl("/api/files/view/" + resultFileName);
            batchTaskItemRepository.save(item);
            successCount++;
        }
        
        BatchTask batchTask = batchTaskRepository.findById(batchTaskId).orElse(null);
        if (batchTask != null) {
            batchTask.setResultFilePath(resultPath.toString());
            batchTask.setResultFileUrl("/api/files/view/" + resultFileName);
            batchTask.setSuccessCount(successCount);
            batchTask.setFailCount(failCount);
            batchTask.setStatus("completed");
            batchTaskRepository.save(batchTask);
        }
    }


    private void handleImageToPdf(BatchTaskItem item, java.util.Map<String, Object> config) throws Exception {
        PdfTask sourceFile = pdfTaskRepository.findById(item.getSourceFileId())
                .orElseThrow(() -> new IllegalArgumentException("源文件不存在: " + item.getSourceFileId()));
        
        Path sourcePath = Paths.get(sourceFile.getFilePath());
        String baseName = sourceFile.getFileName().substring(0, sourceFile.getFileName().lastIndexOf('.'));
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        String resultFileName = baseName + "_converted_" + timestamp + ".pdf";
        Path resultPath = Paths.get(convertedDir, resultFileName);

        BufferedImage image = ImageIO.read(sourcePath.toFile());
        if (image == null) {
            throw new IOException("无法读取图片文件");
        }

        String pageSizeStr = config != null ? (String) config.get("pageSize") : "A4";
        String orientation = config != null ? (String) config.get("orientation") : "portrait";
        
        PDRectangle pageSize;
        if ("A4".equals(pageSizeStr)) {
            pageSize = PDRectangle.A4;
        } else if ("A3".equals(pageSizeStr)) {
            pageSize = PDRectangle.A3;
        } else if ("Letter".equals(pageSizeStr)) {
            pageSize = PDRectangle.LETTER;
        } else if ("Legal".equals(pageSizeStr)) {
            pageSize = PDRectangle.LEGAL;
        } else {
            pageSize = new PDRectangle(image.getWidth(), image.getHeight());
        }

        boolean isLandscape = "landscape".equals(orientation);
        float originalW = pageSize.getWidth();
        float originalH = pageSize.getHeight();
        float pageWidth = isLandscape ? originalH : originalW;
        float pageHeight = isLandscape ? originalW : originalH;

        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(new PDRectangle(pageWidth, pageHeight));
            document.addPage(page);

            float imageWidth = image.getWidth();
            float imageHeight = image.getHeight();
            float scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
            float scaledWidth = imageWidth * scale;
            float scaledHeight = imageHeight * scale;
            float x = (pageWidth - scaledWidth) / 2;
            float y = (pageHeight - scaledHeight) / 2;

            PDImageXObject pdImage = PDImageXObject.createFromFile(sourcePath.toString(), document);
            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.drawImage(pdImage, x, y, scaledWidth, scaledHeight);
            }
            document.save(resultPath.toFile());
        }

        item.setResultFilePath(resultPath.toString());
        item.setResultFileUrl("/api/files/view/" + resultFileName);
    }

    private void handleOfficeToPdf(BatchTaskItem item, java.util.Map<String, Object> config) throws Exception {
        PdfTask sourceFile = pdfTaskRepository.findById(item.getSourceFileId())
                .orElseThrow(() -> new IllegalArgumentException("源文件不存在: " + item.getSourceFileId()));
        
        String sourceFileName = sourceFile.getFileName();
        String baseName = sourceFileName.substring(0, sourceFileName.lastIndexOf('.'));
        String extension = sourceFileName.substring(sourceFileName.lastIndexOf('.') + 1).toLowerCase();
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        String resultFileName = baseName + "_converted_" + timestamp + ".pdf";
        Path resultPath = Paths.get(convertedDir, resultFileName);
        Path sourcePath = Paths.get(sourceFile.getFilePath());
        
        boolean embedFonts = config != null && Boolean.TRUE.equals(config.get("embedFonts"));
        
        java.util.Map<String, Object> filterData = new java.util.HashMap<>();
        filterData.put("SelectPdfVersion", 0);
        if (embedFonts) {
            filterData.put("EmbedFonts", true);
        }
        
        DocumentFormat.Builder pdfFormatBuilder = DocumentFormat.builder(DefaultDocumentFormatRegistry.PDF);
        
        switch (extension) {
            case "docx":
            case "doc":
                pdfFormatBuilder.storeProperty(DocumentFamily.TEXT, "FilterName", "writer_pdf_Export")
                        .storeProperty(DocumentFamily.TEXT, "FilterData", filterData);
                break;
            case "xlsx":
            case "xls":
                pdfFormatBuilder.storeProperty(DocumentFamily.SPREADSHEET, "FilterName", "calc_pdf_Export")
                        .storeProperty(DocumentFamily.SPREADSHEET, "FilterData", filterData);
                break;
            case "pptx":
            case "ppt":
                pdfFormatBuilder.storeProperty(DocumentFamily.PRESENTATION, "FilterName", "impress_pdf_Export")
                        .storeProperty(DocumentFamily.PRESENTATION, "FilterData", filterData);
                break;
            default:
                throw new IllegalArgumentException("不支持的Office文件后缀：" + extension);
        }
        DocumentFormat pdfFormat = pdfFormatBuilder.build();
        
        converter.convert(sourcePath.toFile())
                .to(resultPath.toFile())
                .as(pdfFormat)
                .execute();
        
        item.setResultFilePath(resultPath.toString());
        item.setResultFileUrl("/api/files/view/" + resultFileName);
    }

    private void handlePdfToImage(BatchTaskItem item, java.util.Map<String, Object> config) throws Exception {
        PdfTask sourceFile = pdfTaskRepository.findById(item.getSourceFileId())
                .orElseThrow(() -> new IllegalArgumentException("源文件不存在: " + item.getSourceFileId()));
        
        Path sourcePath = Paths.get(sourceFile.getFilePath());
        String baseName = sourceFile.getFileName().substring(0, sourceFile.getFileName().lastIndexOf('.'));
        String timestamp = new java.text.SimpleDateFormat("yyyyMMdd_HHmmss").format(new java.util.Date());
        
        try (PDDocument document = PDDocument.load(sourcePath.toFile())) {
            PDFRenderer renderer = new PDFRenderer(document);
            
            String imageType = config != null ? (String) config.get("imageType") : "auto";
            String dpiStr = config != null ? (String) config.get("dpi") : "auto";
            float dpi = "auto".equals(dpiStr) ? 300 : Float.parseFloat(dpiStr);
            int jpgQuality = config != null && config.get("jpgQuality") != null ? 
                    Integer.parseInt(config.get("jpgQuality").toString()) : 90;
            String outputFile = config != null ? (String) config.get("outputFile") : "";
            
            String ext = "png".equals(imageType) ? "png" : "jpg";
            String resultFileName = baseName + "_converted_" + timestamp + "." + ext;
            Path resultPath = Paths.get(convertedDir, resultFileName);
            
            BufferedImage bim = renderer.renderImageWithDPI(0, dpi);
            writeImageWithDpi(bim, ext, (int) dpi, jpgQuality, resultPath.toFile());
            
            item.setResultFilePath(resultPath.toString());
            item.setResultFileUrl("/api/files/view/" + resultFileName);
        }
    }

    @PreDestroy
    public void shutdown() {
        log.info("关闭批量任务线程池...");
        batchTaskExecutor.shutdown();
        try {
            if (!batchTaskExecutor.awaitTermination(30, TimeUnit.SECONDS)) {
                batchTaskExecutor.shutdownNow();
            }
        } catch (InterruptedException e) {
            batchTaskExecutor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    /**
     * 根据页面尺寸名称获取对应的PDRectangle对象
     * @param pageSizeStr 页面尺寸名称：A4, A3, Letter, Legal
     * @return 对应的PDRectangle对象
     */
    private PDRectangle getPageSizeByName(String pageSizeStr) {
        if ("A4".equals(pageSizeStr)) {
            return PDRectangle.A4;
        } else if ("A3".equals(pageSizeStr)) {
            return PDRectangle.A3;
        } else if ("Letter".equals(pageSizeStr)) {
            return PDRectangle.LETTER;
        } else if ("Legal".equals(pageSizeStr)) {
            return PDRectangle.LEGAL;
        } else {
            return PDRectangle.A4;
        }
    }
}