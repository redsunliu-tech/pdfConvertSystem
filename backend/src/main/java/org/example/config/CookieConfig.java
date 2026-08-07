package org.example.config;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Cookie 配置属性类
 * 用于管理 Cookie 的各种配置参数，实现配置与代码分离
 */
@Data
@NoArgsConstructor
@Configuration
@ConfigurationProperties(prefix = "app.cookie")
public class CookieConfig {

    /**
     * 是否启用 HttpOnly（JS不可访问，提升安全性）
     */
    private boolean httpOnly = true;

    /**
     * 是否启用 Secure（仅 HTTPS 传输）
     * 开发环境：false，生产环境：true
     */
    private boolean secure = false;

    /**
     * SameSite 属性（Strict/Lax/None），用于防 CSRF 攻击
     */
    private String sameSite = "Lax";

    /**
     * Cookie 路径，"/" 表示全站有效
     */
    private String path = "/";

    /**
     * Access Token 的最大存活时间（秒），默认 1 小时
     */
    private int accessTokenMaxAge = 3600;

    /**
     * Refresh Token 的最大存活时间（秒），默认 7 天
     */
    private int refreshTokenMaxAge = 604800;
}