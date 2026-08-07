package org.example.repository;

import org.example.entity.BatchTaskItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BatchTaskItemRepository extends JpaRepository<BatchTaskItem, Long> {
    List<BatchTaskItem> findByBatchTaskIdOrderBySortOrder(Long batchTaskId);
}