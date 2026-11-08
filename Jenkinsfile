
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

	stage('Validate Image Tag') {
    steps {
        script {
            def tag = params.IMAGE_TAG?.trim()

            if (!tag || !(tag ==~ /[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}/)) {
                error("IMAGE_TAG 格式不合法：只能使用字母、数字、下划线、点和横线，且长度不超过 128")
            }

            if (tag != params.IMAGE_TAG) {
                error("IMAGE_TAG 不能包含首尾空格")
            }

            env.IMAGE_TAG = tag
        }

        echo "镜像版本参数校验通过：${env.IMAGE_TAG}"
    }
}

        stage('Configure Deploy Environment') {
    steps {
        script {
            switch (params.DEPLOY_ENV) {
                case 'dev':
                    env.DEPLOY_CONTAINER = 'node-demo-dev'
                    env.DEPLOY_PORT = '3002'
                    break

                case 'test':
                    env.DEPLOY_CONTAINER = 'node-demo-test'
                    env.DEPLOY_PORT = '3003'
                    break

                case 'prod':
                    error('生产环境暂不允许自动部署，请先配置审批流程')

                default:
                    error("不支持的部署环境：${params.DEPLOY_ENV}")
            }

            echo "部署环境：${params.DEPLOY_ENV}"
            echo "部署容器：${env.DEPLOY_CONTAINER}"
            echo "部署端口：${env.DEPLOY_PORT}"
        }
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

            IMAGE_VERSION="${IMAGE_NAME}:${IMAGE_TAG}"
            IMAGE_BUILD="${IMAGE_NAME}:build-${BUILD_NUMBER}"

            docker build \
              -t "$IMAGE_VERSION" \
              -t "$IMAGE_BUILD" \
              .

            echo "Docker 镜像构建成功！"
            echo "业务版本：$IMAGE_VERSION"
            echo "构建版本：$IMAGE_BUILD"
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

                        docker push "${IMAGE_NAME}:${IMAGE_TAG}"

			docker push "${IMAGE_NAME}:build-${BUILD_NUMBER}"

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
                echo "开始部署 ${params.DEPLOY_ENV} 环境..."

                sh '''
                    set -eu

                    IMAGE="${IMAGE_NAME}:build-${BUILD_NUMBER}"

                    # 校验部署目标
                    case "${DEPLOY_CONTAINER}:${DEPLOY_PORT}" in
                        node-demo-dev:3002|node-demo-test:3003)
                            ;;
                        *)
                            echo "错误：不允许的部署目标"
                            exit 1
                            ;;
                    esac

                    echo "部署镜像：$IMAGE"
                    echo "部署容器：$DEPLOY_CONTAINER"
                    echo "部署端口：$DEPLOY_PORT"

                    # 检查端口是否被其他容器占用
                    # 检查目标端口是否被其他进程占用
if ss -lntH "sport = :${DEPLOY_PORT}" | grep -q .; then
    if ! docker ps --format '{{.Names}} {{.Ports}}' |
         grep -F "$DEPLOY_CONTAINER " |
         grep -Fq ":${DEPLOY_PORT}->"; then
        echo "错误：端口 ${DEPLOY_PORT} 已被占用"
        exit 1
    fi
fi

                    # 删除当前环境的旧容器
                    if docker container inspect "$DEPLOY_CONTAINER" >/dev/null 2>&1; then
                        docker rm -f "$DEPLOY_CONTAINER"
                    fi

                    # 启动当前环境的新容器
                    docker run -d \
                      --name "$DEPLOY_CONTAINER" \
                      --restart unless-stopped \
                      -p "${DEPLOY_PORT}:3000" \
                      "$IMAGE"

                    # 等待应用启动
                    sleep 3

                    # 检查容器运行状态
                    docker inspect \
                      --format '{{.State.Running}}' \
                      "$DEPLOY_CONTAINER" | grep -qx true

                    # 验证 HTTP 接口
                    curl --fail --silent --show-error \
                      "http://127.0.0.1:${DEPLOY_PORT}"

                    echo ""
                    echo "${DEPLOY_CONTAINER} 自动部署成功！"
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
        echo "业务镜像版本：${params.IMAGE_TAG}"
	echo "Jenkins 构建版本：build-${env.BUILD_NUMBER}"

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
