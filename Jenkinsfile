
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
            OLD_IMAGE=""
            NEED_ROLLBACK=0

            # 只允许部署指定环境
            case "${DEPLOY_CONTAINER}:${DEPLOY_PORT}" in
                node-demo-dev:3002|node-demo-test:3003)
                    ;;
                *)
                    echo "错误：不允许的部署目标"
                    exit 1
                    ;;
            esac

            # 记录当前容器的旧镜像
            if docker container inspect "$DEPLOY_CONTAINER" >/dev/null 2>&1; then
                OLD_IMAGE="$(docker inspect \
                  --format '{{.Config.Image}}' "$DEPLOY_CONTAINER")"

                echo "当前运行镜像：$OLD_IMAGE"
            else
                echo "首次部署：没有旧容器"
            fi

            # 确认旧镜像可以用于回滚
            if [ -n "$OLD_IMAGE" ]; then
                docker image inspect "$OLD_IMAGE" >/dev/null
            fi

            # 如果目标端口已被占用，必须确认是当前目标容器
            if ss -lntH "sport = :${DEPLOY_PORT}" | grep -q .; then
                if ! docker ps --format '{{.Names}} {{.Ports}}' |
                     grep -F "$DEPLOY_CONTAINER " |
                     grep -Fq ":${DEPLOY_PORT}->"; then
                    echo "错误：目标端口已被其他进程占用"
                    exit 1
                fi
            fi

            echo "准备部署新镜像：$IMAGE"

            # 删除旧容器
            if docker container inspect "$DEPLOY_CONTAINER" >/dev/null 2>&1; then
                NEED_ROLLBACK=1
                docker rm -f "$DEPLOY_CONTAINER"
            fi

            # 尝试部署新版本
            if (
                set -e

                docker run -d \
                  --name "$DEPLOY_CONTAINER" \
                  --restart unless-stopped \
                  -p "${DEPLOY_PORT}:3000" \
                  "$IMAGE"

                # 最多检查 10 次，每次间隔 2 秒
                HEALTHY=0

                for i in $(seq 1 10); do
                    if [ "$(docker inspect \
       --format '{{.State.Running}}' \
       "$DEPLOY_CONTAINER" 2>/dev/null)" = "true" ] &&
   curl --fail --silent --show-error \
     --max-time 3 \
     "http://127.0.0.1:${DEPLOY_PORT}" >/dev/null; then

                        HEALTHY=1
                        break
                    fi

                    sleep 2
                done

                [ "$HEALTHY" -eq 1 ]
            ); then
                echo "新版本部署成功：$IMAGE"
            else
                echo "新版本部署失败！"

                if [ "$NEED_ROLLBACK" -eq 1 ] && [ -n "$OLD_IMAGE" ]; then
                    echo "开始回滚到：$OLD_IMAGE"

                    docker rm -f "$DEPLOY_CONTAINER" >/dev/null 2>&1 || true

                    if docker run -d \
                        --name "$DEPLOY_CONTAINER" \
                        --restart unless-stopped \
                        -p "${DEPLOY_PORT}:3000" \
                        "$OLD_IMAGE"; then

                        ROLLBACK_OK=0

                        for i in $(seq 1 10); do
                            if [ "$(docker inspect \
       --format '{{.State.Running}}' \
       "$DEPLOY_CONTAINER" 2>/dev/null)" = "true" ] &&
   curl --fail --silent --show-error \
     --max-time 3 \
     "http://127.0.0.1:${DEPLOY_PORT}" >/dev/null; then

                                ROLLBACK_OK=1
                                break
                            fi

                            sleep 2
                        done

                        if [ "$ROLLBACK_OK" -eq 1 ]; then
                            echo "旧版本恢复成功：$OLD_IMAGE"
                        else
                            echo "严重错误：回滚容器未通过健康检查"
                        fi
                    else
                        echo "严重错误：旧版本容器启动失败"
                    fi
                else
                    echo "没有可用的旧版本，无法自动回滚"
                fi

                # 新版本部署失败，始终让 Jenkins 标记为 FAILURE
                exit 1
            fi
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
