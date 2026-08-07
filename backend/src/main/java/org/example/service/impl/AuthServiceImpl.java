package org.example.service.impl;

import org.example.config.CookieConfig;
import org.example.dto.LoginRequest;
import org.example.dto.LoginResponse;
import org.example.dto.RegisterRequest;
import org.example.dto.UserProfileResponse;
import org.example.dto.ChangeEmailRequest;
import org.example.dto.ChangePasswordRequest;
import org.example.entity.User;
import org.example.repository.UserRepository;
import org.example.service.AuthService;
import org.example.service.CaptchaService;
import org.example.util.JwtUtil;
import org.springframework.http.ResponseCookie;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.WebRequest;

import jakarta.servlet.http.HttpServletResponse;

/**
 * 用户认证服务实现类
 */
@Service
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final CaptchaService captchaService;
    private final CookieConfig cookieConfig;

    public AuthServiceImpl(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JwtUtil jwtUtil,
                           CaptchaService captchaService,
                           CookieConfig cookieConfig) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.captchaService = captchaService;
        this.cookieConfig = cookieConfig;
    }

    @Override
    public LoginResponse register(RegisterRequest request) {
        // 检查用户名是否已存在
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }

        // 检查邮箱是否已注册
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("邮箱已被注册");
        }

        // 创建用户
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setEmail(request.getEmail());

        User savedUser = userRepository.save(user);

        return new LoginResponse(
                savedUser.getId(),
                savedUser.getUsername(),
                savedUser.getEmail(),
                "注册成功"
        );
    }

    @Override
    public LoginResponse login(LoginRequest request, HttpServletResponse response) {
        // 1. 验证验证码
        if (!captchaService.validateCaptcha(request.getCaptchaUuid(), request.getCaptcha())) {
            throw new RuntimeException("验证码错误或已过期");
        }

        // 2. 查找用户
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new RuntimeException("用户名或密码错误"));

        // 3. 验证密码
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("用户名或密码错误");
        }

        // 4. 生成Token
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername());
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getUsername());

        // 5. 设置HttpOnly Cookie
        setCookie(response, "access_token", accessToken, cookieConfig.getAccessTokenMaxAge());   // 1小时
        setCookie(response, "refresh_token", refreshToken, cookieConfig.getRefreshTokenMaxAge()); // 7天

        return new LoginResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                "登录成功"
        );
    }

    @Override
    public LoginResponse refreshToken(HttpServletResponse response, WebRequest request) {
        // 从Cookie中获取Refresh Token
        String refreshToken = request.getHeader("Cookie") != null ?
                extractCookie(request.getHeader("Cookie"), "refresh_token") : null;

        if (refreshToken == null) {
            throw new RuntimeException("Refresh Token不存在");
        }

        try {
            // 验证Refresh Token
            if (jwtUtil.isTokenExpired(refreshToken)) {
                throw new RuntimeException("Refresh Token已过期");
            }

            String tokenType = jwtUtil.getTokenType(refreshToken);
            if (!"refresh".equals(tokenType)) {
                throw new RuntimeException("无效的Token类型");
            }

            // 获取用户信息
            Long userId = jwtUtil.getUserIdFromToken(refreshToken);
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("用户不存在"));

            // 生成新的Token
            String newAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getUsername());
            String newRefreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getUsername());

            // 设置新Cookie
            setCookie(response, "access_token", newAccessToken, cookieConfig.getAccessTokenMaxAge());
            setCookie(response, "refresh_token", newRefreshToken, cookieConfig.getRefreshTokenMaxAge());

            return new LoginResponse(
                    user.getId(),
                    user.getUsername(),
                    user.getEmail(),
                    "Token刷新成功"
            );

        } catch (Exception e) {
            throw new RuntimeException("Token刷新失败: " + e.getMessage());
        }
    }



    @Override
    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    @Override
    public String changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        // 验证当前密码
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new RuntimeException("当前密码不正确");
        }

        // 更新密码
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        return "密码修改成功";
    }

    @Override
    public String changeEmail(Long userId, ChangeEmailRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        // 验证密码
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("密码不正确");
        }

        // 检查新邮箱是否已被使用
        if (userRepository.existsByEmail(request.getNewEmail())) {
            throw new RuntimeException("该邮箱已被注册");
        }

        // 更新邮箱
        user.setEmail(request.getNewEmail());
        userRepository.save(user);

        return "邮箱修改成功";
    }

    /**
     * 设置Cookie
     */
    private void setCookie(HttpServletResponse response, String name, String value, int maxAge) {
        ResponseCookie cookie = ResponseCookie.from(name, value)
                .httpOnly(cookieConfig.isHttpOnly())           // 关键：JS不可访问
                .secure(cookieConfig.isSecure())             // 仅HTTPS
                .sameSite(cookieConfig.getSameSite())       // 防CSRF
                .maxAge(maxAge)           // 过期时间（秒）
                .path(cookieConfig.getPath())                // 全站有效
                .build();

        response.addHeader("Set-Cookie", cookie.toString());
    }

    /**
     * 从Cookie字符串中提取指定Cookie值
     */
    private String extractCookie(String cookieHeader, String cookieName) {
        String[] cookies = cookieHeader.split(";");
        for (String cookie : cookies) {
            String[] parts = cookie.trim().split("=");
            if (parts.length == 2 && parts[0].equals(cookieName)) {
                return parts[1];
            }
        }
        return null;
    }
}