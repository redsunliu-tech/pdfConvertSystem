package org.example.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "pdf_tasks")
public class PdfTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;
    private String fileName;
    private String status;

    public PdfTask(){}

    public long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFileName() { return fileName;}
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getStatus() { return status; }
    public void setStatus(String status) {this.status = status; }


}
