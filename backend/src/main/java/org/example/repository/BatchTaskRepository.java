package org.example.repository;

import org.example.entity.BatchTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BatchTaskRepository extends JpaRepository<BatchTask, Long> {
    Optional<BatchTask> findByTaskId(String taskId);
    List<BatchTask> findByUserIdAndStatus(Long userId, String status);
}