package org.example.util;
import io.jsonwebtoken.Jwts.SIG;
import java.util.Base64;

public final class GenerateKey {

    public static String getKey() {
        //1：让库自动为你生成符合 HS256 要求的 256 位安全密钥；SIG.HS256.key().build();
        //2：将生成的二进制密钥转为 Base64 字符串，方便存入配置文件
        return Base64.getEncoder().encodeToString((SIG.HS256.key().build()).getEncoded());
    }

    public static void main(String[] args) {
        // 调用刚才写好的方法，生成密钥并打印到控制台
        System.out.println("🎉 生成的 JWT 安全密钥 (Base64格式): ");
        System.out.println(getKey());
    }
}
