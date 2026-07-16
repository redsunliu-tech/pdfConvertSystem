package org.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CaptchaResponse {
    private String uuid;      // 验证码唯一标识
    private String image;     // Base64编码的验证码图片
}