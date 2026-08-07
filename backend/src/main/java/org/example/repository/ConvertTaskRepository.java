package org.example.repository;

import org.example.entity.ConvertTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConvertTaskRepository extends JpaRepository<ConvertTask, Long> {
    List<ConvertTask> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<ConvertTask> findBySourceFileId(Long sourceFileId);
    
    /**
     * 查找源文件的最新转换任务（按创建时间降序，取第一条）
     */
    ConvertTask findTopBySourceFileIdOrderByCreatedAtDesc(Long sourceFileId);
}