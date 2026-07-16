package org.example.service;

import org.example.dto.CaptchaResponse;

/**
 * 验证码服务接口
 */
public interface CaptchaService {

    /**
     * 生成验证码
     * @return 验证码响应（包含UUID和Base64图片）
     */
    CaptchaResponse generateCaptcha();

    /**
     * 验证验证码
     * @param uuid 验证码UUID
     * @param inputCode 用户输入的验证码
     * @return 是否验证通过
     */
    boolean validateCaptcha(String uuid, String inputCode);

    /**
     * 定时清理过期验证码
     */
    void cleanupExpiredCaptchas();
}