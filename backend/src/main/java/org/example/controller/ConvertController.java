package org.example.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.example.dto.BatchConvertRequest;
import org.example.dto.BatchConvertResponse;
import org.example.dto.ConvertRequest;
import org.example.dto.ConvertResponse;
import org.example.service.ConvertService;
import org.example.util.JwtUtil;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/convert")
public class ConvertController {

    private final ConvertService convertService;
    private final JwtUtil jwtUtil;

    public ConvertController(ConvertService convertService, JwtUtil jwtUtil) {
        this.convertService = convertService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/start")
    public ResponseEntity<Map<String, Object>> startConvert(
            @RequestBody ConvertRequest request,
            HttpServletRequest httpRequest) {
        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            ConvertResponse response = convertService.startConvert(userId, request);
            return buildSuccessResponse(response, "转换任务已创建");

        } catch (IllegalArgumentException e) {
            return buildErrorResponse(400, e.getMessage());
        } catch (Exception e) {
            return buildErrorResponse(500, "转换失败: " + e.getMessage());
        }
    }

    @GetMapping("/status/{taskId}")
    public ResponseEntity<Map<String, Object>> getConvertStatus(
            @PathVariable Long taskId,
            HttpServletRequest httpRequest) {
        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            ConvertResponse response = convertService.getConvertStatus(taskId);
            return buildSuccessResponse(response, "操作成功");

        } catch (Exception e) {
            return buildErrorResponse(500, "获取转换状态失败: " + e.getMessage());
        }
    }

    @GetMapping("/result/{taskId}")
    public ResponseEntity<Map<String, Object>> getConvertResult(
            @PathVariable Long taskId,
            HttpServletRequest httpRequest) {
        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            ConvertResponse response = convertService.getConvertResult(taskId);
            return buildSuccessResponse(response, "操作成功");

        } catch (Exception e) {
            return buildErrorResponse(500, "获取转换结果失败: " + e.getMessage());
        }
    }

    @GetMapping("/history")
    public ResponseEntity<Map<String, Object>> getConvertHistory(
            HttpServletRequest httpRequest) {
        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            java.util.List<ConvertResponse> history = convertService.getConvertHistory(userId);
            return buildSuccessResponse(history, "操作成功");

        } catch (Exception e) {
            return buildErrorResponse(500, "获取转换历史失败: " + e.getMessage());
        }
    }

    @PostMapping("/batch")
    public ResponseEntity<Map<String, Object>> startBatchConvert(
            @RequestBody BatchConvertRequest request,
            HttpServletRequest httpRequest) {
        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            BatchConvertResponse response = convertService.startBatchConvert(userId, request);
            return buildSuccessResponse(response, "批量任务已创建");

        } catch (IllegalArgumentException e) {
            return buildErrorResponse(400, e.getMessage());
        } catch (Exception e) {
            return buildErrorResponse(500, "批量任务创建失败: " + e.getMessage());
        }
    }

    @GetMapping("/batch/{taskId}")
    public ResponseEntity<Map<String, Object>> getBatchTaskStatus(
            @PathVariable String taskId,
            HttpServletRequest httpRequest) {
        try {
            Long userId = getUserIdFromRequest(httpRequest);
            if (userId == null) {
                return buildErrorResponse(401, "未登录，请先登录");
            }

            BatchConvertResponse response = convertService.getBatchTaskStatus(taskId);
            return buildSuccessResponse(response, "操作成功");

        } catch (Exception e) {
            return buildErrorResponse(500, "获取批量任务状态失败: " + e.getMessage());
        }
    }

    private Long getUserIdFromRequest(HttpServletRequest request) {
        String refreshToken = getRefreshTokenFromCookie(request);
        if (refreshToken == null || refreshToken.isEmpty()) {
            return null;
        }

        try {
            return jwtUtil.getUserIdFromToken(refreshToken);
        } catch (Exception e) {
            return null;
        }
    }

    private String getRefreshTokenFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("refresh_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private ResponseEntity<Map<String, Object>> buildSuccessResponse(Object data, String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", message);
        response.put("data", data);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> buildErrorResponse(int status, String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("message", message);
        response.put("data", null);
        return ResponseEntity.status(status).body(response);
    }
}