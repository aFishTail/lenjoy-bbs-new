package com.lenjoy.bbs.logging;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.lenjoy.bbs.security.AuthUserPrincipal;
import jakarta.servlet.FilterChain;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class RequestTraceFilterTest {

    private final RequestTraceFilter filter = new RequestTraceFilter();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void shouldAttachTraceIdHeaderAndClearMdcAfterRequest() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = (req, res) -> {
            var principal = new AuthUserPrincipal(7L, "alice", List.of());
            var authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(authentication);
            assertNotNull(MDC.get(RequestTraceFilter.TRACE_ID_KEY));
        };

        filter.doFilter(request, response, filterChain);

        String traceId = response.getHeader(RequestTraceFilter.TRACE_ID_HEADER);
        assertNotNull(traceId);
        assertFalse(traceId.isBlank());
        assertNull(MDC.get(RequestTraceFilter.TRACE_ID_KEY));
        assertNull(MDC.get(RequestTraceFilter.USER_ID_KEY));
    }

    @Test
    void shouldReuseIncomingTraceIdHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/posts");
        request.addHeader(RequestTraceFilter.TRACE_ID_HEADER, "trace-123");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
        });

        assertTrue("trace-123".equals(response.getHeader(RequestTraceFilter.TRACE_ID_HEADER)));
    }
}
