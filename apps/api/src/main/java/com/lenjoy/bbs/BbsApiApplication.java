package com.lenjoy.bbs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BbsApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(BbsApiApplication.class, args);
    }
}
