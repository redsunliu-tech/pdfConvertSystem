package org.example.repository;

import org.example.entity.PdfTask;
import org.springframework.data.jpa.repository.JpaRepository;

// 继承 JpaRepository 后，Spring Boot 会自动帮你实现保存、查询等功能
public interface PdfTaskRepository extends JpaRepository<PdfTask, Long> {
}