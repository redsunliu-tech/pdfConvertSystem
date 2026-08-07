package org.example.repository;

import org.example.entity.PdfTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PdfTaskRepository extends JpaRepository<PdfTask, Long> {

    /**
     * 根据用户ID查找文件，按上传时间降序排列
     */
    List<PdfTask> findByUserIdOrderByUploadTimeDesc(Long userId);
}