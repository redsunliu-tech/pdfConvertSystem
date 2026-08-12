package org.example.util;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Random;

public final class FileNameUtil {

    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final Random RANDOM = new Random();

    private FileNameUtil() {
    }

    public static String generateSuffix() {
        String timestamp = new SimpleDateFormat("yyyyMMdd-HHmmss").format(new Date());
        String randomPart = generateRandomPart(4);
        return timestamp + "-" + randomPart;
    }

    public static String generateTimestamp() {
        return new SimpleDateFormat("yyyyMMdd-HHmmss").format(new Date());
    }

    private static String generateRandomPart(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }
}