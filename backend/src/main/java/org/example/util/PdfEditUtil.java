package org.example.util;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.example.dto.PdfEditRequest;
import org.springframework.core.io.ClassPathResource;

import java.awt.*;
import java.awt.geom.AffineTransform;
import java.io.*;
import java.util.Base64;
import java.util.List;

@Slf4j
public class PdfEditUtil {

    private static final String FONT_PATH = "fonts/NotoSerifCJKsc-VF.ttf";

    private PdfEditUtil() {
    }

    public static void rotatePage(File source, File target, int pageIndex, int angle) throws IOException {
        try (PDDocument document = PDDocument.load(source)) {
            PDPage page = document.getPage(pageIndex);
            page.setRotation((page.getRotation() + angle) % 360);
            document.save(target);
        }
    }

    public static void addTextWatermark(File source, File target, String text, float fontSize,
                                        float opacity, float rotation) throws IOException {
        try (PDDocument document = PDDocument.load(source)) {
            PDType0Font font = loadChineseFont(document);

            for (PDPage page : document.getPages()) {
                PDPageContentStream cs = new PDPageContentStream(document, page,
                        PDPageContentStream.AppendMode.APPEND, true, true);

                cs.setNonStrokingColor(0.7f, 0.7f, 0.7f);
                cs.beginText();
                cs.setFont(font, fontSize);

                PDRectangle mediaBox = page.getMediaBox();
                float pageWidth = mediaBox.getWidth();
                float pageHeight = mediaBox.getHeight();

                float textWidth = font.getStringWidth(text) / 1000 * fontSize;
                float xStep = textWidth + 100;
                float yStep = fontSize + 100;

                for (float x = -pageWidth; x < pageWidth * 2; x += xStep) {
                    for (float y = -pageHeight; y < pageHeight * 2; y += yStep) {
                        AffineTransform transform = AffineTransform.getTranslateInstance(x, y);
                        transform.rotate(Math.toRadians(rotation));
                        cs.setTextMatrix(transform);
                        cs.showText(text);
                    }
                }

                cs.endText();
                cs.close();
            }

            document.save(target);
        }
    }

    public static void addImageWatermark(File source, File target, String imageUrl,
                                         float opacity, float width, float height) throws IOException {
        try (PDDocument document = PDDocument.load(source)) {
            PDImageXObject pdImage = PDImageXObject.createFromFile(imageUrl, document);

            for (PDPage page : document.getPages()) {
                PDPageContentStream cs = new PDPageContentStream(document, page,
                        PDPageContentStream.AppendMode.APPEND, true, true);

                PDRectangle mediaBox = page.getMediaBox();
                float pageWidth = mediaBox.getWidth();
                float pageHeight = mediaBox.getHeight();

                float xStep = width + 50;
                float yStep = height + 50;

                for (float x = 0; x < pageWidth; x += xStep) {
                    for (float y = 0; y < pageHeight; y += yStep) {
                        cs.drawImage(pdImage, x, y, width, height);
                    }
                }

                cs.close();
            }

            document.save(target);
        }
    }

    public static void addAnnotation(File source, File target, List<PdfEditRequest.AnnotationRequest> annotations) throws IOException {
        try (PDDocument document = PDDocument.load(source)) {
            PDType0Font font = loadChineseFont(document);

            for (PdfEditRequest.AnnotationRequest annotation : annotations) {
                PDPage page = document.getPage(annotation.getPageIndex());
                PDPageContentStream cs = new PDPageContentStream(document, page,
                        PDPageContentStream.AppendMode.APPEND, true, true);

                switch (annotation.getType()) {
                    case "highlight":
                        addHighlight(cs, annotation);
                        break;
                    case "text":
                        addTextAnnotation(cs, annotation, font);
                        break;
                    case "signature":
                        addSignatureImage(document, cs, annotation);
                        break;
                    case "rectangle":
                        addRectangle(cs, annotation);
                        break;
                }

                cs.close();
            }

            document.save(target);
        }
    }

    private static void addHighlight(PDPageContentStream cs, PdfEditRequest.AnnotationRequest annotation) throws IOException {
        PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
        gs.setNonStrokingAlphaConstant(0.4f);
        cs.setGraphicsStateParameters(gs);
        cs.setNonStrokingColor(1.0f, 1.0f, 0.0f);
        cs.addRect(annotation.getX(), annotation.getY(), annotation.getWidth(), annotation.getHeight());
        cs.fill();
    }

    private static void addTextAnnotation(PDPageContentStream cs, PdfEditRequest.AnnotationRequest annotation,
                                          PDType0Font font) throws IOException {
        cs.setNonStrokingColor(0.0f, 0.0f, 0.0f);
        cs.beginText();
        cs.setFont(font, 12);
        cs.newLineAtOffset(annotation.getX(), annotation.getY());
        cs.showText(annotation.getContent());
        cs.endText();
    }

    private static void addSignatureImage(PDDocument document, PDPageContentStream cs,
                                          PdfEditRequest.AnnotationRequest annotation) throws IOException {
        String imageData = annotation.getImageData();
        if (imageData == null || imageData.isEmpty()) {
            return;
        }
        String base64Data = imageData;
        int commaIdx = imageData.indexOf(',');
        if (commaIdx >= 0) {
            base64Data = imageData.substring(commaIdx + 1);
        }
        byte[] imageBytes = Base64.getDecoder().decode(base64Data);
        PDImageXObject pdImage = PDImageXObject.createFromByteArray(document, imageBytes, "signature");
        cs.drawImage(pdImage, annotation.getX(), annotation.getY(),
                annotation.getWidth(), annotation.getHeight());
    }

    private static void addRectangle(PDPageContentStream cs, PdfEditRequest.AnnotationRequest annotation) throws IOException {
        Color color = Color.decode(annotation.getColor() != null ? annotation.getColor() : "#000000");
        cs.setStrokingColor(color.getRed() / 255f, color.getGreen() / 255f, color.getBlue() / 255f);
        cs.setLineWidth(2);
        cs.addRect(annotation.getX(), annotation.getY(), annotation.getWidth(), annotation.getHeight());
        cs.stroke();
    }

    public static void deletePages(File source, File target, List<Integer> pagesToDelete) throws IOException {
        try (PDDocument document = PDDocument.load(source)) {
            pagesToDelete.sort((a, b) -> b - a);
            for (int pageIndex : pagesToDelete) {
                document.removePage(pageIndex);
            }
            document.save(target);
        }
    }

    public static void reorderPages(File source, File target, List<Integer> newOrder) throws IOException {
        try (PDDocument sourceDoc = PDDocument.load(source);
             PDDocument targetDoc = new PDDocument()) {

            for (int pageIndex : newOrder) {
                targetDoc.addPage(sourceDoc.getPage(pageIndex));
            }

            targetDoc.save(target);
        }
    }

    private static PDType0Font loadChineseFont(PDDocument document) throws IOException {
        ClassPathResource resource = new ClassPathResource(FONT_PATH);
        try (InputStream is = resource.getInputStream()) {
            return PDType0Font.load(document, is);
        }
    }
}