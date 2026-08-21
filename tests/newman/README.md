# Newman E2E Tests for Final Project

Newman-коллекция для end-to-end тестирования микросервисов final-project через Traefik gateway.

## Файлы

- `final-project-newman-collection.json` — коллекция с 50 тестами
- `final-project-newman-environment.json` — окружение (base_url)

## Покрытые сервисы

| Сервис | Маршруты через Traefik |
|--------|----------------------|
| auth-service | `/api/v1/register`, `/api/v1/login`, `/api/v1/confirm` |
| profile-service | `/api/v1/profile` |
| advert-cmd-svc | `/api/v1/adverts`, `/api/v1/categories`, `/api/v1/brands`, `/api/v1/colors` |
| advert-query | `/api/v1/search` |
| dialog-svc | `/api/v1/dialog`, `/api/v1/conversations` |
| order-svc | `/api/v1/order` |
| billing-svc | `/api/v1/billing`, `/api/v1/transaction` |
| delivery-service | `/api/v1/delivery`, `/api/v1/providers` |
| notification-svc | `/api/v1/notifications`, `/api/v1/notification/inbox_mock` |
| bff-finalproj | `/api/v1/bff` |

## Сценарий (2 пользователя)

1. **Регистрация** — seller и buyer регистрируются (уникальные username/email через timestamp)
2. **Подтверждение** — токен извлекается из `inbox_mock` и вызывается `/api/v1/confirm`
3. **Логин** — оба пользователя получают JWT
4. **Профиль** — создание и обновление профилей
5. **Объявление** — seller создаёт объявление
6. **Поиск** — buyer находит объявление через advert-query
7. **Диалог** — buyer пишет сообщение seller
8. **Заказ** — buyer создаёт заказ на объявление seller
9. **Доставка** — buyer выбирает провайдера доставки
10. **Оплата** — buyer пополняет баланс и оплачивает заказ
11. **Уведомления** — проверка уведомлений обоих пользователей
12. **BFF** — агрегированные эндпоинты

## Запуск

```bash
# Установить newman (если ещё не установлен)
npm install -g newman

# Запустить тесты
cd /Users/nikitamarkovskij/Desktop/final_project/tests/newman
newman run final-project-newman-collection.json \
  -e final-project-newman-environment.json \
  --delay-request 500 \
  --timeout-request 15000
```

## Примечания

- Все запросы идут через Traefik на `http://localhost` (порт 80)
- Внутренние эндпоинты (`/internal/*`, `/health`, `/healthz`, `/moderation/*`) не тестируются — они не маршрутизируются через Traefik
- `advert-postprocessor` не имеет HTTP-эндпоинтов (только Kafka consumer)
- Для корректной работы подтверждения аккаунта notification-svc должен быть запущен и обрабатывать событие `user.created`