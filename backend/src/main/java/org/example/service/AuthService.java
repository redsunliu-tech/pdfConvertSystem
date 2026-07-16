package org.example.service;

import org.example.dto.LoginRequest;
import org.example.dto.LoginResponse;
import org.example.dto.RegisterRequest;
import org.springframework.web.context.request.WebRequest;

import jakarta.servlet.http.HttpServletResponse;

/**
 * 用户认证服务接口
 */
public interface AuthService {

    /**
     * 用户注册
     * @param request 注册请求
     * @return 登录响应
     */
    LoginResponse register(RegisterRequest request);

    /**
     * 用户登录
     * @param request 登录请求
     * @param response HTTP响应（用于设置Cookie）
     * @return 登录响应
     */
    LoginResponse login(LoginRequest request, HttpServletResponse response);

    /**
     * 刷新Token
     * @param response HTTP响应（用于设置新Cookie）
     * @param request Web请求（用于获取Cookie）
     * @return 登录响应
     */
    LoginResponse refreshToken(HttpServletResponse response, WebRequest request);
}