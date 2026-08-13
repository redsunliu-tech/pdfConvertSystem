package org.example.config;

import org.jodconverter.local.office.LocalOfficeManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

@Configuration
public class OfficeConfig {

    @Bean(destroyMethod = "stop")
    @Lazy
    public LocalOfficeManager localOfficeManager() {

        return LocalOfficeManager.builder()
                .officeHome("/Applications/LibreOffice.app/Contents")
                .maxTasksPerProcess(10)
                .processTimeout(120000L)
                .build();
    }
}