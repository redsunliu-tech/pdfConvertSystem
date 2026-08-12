package org.example.service;

import org.example.dto.PdfEditRequest;
import org.example.dto.PdfEditResponse;

import java.io.IOException;

public interface PdfEditService {

    PdfEditResponse applyEdits(PdfEditRequest request) throws IOException;
}