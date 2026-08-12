package org.example.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.example.dto.PdfEditRequest;
import org.example.dto.PdfEditResponse;
import org.example.service.PdfEditService;
import org.example.util.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pdf")
@Slf4j
public class PdfEditController {

    private final PdfEditService pdfEditService;
    private final JwtUtil jwtUtil;

    public PdfEditController(PdfEditService pdfEditService, JwtUtil jwtUtil) {
        this.pdfEditService = pdfEditService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/edit")
    public ResponseEntity<Map<String, Object>> applyEdits(
            @RequestBody PdfEditRequest request,
            HttpServletRequest httpRequest) {

        Long userId = getUserIdFromToken(httpRequest);
        if (userId == null) {
            return buildErrorResponse("未登录", HttpStatus.UNAUTHORIZED);
        }

        try {
            PdfEditResponse response = pdfEditService.applyEdits(request);
            return buildSuccessResponse(response);
        } catch (IOException e) {
            log.error("PDF编辑失败", e);
            return buildErrorResponse("PDF编辑失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/pages/rotate")
    public ResponseEntity<Map<String, Object>> rotatePage(
            @RequestParam Long pdfTaskId,
            @RequestParam int pageIndex,
            @RequestParam int angle,
            HttpServletRequest httpRequest) {

        Long userId = getUserIdFromToken(httpRequest);
        if (userId == null) {
            return buildErrorResponse("未登录", HttpStatus.UNAUTHORIZED);
        }

        try {
            PdfEditRequest request = new PdfEditRequest();
            request.setPdfTaskId(pdfTaskId);

            PdfEditRequest.PageOperationRequest op = new PdfEditRequest.PageOperationRequest();
            op.setOperation("rotate");
            op.setPageIndex(pageIndex);
            op.setAngle(angle);
            request.setPageOperations(List.of(op));

            PdfEditResponse response = pdfEditService.applyEdits(request);
            return buildSuccessResponse(response);
        } catch (IOException e) {
            log.error("页面旋转失败", e);
            return buildErrorResponse("页面旋转失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/pages/delete")
    public ResponseEntity<Map<String, Object>> deletePages(
            @RequestParam Long pdfTaskId,
            @RequestBody List<Integer> pageIndices,
            HttpServletRequest httpRequest) {

        Long userId = getUserIdFromToken(httpRequest);
        if (userId == null) {
            return buildErrorResponse("未登录", HttpStatus.UNAUTHORIZED);
        }

        try {
            PdfEditRequest request = new PdfEditRequest();
            request.setPdfTaskId(pdfTaskId);

            PdfEditRequest.PageOperationRequest op = new PdfEditRequest.PageOperationRequest();
            op.setOperation("delete");
            op.setPageIndices(pageIndices);
            request.setPageOperations(List.of(op));

            PdfEditResponse response = pdfEditService.applyEdits(request);
            return buildSuccessResponse(response);
        } catch (IOException e) {
            log.error("页面删除失败", e);
            return buildErrorResponse("页面删除失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/watermark")
    public ResponseEntity<Map<String, Object>> addWatermark(
            @RequestParam Long pdfTaskId,
            @RequestBody PdfEditRequest.WatermarkRequest watermark,
            HttpServletRequest httpRequest) {

        Long userId = getUserIdFromToken(httpRequest);
        if (userId == null) {
            return buildErrorResponse("未登录", HttpStatus.UNAUTHORIZED);
        }

        try {
            PdfEditRequest request = new PdfEditRequest();
            request.setPdfTaskId(pdfTaskId);
            request.setWatermark(watermark);

            PdfEditResponse response = pdfEditService.applyEdits(request);
            return buildSuccessResponse(response);
        } catch (IOException e) {
            log.error("水印添加失败", e);
            return buildErrorResponse("水印添加失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private Long getUserIdFromToken(HttpServletRequest request) {
        String refreshToken = getRefreshTokenFromCookie(request);
        if (refreshToken == null || refreshToken.isEmpty()) {
            return null;
        }

        try {
            if (!jwtUtil.isTokenExpired(refreshToken)) {
                return jwtUtil.getUserIdFromToken(refreshToken);
            }
        } catch (Exception e) {
            log.warn("Token验证失败", e);
        }
        return null;
    }

    private String getRefreshTokenFromCookie(HttpServletRequest request) {
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if ("refresh_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private ResponseEntity<Map<String, Object>> buildSuccessResponse(Object data) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", data);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> buildErrorResponse(String message, HttpStatus status) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", message);
        return ResponseEntity.status(status).body(response);
    }
}