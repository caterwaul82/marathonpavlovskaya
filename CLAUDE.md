# Контекст проекта

Лендинг марафона похудения «-4 кг за 2 недели» (автор — Павловская).

## Структура
- `index.html` — весь сайт одной статической страницей (CSS внутри, картинки встроены base64). Сборки нет.
- `api/telegram.js` — Vercel-функция, вебхук бота @marathonpavlovskaya_bot (анкета из 7 вопросов → заявка владельцу в личку).
  Без базы данных: состояние анкеты хранится в скрытой ссылке 📝 в сообщении с вопросом.
- Кнопки на сайте ведут на https://t.me/marathonpavlovskaya_bot?start=site. Почта на сайте: caterwaul5@mail.ru.

## Хостинг
- Vercel, команда `marafoningizing` (team_bSJHUTIQEIWQ8BT0Sh0LoYVT).
- Проект `marathonpavlovskaya` (prj_eANhPplqanSnMOyD8iEcPo78REPk), framework: none (static).
- Боевой адрес: https://marathonpavlovskaya.vercel.app
- Первый деплой сделан вручную из ветки `claude/deploy-site-vercel-oo5r3g`.
  Автодеплой из GitHub ещё не настроен: нужно подключить репозиторий в Vercel → Settings → Git.

## Telegram-бот
- Переменные Vercel: `TELEGRAM_BOT_TOKEN` (токен), `TELEGRAM_CHAT_ID` (личка владельца для заявок). Токены в код не класть.
- Вебхук подключается открытием `/api/telegram?setup=<sha256(token)[:32]>`; там же уходит тестовое сообщение владельцу.
- Команда `/id` в боте показывает chat_id.
