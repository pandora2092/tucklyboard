# Размещение tuckly на FirstVDS

Цель: Ubuntu, IP `45.114.61.141`, домен `tucklyboard.ru`, новая пустая база. Доступ к серверу — через SSH; команды ниже предполагают пользователя `root`. Если используется другой пользователь, понадобятся его имя и права sudo.

## 1. DNS и доступ к серверу

У DNS-провайдера домена создайте A-запись: имя `@`, значение `45.114.61.141`. Это REG.RU, если домен использует его NS; при других NS запись меняется у соответствующего DNS-провайдера. Неверная AAAA-запись для этого домена должна быть исправлена или удалена, если IPv6 не используется.

Порты TCP 80 и 443 должны быть доступны в настройках FirstVDS и серверного firewall. SSH должен оставаться доступным. Если на сервере уже работают Nginx, Apache или другая панель, использующая 80/443, сначала согласуйте использование портов; не запускайте второй веб-сервер поверх существующего.

После обновления DNS Caddy автоматически получит и будет продлевать HTTPS-сертификат. Отдельная покупка сертификата не нужна: https://caddyserver.com/docs/automatic-https.

## 2. Подготовить Git-репозиторий

Отправьте актуальные исходники в свой Git-репозиторий. Для запуска в нём должны присутствовать `Dockerfile`, `.dockerignore`, `compose.production.yaml`, `.env.production.example`, `infra/production/` и `apps/api/prisma/migrations/`, а также исходники приложений, общие пакеты и lock-файл npm.

Файлы `.env` и `.env.production` игнорируются Git: токен бота и пароль PostgreSQL задаются на сервере.

Репозиторий: https://github.com/pandora2092/tucklyboard. Для закрытого репозитория настройте серверу доступ, например отдельный SSH deploy key с правом чтения. Не вставляйте токен Git-провайдера в URL клонирования.

## 3. Клонировать проект и настроить сервер

В терминале локального компьютера:

```bash
ssh root@45.114.61.141
```

При первом подключении проверьте отпечаток SSH-ключа сервера по данным доверенного канала, например консоли FirstVDS. Используйте действующий SSH-ключ или вводите пароль непосредственно в терминале, не в чате.

На сервере:

```bash
apt-get update
apt-get install -y git openssl
git clone https://github.com/pandora2092/tucklyboard.git /opt/tuckly
cd /opt/tuckly
bash infra/production/install-docker-ubuntu.sh
cp -n .env.production.example .env.production
chmod 600 .env.production
openssl rand -hex 32
nano .env.production
```

В редакторе заполните `POSTGRES_PASSWORD` сгенерированной строкой и `BOT_TOKEN` существующим токеном бота. Также заполните `ADMIN_TELEGRAM_IDS` своим числовым Telegram ID. Пример остальных настроек:

```dotenv
SITE_DOMAIN=tucklyboard.ru
BOT_USERNAME=tuckly_bot
BOT_POLLING=true
ADMIN_TELEGRAM_IDS=YOUR_TELEGRAM_ID
```

Сохраните файл и выйдите из редактора: Ctrl+O, Enter, Ctrl+X. `cp -n` сохраняет уже существующий `.env.production`; при повторном запуске оставьте прежний пароль PostgreSQL. Для рабочего сервера этот файл создаётся один раз и остаётся на месте при `git pull`.

## 4. Первый запуск

Перед запуском отключите локальное получение сообщений тем же ботом: задайте `BOT_POLLING=false` в локальном `.env` и перезапустите локальный API, если он запущен. Одновременно должен работать один poller. Если у бота ранее использовался webhook, его необходимо отключить перед переходом на polling.

На сервере в `/opt/tuckly`:

```bash
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps -a
```

Установка Docker следует официальной схеме Ubuntu: https://docs.docker.com/engine/install/ubuntu/. Скрипт не удаляет существующие установки Docker; если нужна их перенастройка, он остановится с пояснением. На сервер не требуется отдельно устанавливать Node.js или PostgreSQL.

Образы собираются на сервере; для сборки нужны свободные память и диск. PostgreSQL создаёт отдельную базу `tuckly`. Одноразовый сервис `migrate` применяет начальную Prisma-миграцию, затем запускается API и веб-сервер. Состояние `migrate: Exited (0)` нормально. Начальная миграция предназначена для новой базы; существующие базы, созданные через `db push`, требуют отдельного baseline.

Наружу публикуются только 80/443. PostgreSQL и API доступны внутри Docker-сети. Данные PostgreSQL и HTTPS-сертификаты сохраняются в отдельных Docker-томах. Обычный перезапуск их не удаляет; не используйте `down -v` для рабочего проекта.

## 5. Telegram и проверка

При отключённом локальном polling авторизация и функции локального интерфейса остаются доступны; получение новых сообщений выполняет серверный экземпляр.

```bash
curl --fail https://tucklyboard.ru/api/health
docker compose --env-file .env.production -f compose.production.yaml logs --tail=80 migrate api web
```

Ожидаемый ответ health: `{"ok":true}`. В BotFather задайте URL кнопки меню `https://tucklyboard.ru`. Затем откройте `@tuckly_bot`, отправьте `/start`, сохраните тестовый материал, проверьте приложение. Для админки отправьте `/admin` с аккаунта, чей числовой ID указан в `ADMIN_TELEGRAM_IDS`. Обычный браузер без Telegram-авторизации должен показывать инструкцию для входа, а не чужие данные.

Если HTTPS не запускается, проверьте DNS, доступность 80/443 и логи `web`. Если API не запускается — логи `migrate` и `api`. Не публикуйте `.env.production` или полный вывод `docker compose config`: там есть секреты.

## Обновления и резервная копия

Перед обновлением сохраните резервную копию базы и скопируйте её с сервера в защищённое хранилище. Пример создания файла на сервере:

```bash
cd /opt/tuckly
mkdir -p backups
chmod 700 backups
docker compose --env-file .env.production -f compose.production.yaml exec -T postgres pg_dump -U tuckly -d tuckly > backups/before-update.sql
chmod 600 backups/before-update.sql
```

После создания резервной копии обновите код из Git и пересоберите приложение:

```bash
cd /opt/tuckly
git pull --ff-only
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml ps -a
curl --fail https://tucklyboard.ru/api/health
```

`git pull --ff-only` остановится при расхождении веток. Серверные изменения кода в таком случае нужно разобрать, а не сбрасывать принудительно. `.env.production` и Docker-тома с данными сохраняются при обновлении. Для изменений схемы добавляйте новые Prisma-миграции и проверяйте их перед обновлением. Пароль PostgreSQL нельзя менять только в `.env.production` после создания базы — необходимо также сменить пароль роли внутри PostgreSQL.
