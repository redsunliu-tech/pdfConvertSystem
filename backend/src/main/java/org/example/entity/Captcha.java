package org.example.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "captchas")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Captcha {

    @Id
    @Column(length = 36)
    private String uuid;  // 唯一标识

    @Column(nullable = false, length = 6)
    private String code;  // 验证码

    @Column(name = "expire_time", nullable = false)
    private LocalDateTime expireTime;  // 过期时间

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}