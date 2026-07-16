package org.example.service.impl;

import com.google.code.kaptcha.Producer;
import com.google.code.kaptcha.util.Config;
import org.example.dto.CaptchaResponse;
import org.example.entity.Captcha;
import org.example.repository.CaptchaRepository;
import org.example.service.CaptchaService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.UUID;

/**
 * 验证码服务实现类
 */
@Service
public class CaptchaServiceImpl implements CaptchaService {

    private final CaptchaRepository captchaRepository;
    private final Producer captchaProducer;

    public CaptchaServiceImpl(CaptchaRepository captchaRepository, Producer captchaProducer) {
        this.captchaRepository = captchaRepository;
        this.captchaProducer = captchaProducer;
    }

    @Override
    public CaptchaResponse generateCaptcha() {
        // 生成验证码文本
        String code = captchaProducer.createText();

        // 生成验证码图片
        BufferedImage image = captchaProducer.createImage(code);

        // 转换为Base64
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, "png", outputStream);
        } catch (Exception e) {
            throw new RuntimeException("生成验证码图片失败", e);
        }
        String base64Image = Base64.getEncoder().encodeToString(outputStream.toByteArray());

        // 生成UUID
        String uuid = UUID.randomUUID().toString();

        // 保存到数据库（有效期5分钟）
        Captcha captcha = new Captcha();
        captcha.setUuid(uuid);
        captcha.setCode(code);
        captcha.setExpireTime(LocalDateTime.now().plusMinutes(5));
        captchaRepository.save(captcha);

        return new CaptchaResponse(uuid, "data:image/png;base64," + base64Image);
    }

    @Override
    public boolean validateCaptcha(String uuid, String inputCode) {
        // 查找验证码
        return captchaRepository.findByUuid(uuid)
                .map(captcha -> {
                    // 检查是否过期
                    if (captcha.getExpireTime().isBefore(LocalDateTime.now())) {
                        // 删除过期验证码
                        captchaRepository.delete(captcha);
                        return false;
                    }
                    // 验证验证码（不区分大小写）
                    boolean isValid = captcha.getCode().equalsIgnoreCase(inputCode);
                    // 验证后立即删除（防止重复使用）
                    captchaRepository.delete(captcha);
                    return isValid;
                })
                .orElse(false);
    }

    @Override
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupExpiredCaptchas() {
        captchaRepository.deleteExpired(LocalDateTime.now());
    }
}