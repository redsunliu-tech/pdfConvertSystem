package org.example.repository;

import org.example.entity.Captcha;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.Optional;

public interface CaptchaRepository extends JpaRepository<Captcha, String> {
    Optional<Captcha> findByUuid(String uuid);

    @Modifying
    @Query("DELETE FROM Captcha c WHERE c.expireTime < :now")
    void deleteExpired(@Param("now") LocalDateTime now);
}