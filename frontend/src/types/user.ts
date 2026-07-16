export interface User {
    id: number;
    username: string;
    email: string;
}

export interface LoginRequest {
    username: string;
    password: string;
    captcha: string;
    captchaUuid: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    email: string;
}

export interface LoginResponse {
    id: number;
    username: string;
    email: string;
    message: string;
}

export interface CaptchaResponse {
    uuid: string;
    image: string;
}