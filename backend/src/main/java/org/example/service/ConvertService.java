package org.example.service;

import org.example.dto.BatchConvertRequest;
import org.example.dto.BatchConvertResponse;
import org.example.dto.ConvertRequest;
import org.example.dto.ConvertResponse;

public interface ConvertService {
    ConvertResponse startConvert(Long userId, ConvertRequest request);
    ConvertResponse getConvertStatus(Long taskId);
    ConvertResponse getConvertResult(Long taskId);
    java.util.List<ConvertResponse> getConvertHistory(Long userId);
    
    BatchConvertResponse startBatchConvert(Long userId, BatchConvertRequest request);
    BatchConvertResponse getBatchTaskStatus(String taskId);
}