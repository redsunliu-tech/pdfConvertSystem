package org.example.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 修改邮箱请求 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangeEmailRequest {

    /**
     * 当前密码（用于验证身份）
     */
    private String password;

    /**
     * 新邮箱地址
     */
    private String newEmail;
}