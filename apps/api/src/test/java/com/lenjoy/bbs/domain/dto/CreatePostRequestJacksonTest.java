package com.lenjoy.bbs.domain.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

class CreatePostRequestJacksonTest {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void shouldDeserializeNormalPostByPostType() throws Exception {
        String json = """
                {
                  "postType": "NORMAL",
                  "title": "Hello",
                  "categoryId": 1,
                  "content": "Body"
                }
                """;

        CreatePostRequest request = objectMapper.readValue(json, CreatePostRequest.class);

        assertInstanceOf(CreateNormalPostRequest.class, request);
        assertEquals("Hello", request.getTitle());
        assertEquals("Body", request.getContent());
    }

    @Test
    void shouldDeserializeResourcePostByPostType() throws Exception {
        String json = """
                {
                  "postType": "RESOURCE",
                  "title": "Checklist",
                  "categoryId": 2,
                  "content": "Preview",
                  "hiddenContent": "Download link",
                  "price": 99
                }
                """;

        CreatePostRequest request = objectMapper.readValue(json, CreatePostRequest.class);

        assertInstanceOf(CreateResourcePostRequest.class, request);
        assertEquals("Download link", request.getHiddenContent());
        assertEquals(99, request.getPrice());
    }

    @Test
    void shouldDeserializeOpenApiPostWithoutPolymorphicSubtypeResolution() throws Exception {
        String json = """
                {
                  "authorBindingCode": "partner_user_1",
                  "postType": "NORMAL",
                  "title": "Hello",
                  "categoryId": 1,
                  "content": "Body"
                }
                """;

        CreateOpenApiPostRequest request = objectMapper.readValue(json, CreateOpenApiPostRequest.class);

        assertEquals("partner_user_1", request.getAuthorBindingCode());
        assertEquals("Hello", request.getTitle());
        assertEquals("Body", request.getContent());
    }
}
