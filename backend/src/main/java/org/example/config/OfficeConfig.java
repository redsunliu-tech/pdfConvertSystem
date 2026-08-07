package org.example.config;

import org.jodconverter.local.office.LocalOfficeManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;

@Configuration
public class OfficeConfig {

    @Bean(destroyMethod = "stop")
    @Lazy // 核心：第一次注入使用Bean时才初始化
    public LocalOfficeManager localOfficeManager() {

        return LocalOfficeManager.builder()
                .officeHome("/Applications/LibreOffice.app/Contents") // Mac路径
                .maxTasksPerProcess(10)
                .processTimeout(120000L)
                .build();
        // 移除manager.start()，调用转换工具时手动启动
    }
}