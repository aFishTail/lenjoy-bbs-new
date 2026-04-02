package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.config.MinioProperties;
import io.minio.MinioClient;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class FileStorageServiceTest {

    @Mock
    private MinioClient minioClient;

    private MinioProperties minioProperties;

    private FileStorageService fileStorageService;

    @BeforeEach
    void setUp() {
        minioProperties = new MinioProperties();
        minioProperties.setBucket("lenjoy-bbs");
        minioProperties.setPublicBaseUrl("http://localhost:9000/lenjoy-bbs");
        minioProperties.setMaxFileSizeBytes(5 * 1024 * 1024);
        fileStorageService = new FileStorageService(minioClient, minioProperties);
    }

    @Test
    void uploadImage_whenBucketMissing_shouldCreateBucketApplyPublicPolicyAndReturnUrl() throws Exception {
        when(minioClient.bucketExists(any())).thenReturn(false);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "demo.png",
                "image/png",
                "png".getBytes(StandardCharsets.UTF_8));

        String imageUrl = fileStorageService.uploadImage(file);

        assertTrue(imageUrl.startsWith("http://localhost:9000/lenjoy-bbs/posts/"
                + java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE) + "/"));
        assertTrue(imageUrl.endsWith(".png"));
        verify(minioClient).makeBucket(any());
        verify(minioClient).setBucketPolicy(any());
        verify(minioClient).putObject(any());
    }

    @Test
    void uploadImage_whenBucketExists_shouldStillApplyPublicPolicy() throws Exception {
        when(minioClient.bucketExists(any())).thenReturn(true);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "demo.jpg",
                "image/jpeg",
                "jpg".getBytes(StandardCharsets.UTF_8));

        fileStorageService.uploadImage(file);

        verify(minioClient, never()).makeBucket(any());
        verify(minioClient).setBucketPolicy(any());
        verify(minioClient).putObject(any());
    }
}
