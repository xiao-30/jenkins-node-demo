
pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        REGISTRY = '192.168.220.142'
        IMAGE_NAME = '192.168.220.142/devops-study/node-demo'
        CONTAINER_NAME = 'harbor-node-demo'
    }

    stages {
        stage('Checkout GitHub') {
            steps {
                echo '开始检出 GitHub 项目代码...'

                checkout scm
            }
        }

        stage('Check Source Code') {
            steps {
                echo '检查项目源代码...'

                sh '''
                    set -eu

                    test -f Dockerfile
                    test -f app.js
                    test -f package.json
                    test -f Jenkinsfile

                    echo "源代码检查通过！"
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                echo '开始构建 Docker 镜像...'

                sh '''
                    set -eu

                    docker build \
                      -t "${IMAGE_NAME}:build-${BUILD_NUMBER}" .

                    echo "Docker 镜像构建成功！"
                '''
            }
        }

        stage('Push Image to Harbor') {
            steps {
                echo '开始推送 Docker 镜像到 Harbor...'

                withCredentials([
                    usernamePassword(
                        credentialsId: 'harbor-robot',
                        usernameVariable: 'HARBOR_USER',
                        passwordVariable: 'HARBOR_PASSWORD'
                    )
                ]) {
                    sh '''
                        set -eu
                        set +x

                        export DOCKER_CONFIG="$(mktemp -d)"

                        trap 'docker logout "$REGISTRY" >/dev/null 2>&1 || true; rm -rf "$DOCKER_CONFIG"' EXIT

                        printf '%s' "$HARBOR_PASSWORD" | \
                          docker login "$REGISTRY" \
                            --username "$HARBOR_USER" \
                            --password-stdin

                        docker push \
                          "${IMAGE_NAME}:build-${BUILD_NUMBER}"

                        echo "Harbor 镜像推送成功！"
                    '''
                }
            }
        }

        stage('Deploy Node.js') {
            steps {
                echo '开始自动部署 Node.js...'

                sh '''
                    set -eu

                    IMAGE="${IMAGE_NAME}:build-${BUILD_NUMBER}"

                    # 删除旧容器
                    if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
                        docker rm -f "$CONTAINER_NAME"
                    fi

                    # 启动新容器
                    docker run -d \
                      --name "$CONTAINER_NAME" \
                      --restart unless-stopped \
                      -p 3001:3000 \
                      "$IMAGE"

                    # 等待应用启动
                    sleep 3

                    # 检查容器运行状态
                    docker inspect \
                      --format '{{.State.Running}}' \
                      "$CONTAINER_NAME" | grep -qx true

                    # 验证 HTTP 接口
                    curl --fail --silent --show-error \
                      http://127.0.0.1:3001

                    echo ""
                    echo "Node.js 自动部署成功！"
                '''
            }
        }
    }

    post {
        success {
            echo 'CI/CD 执行成功！'
            echo 'GitHub 检出、Docker 构建、Harbor 推送、Node.js 部署全部完成。'
        }

        failure {
            echo 'CI/CD 执行失败，请检查 Jenkins Console Output。'
        }

        always {
            echo "Pipeline 构建编号：${BUILD_NUMBER}"
        }
    }
}
