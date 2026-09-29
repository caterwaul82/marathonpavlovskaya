# Контекст проекта

Лендинг марафона похудения «-4 кг за 2 недели» (автор — Павловская).

## Структура
- `index.html` — весь сайт одной статической страницей (CSS внутри, картинки встроены base64). Сборки нет.
- Контакты на сайте: Telegram https://t.me/pavlovvvskaya, почта caterwaul5@mail.ru.

## Хостинг
- Vercel, команда `marafoningizing` (team_bSJHUTIQEIWQ8BT0Sh0LoYVT).
- Проект `marathonpavlovskaya` (prj_eANhPplqanSnMOyD8iEcPo78REPk), framework: none (static).
- Боевой адрес: https://marathonpavlovskaya.vercel.app
- Первый деплой сделан вручную из ветки `claude/deploy-site-vercel-oo5r3g`.
  Автодеплой из GitHub ещё не настроен: нужно подключить репозиторий в Vercel → Settings → Git.

## Планы
- Подключить Telegram-бота (задача в работе).
- Токен бота хранить только в переменных окружения Vercel (например, `TELEGRAM_BOT_TOKEN`), не в коде.
