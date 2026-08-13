package org.example.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.InputStream;

@Configuration
public class SpaFallbackConfig {

    private static final Resource INDEX_HTML = new ClassPathResource("/static/index.html");

    @Bean
    public FilterRegistrationBean<Filter> spaFallbackFilter() {
        FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new Filter() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                    throws IOException, ServletException {
                HttpServletRequest httpRequest = (HttpServletRequest) request;
                HttpServletResponse httpResponse = (HttpServletResponse) response;

                String path = httpRequest.getRequestURI();
                String contextPath = httpRequest.getContextPath();
                if (contextPath != null && !contextPath.isEmpty()) {
                    path = path.substring(contextPath.length());
                }

                // API 请求放行
                if (path.startsWith("/api/") || path.equals("/api")) {
                    chain.doFilter(request, response);
                    return;
                }

                // 带扩展名的静态资源放行（由 Spring Boot 默认 handler 处理）
                if (hasFileExtension(path)) {
                    chain.doFilter(request, response);
                    return;
                }

                // 非 API、非静态资源路径 -> SPA 回退
                httpResponse.setContentType("text/html;charset=UTF-8");
                httpResponse.setCharacterEncoding("UTF-8");
                try (InputStream is = INDEX_HTML.getInputStream()) {
                    httpResponse.getOutputStream().write(is.readAllBytes());
                }
            }

            private boolean hasFileExtension(String path) {
                int lastDot = path.lastIndexOf('.');
                if (lastDot == -1) return false;
                int lastSlash = path.lastIndexOf('/');
                return lastDot > lastSlash;
            }
        });

        // 设置最高优先级但在 Spring Boot 内置静态资源 Filter 之后
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 100);
        registration.addUrlPatterns("/*");
        registration.setName("spaFallbackFilter");
        return registration;
    }
}