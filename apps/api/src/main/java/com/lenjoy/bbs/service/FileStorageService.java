package com.lenjoy.bbs.service;

import com.lenjoy.bbs.config.MinioProperties;
import com.lenjoy.bbs.exception.ApiException;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.SetBucketPolicyArgs;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class FileStorageService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif");

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    public String uploadImage(MultipartFile file) {
        validateFile(file);
        ensureBucketIsPubliclyReadable();

        String extension = resolveExtension(file.getOriginalFilename(), file.getContentType());
        String objectKey = "posts/" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE)
                + "/" + UUID.randomUUID() + "." + extension;

        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectKey)
                    .stream(inputStream, file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());
        } catch (IOException ex) {
            throw new ApiException("UPLOAD_FAILED", "读取上传文件失败", HttpStatus.BAD_REQUEST);
        } catch (Exception ex) {
            throw new ApiException("UPLOAD_FAILED", "图片上传失败", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return buildPublicUrl(objectKey);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException("FILE_REQUIRED", "请选择要上传的图片", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > minioProperties.getMaxFileSizeBytes()) {
            throw new ApiException("FILE_TOO_LARGE", "图片大小超出限制", HttpStatus.BAD_REQUEST);
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new ApiException("FILE_TYPE_INVALID", "仅支持 jpg/png/webp/gif 图片", HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureBucketIsPubliclyReadable() {
        try {
            boolean exists = minioClient.bucketExists(BucketExistsArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder()
                        .bucket(minioProperties.getBucket())
                        .build());
            }
            minioClient.setBucketPolicy(SetBucketPolicyArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .config(buildAnonymousReadPolicy())
                    .build());
        } catch (Exception ex) {
            throw new ApiException("STORAGE_UNAVAILABLE", "存储服务不可用", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String buildAnonymousReadPolicy() {
        return """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {
                        "AWS": [
                          "*"
                        ]
                      },
                      "Action": [
                        "s3:GetObject"
                      ],
                      "Resource": [
                        "arn:aws:s3:::%s/*"
                      ]
                    }
                  ]
                }
                """.formatted(minioProperties.getBucket());
    }

    private String resolveExtension(String originalFilename, String contentType) {
        if (originalFilename != null && originalFilename.contains(".")) {
            String extension = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
            if (!extension.isBlank()) {
                return extension;
            }
        }
        if ("image/png".equalsIgnoreCase(contentType)) {
            return "png";
        }
        if ("image/webp".equalsIgnoreCase(contentType)) {
            return "webp";
        }
        if ("image/gif".equalsIgnoreCase(contentType)) {
            return "gif";
        }
        return "jpg";
    }

    private String buildPublicUrl(String objectKey) {
        String base = minioProperties.getPublicBaseUrl();
        if (base.endsWith("/")) {
            return base + objectKey;
        }
        return base + "/" + objectKey;
    }
}
