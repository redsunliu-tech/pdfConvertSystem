package org.example.dto;

import lombok.Data;

@Data
public class LoginRequest {
    private String username;
    private String password;
    private String captcha;      // 用户输入的验证码
    private String captchaUuid;  // 验证码UUID
}