export interface FileItem {
    id: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadTime: string;
    status: 'uploaded' | 'processing' | 'completed' | 'failed';
    fileUrl?: string;
    convertedUrl?: string;
}

export type NavItem = 'files' | 'history' | 'settings';

export type ConvertType = 
    | 'pdf_to_image'
    | 'pdf_to_office'
    | 'image_to_pdf'
    | 'office_to_pdf';

export interface ConvertOptions {
    imageType?: string;
    dpi?: number | string;
    jpgQuality?: number;

    pageSize?: string;
    orientation?: string;
    
    officeFormat?: 'docx' | 'xlsx' | 'pptx';
    
    embedFonts?: boolean;
}

export interface ConvertTask {
    taskId: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    resultFileUrl?: string;
    message?: string;
    createdAt: string;
}

export interface ConvertHistoryItem {
    taskId: number;
    sourceFileName: string;
    convertType: string;
    status: string;
    resultFileUrl?: string;
    message?: string;
    createdAt: string;
}

export interface BatchTaskResultItem {
    sourceFileName: string;
    status: 'completed' | 'failed' | 'processing';
    resultFileUrl?: string;
    errorMessage?: string;
}

export interface BatchTaskResult {
    taskId: string;
    taskType: string;
    status: 'completed' | 'failed' | 'processing';
    totalCount: number;
    successCount: number;
    failCount: number;
    taskResultFileUrl?: string;
    items?: BatchTaskResultItem[];
}