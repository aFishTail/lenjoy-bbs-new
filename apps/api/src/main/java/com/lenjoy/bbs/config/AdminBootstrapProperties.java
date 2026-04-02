package com.lenjoy.bbs.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "admin.bootstrap")
public class AdminBootstrapProperties {

    private boolean enabled;
    private String username;
    private String password;
    private String email;
}
