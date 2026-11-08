
pipeline {
    agent any


    parameters {
        choice(
            name: 'DEPLOY_ENV',
            choices: ['dev', 'test', 'prod'],
            description: '请选择部署环境'
        )

        string(
            name: 'IMAGE_TAG',
            defaultValue: 'latest',
            description: '请输入 Docker 镜像版本'
        )

        booleanParam(
            name: 'ENABLE_DEPLOY',
            defaultValue: true,
            description: '是否执行自动部署'
        )
    }

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
        stage('Show Build Parameters') {
            steps {
                echo "部署环境：${params.DEPLOY_ENV}"
                echo "镜像版本参数：${params.IMAGE_TAG}"
                echo "是否自动部署：${params.ENABLE_DEPLOY}"
                echo "Jenkins 构建编号：${env.BUILD_NUMBER}"
            }
        }

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
                when {
        expression {
            params.ENABLE_DEPLOY
        }
    }
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
    always {
        echo "构建编号：${env.BUILD_NUMBER}"
        echo "构建结果：${currentBuild.currentResult}"
        echo "构建地址：${env.BUILD_URL}"
    }

    success {
        echo 'CI/CD 执行成功！'
        echo "镜像版本：build-${env.BUILD_NUMBER}"

        script {
            if (params.ENABLE_DEPLOY) {
                echo 'GitHub、Docker、Harbor、Node.js 部署全部完成。'
            } else {
                echo 'GitHub、Docker、Harbor 已完成，Node.js 部署已跳过。'
            }
        }
    }

    failure {
        echo 'CI/CD 执行失败！'
        echo "失败构建：${env.BUILD_URL}"
        echo '请检查 Console Output 定位失败阶段。'
    }

    aborted {
        echo '流水线已被中止。'
    }

    cleanup {
        echo '流水线结束，执行统一清理阶段。'
    }
}

}
