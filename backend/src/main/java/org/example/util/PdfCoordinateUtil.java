package org.example.util;

import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;

public class PdfCoordinateUtil {

    private PdfCoordinateUtil() {
    }

    public static float[] convertCanvasToPdfCoords(
            float canvasX, float canvasY,
            float canvasWidth, float canvasHeight,
            PDPage pdfPage) {

        PDRectangle mediaBox = pdfPage.getMediaBox();
        float pdfWidth = mediaBox.getWidth();
        float pdfHeight = mediaBox.getHeight();

        float pdfX = canvasX * (pdfWidth / canvasWidth);
        float pdfY = pdfHeight - (canvasY * (pdfHeight / canvasHeight));

        return new float[]{pdfX, pdfY};
    }

    public static float[] convertPdfToCanvasCoords(
            float pdfX, float pdfY,
            float canvasWidth, float canvasHeight,
            PDPage pdfPage) {

        PDRectangle mediaBox = pdfPage.getMediaBox();
        float pdfWidth = mediaBox.getWidth();
        float pdfHeight = mediaBox.getHeight();

        float canvasX = pdfX * (canvasWidth / pdfWidth);
        float canvasY = (pdfHeight - pdfY) * (canvasHeight / pdfHeight);

        return new float[]{canvasX, canvasY};
    }

    public static float convertCanvasWidthToPdf(
            float canvasWidth, float canvasTotalWidth, PDPage pdfPage) {

        PDRectangle mediaBox = pdfPage.getMediaBox();
        return canvasWidth * (mediaBox.getWidth() / canvasTotalWidth);
    }

    public static float convertCanvasHeightToPdf(
            float canvasHeight, float canvasTotalHeight, PDPage pdfPage) {

        PDRectangle mediaBox = pdfPage.getMediaBox();
        return canvasHeight * (mediaBox.getHeight() / canvasTotalHeight);
    }
}