package com.lenjoy.bbs.service;

import com.lenjoy.bbs.domain.dto.CaptchaMetadataResponse;
import com.lenjoy.bbs.exception.ApiException;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class CaptchaService {

    private static final String CAPTCHA_KEY_PREFIX = "auth:captcha:";
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final StringRedisTemplate redisTemplate;
    private final SecureRandom secureRandom = new SecureRandom();
    private final int ttlSeconds;
    private final int length;

    public CaptchaService(
            StringRedisTemplate redisTemplate,
            @Value("${auth.captcha.ttl-seconds}") int ttlSeconds,
            @Value("${auth.captcha.length}") int length) {
        this.redisTemplate = redisTemplate;
        this.ttlSeconds = ttlSeconds;
        this.length = length;
    }

    public CaptchaMetadataResponse createCaptcha(String basePath) {
        String captchaId = UUID.randomUUID().toString().replace("-", "");
        String code = randomCode(length);
        redisTemplate.opsForValue().set(key(captchaId), code.toLowerCase(Locale.ROOT), ttlSeconds,
                java.util.concurrent.TimeUnit.SECONDS);
        String imageUrl = basePath + "/api/v1/auth/captcha/" + captchaId + "/image";
        long expireAt = Instant.now().plusSeconds(ttlSeconds).toEpochMilli();
        return new CaptchaMetadataResponse(captchaId, imageUrl, expireAt);
    }

    public byte[] getCaptchaImage(String captchaId) {
        String code = redisTemplate.opsForValue().get(key(captchaId));
        if (code == null) {
            throw new ApiException("CAPTCHA_EXPIRED", "验证码已过期", HttpStatus.BAD_REQUEST);
        }
        return renderPng(code);
    }

    public void verifyAndConsume(String captchaId, String captchaCode) {
        String key = key(captchaId);
        String expected = redisTemplate.opsForValue().get(key);
        if (expected == null) {
            throw new ApiException("CAPTCHA_EXPIRED", "验证码已过期", HttpStatus.BAD_REQUEST);
        }
        if (!expected.equals(captchaCode.toLowerCase(Locale.ROOT))) {
            throw new ApiException("CAPTCHA_INVALID", "验证码错误", HttpStatus.BAD_REQUEST);
        }
        redisTemplate.delete(key);
    }

    private String randomCode(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(CHARS.charAt(secureRandom.nextInt(CHARS.length())));
        }
        return sb.toString();
    }

    private byte[] renderPng(String code) {
        int width = 130;
        int height = 44;
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);
        g.setFont(new Font("SansSerif", Font.BOLD, 28));
        g.setColor(new Color(40, 40, 40));
        g.drawString(code.toUpperCase(Locale.ROOT), 20, 32);
        for (int i = 0; i < 7; i++) {
            g.setColor(new Color(120 + secureRandom.nextInt(80), 120 + secureRandom.nextInt(80),
                    120 + secureRandom.nextInt(80)));
            g.drawLine(secureRandom.nextInt(width), secureRandom.nextInt(height), secureRandom.nextInt(width),
                    secureRandom.nextInt(height));
        }
        g.dispose();

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", baos);
            return baos.toByteArray();
        } catch (IOException ex) {
            throw new ApiException("CAPTCHA_RENDER_FAILED", "验证码生成失败", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String key(String captchaId) {
        return CAPTCHA_KEY_PREFIX + captchaId;
    }
}