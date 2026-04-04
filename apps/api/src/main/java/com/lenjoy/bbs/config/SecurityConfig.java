package com.lenjoy.bbs.config;

import com.lenjoy.bbs.logging.RequestTraceFilter;
import com.lenjoy.bbs.security.ApiAccessDeniedHandler;
import com.lenjoy.bbs.security.ApiAuthenticationEntryPoint;
import com.lenjoy.bbs.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final RequestTraceFilter requestTraceFilter;
        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final ApiAuthenticationEntryPoint apiAuthenticationEntryPoint;
        private final ApiAccessDeniedHandler apiAccessDeniedHandler;

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .csrf(csrf -> csrf.disable())
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .exceptionHandling(exception -> exception
                                                .authenticationEntryPoint(apiAuthenticationEntryPoint)
                                                .accessDeniedHandler(apiAccessDeniedHandler))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers("/actuator/health", "/api/v1/health",
                                                                "/v3/api-docs/**", "/swagger-ui/**",
                                                                "/swagger-ui.html", "/api/v1/auth/**",
                                                                "/api/open/v1/**")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/v1/posts", "/api/v1/posts/*",
                                                                "/api/v1/taxonomy/**")
                                                .permitAll()
                                                .anyRequest().authenticated())
                                .addFilterBefore(requestTraceFilter, UsernamePasswordAuthenticationFilter.class)
                                .addFilterAfter(jwtAuthenticationFilter, RequestTraceFilter.class);
                return http.build();
        }
}
