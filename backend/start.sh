#!/bin/zsh

JAR_FILE="target/pdfConvertSystem-1.0-SNAPSHOT.jar"
CONFIG_DIR="config"

if [ ! -f "$JAR_FILE" ]; then
  echo "错误: JAR 文件不存在，请先执行 mvn clean package -DskipTests"
  exit 1
fi

if [ ! -f "$CONFIG_DIR/application.yml" ]; then
  echo "错误: 配置文件 $CONFIG_DIR/application.yml 不存在"
  echo "请创建并填写正确的配置"
  exit 1
fi

export LIBO_NO_TASK_POLICY=1
export LC_PAPER=en_GB.UTF-8

echo "启动 PDF Convert System..."
java -jar "$JAR_FILE" \
  --spring.config.location="classpath:/,file:./$CONFIG_DIR/" \
  "$@"