package org.example;
/*import org.example.repository.PdfTaskRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;*/

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

//TIP 要<b>运行</b>代码，请按 <shortcut actionId="Run"/> 或
// 点击装订区域中的 <icon src="AllIcons.Actions.Execute"/> 图标。
@SpringBootApplication(exclude = {SecurityAutoConfiguration.class})
@EnableScheduling  // 启用定时任务（清理过期验证码）
public class Main {
    public static void main(String[] args) {
        //TIP 当文本光标位于高亮显示的文本处时按 <shortcut actionId="ShowIntentionActions"/>
        // 查看 IntelliJ IDEA 建议如何修正。
        System.out.println("Hello and welcome!");
        SpringApplication.run(Main.class,args);
    }

    // 3. 这个方法会在 Spring Boot 启动完成后自动执行，用来测试数据库
/*    @Bean
    CommandLineRunner testDatabase(PdfTaskRepository repository) {
        return args -> {
            // 创建一个新的 PDF 任务对象
            PdfTask task = new PdfTask();
            task.setFileName("测试文档1.pdf");
            task.setStatus("processing");

            // 调用 Repository 自动生成的保存方法
            repository.save(task);

            // 打印到控制台，证明存成功了
            System.out.println("✅ 数据库测试成功！已保存任务：" + task);
        };
    }*/
}