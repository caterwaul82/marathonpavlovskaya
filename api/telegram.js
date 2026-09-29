// Telegram-бот @marathonpavlovskaya_bot: приветствие, анкета, отправка заявки владельцу.
//
// Бот работает без базы данных: ответы, собранные на предыдущих шагах, хранятся
// в скрытой ссылке (иконка 📝) внутри сообщения с вопросом. Telegram присылает
// это сообщение обратно вместе с ответом (reply_to_message / callback_query.message),
// так что бот всегда знает, на каком шаге человек и что он уже ответил.
//
// Переменные окружения Vercel:
//   TELEGRAM_BOT_TOKEN — токен бота от @BotFather
//   TELEGRAM_CHAT_ID   — chat_id, куда присылать заявки (личка владельца)
//
// Подключение вебхука: открыть в браузере /api/telegram?setup=<ключ>
// (ключ = первые 32 символа sha256 от токена, см. secretFor()).

const crypto = require('crypto');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const OWNER = process.env.TELEGRAM_CHAT_ID || '';
const SITE = 'https://marathonpavlovskaya.vercel.app/';

const GREETING =
  'Здравствуйте! 👋 Это бот марафона <b>«Система –4»</b>.\n\n' +
  'Уберём до –4 кг за 2 недели — дома, без диет и голодовок. ' +
  'Готовый план питания на простых продуктах, программа домашних тренировок для любого уровня ' +
  'и всего около 3 часов в неделю на тренировки и готовку.\n\n' +
  'В этом месяце в поток берём только 10 человек. ' +
  'Ответьте, пожалуйста, на 7 коротких вопросов, чтобы я лучше понимала, с чем вы приходите, — это займёт пару минут.\n\n' +
  '<i>Нажимая «Заполнить анкету», вы соглашаетесь на обработку персональных данных из анкеты ' +
  'для связи с вами по поводу марафона.</i>';

const THANKS =
  'Спасибо! 🤍 Анкета отправлена.\n\n' +
  'Я лично напишу вам в Telegram в ближайшее время, расскажу все подробности и отвечу на вопросы.';

// Вопросы анкеты по порядку. type: 'text' — ответ текстом, 'choice' — кнопками.
const STEPS = [
  { key: 'n', label: 'Имя', type: 'text', max: 60,
    q: 'Как вас зовут?', placeholder: 'Ваше имя' },
  { key: 'a', label: 'Возраст', type: 'choice',
    q: 'Сколько вам лет?', options: ['до 25', '25–35', '35–45', '45+'] },
  { key: 'h', label: 'Рост / вес', type: 'text', max: 40,
    q: 'Ваш рост и вес сейчас?\nНапример: 165 / 62', placeholder: '165 / 62' },
  { key: 'g', label: 'Цель', type: 'choice',
    q: 'Какая у вас цель?', options: ['Похудеть', 'Уменьшить объёмы', 'Подтянуть тело', 'Удержать вес'] },
  { key: 't', label: 'Уже пробовали', type: 'choice',
    q: 'Что уже пробовали?', options: ['Диеты', 'Спорт', 'Марафоны', 'Ничего'] },
  { key: 'l', label: 'Образ жизни', type: 'choice',
    q: 'Какой у вас образ жизни?', options: ['Сидячий', 'Немного двигаюсь', 'Регулярно тренируюсь'] },
  { key: 'z', label: 'Здоровье', type: 'text', max: 500,
    q: 'Есть ли ограничения по здоровью?\nНапример: беременность, кормление грудью, заболевания. ' +
       'Если ограничений нет — напишите «нет».', placeholder: 'Например: нет' },
];

function secretFor(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function tg(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  if (!data.ok) console.error(`Telegram ${method} failed:`, data.description);
  return data;
}

// --- состояние анкеты в скрытой ссылке ---

function encodeState(state) {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

function decodeState(message) {
  const ent = (message && (message.entities || message.caption_entities)) || [];
  for (const e of ent) {
    if (e.type === 'text_link' && e.url && e.url.includes('#s=')) {
      try {
        return JSON.parse(Buffer.from(e.url.split('#s=')[1], 'base64url').toString('utf8'));
      } catch (_) { return null; }
    }
  }
  return null;
}

function questionHtml(i, state) {
  const step = STEPS[i];
  return `<a href="${SITE}#s=${encodeState(state)}">📝</a> <b>Вопрос ${i + 1} из ${STEPS.length}</b>\n\n${esc(step.q)}`;
}

async function askStep(chatId, i, answers) {
  const step = STEPS[i];
  const state = { ...answers, k: step.key };
  const reply_markup = step.type === 'choice'
    ? { inline_keyboard: step.options.map((o, idx) => [{ text: o, callback_data: `${step.key}:${idx}` }]) }
    : { force_reply: true, input_field_placeholder: step.placeholder };
  return tg('sendMessage', {
    chat_id: chatId, text: questionHtml(i, state), parse_mode: 'HTML',
    disable_web_page_preview: true, reply_markup,
  });
}

// Записывает ответ на текущий шаг и задаёт следующий вопрос или завершает анкету.
async function advance(chatId, from, state, value) {
  const i = STEPS.findIndex((s) => s.key === state.k);
  const answers = { ...state };
  delete answers.k;
  answers[STEPS[i].key] = value;
  if (i + 1 < STEPS.length) return askStep(chatId, i + 1, answers);
  await tg('sendMessage', { chat_id: chatId, text: THANKS });
  await notifyOwner(from, answers);
}

function answerText(step, value) {
  return step.type === 'choice' ? step.options[value] : value;
}

async function notifyOwner(from, answers) {
  if (!OWNER) { console.error('TELEGRAM_CHAT_ID is not set, lead lost:', answers); return; }
  const lines = STEPS.map((s) => `<b>${s.label}:</b> ${esc(answerText(s, answers[s.key]) ?? '—')}`);
  const who = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'профиль';
  const contact = from.username
    ? `@${esc(from.username)}`
    : `<a href="tg://user?id=${from.id}">${esc(who)}</a> (нет username)`;
  const payload = {
    chat_id: OWNER, parse_mode: 'HTML', disable_web_page_preview: true,
    text: `🔔 <b>Новая заявка</b>\n\n${lines.join('\n')}\n\n<b>Telegram:</b> ${contact}`,
  };
  if (from.username) {
    payload.reply_markup = { inline_keyboard: [[{ text: 'Написать', url: `https://t.me/${from.username}` }]] };
  }
  await tg('sendMessage', payload);
}

async function sendGreeting(chatId) {
  return tg('sendMessage', {
    chat_id: chatId, text: GREETING, parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: 'Заполнить анкету', callback_data: 'go' }]] },
  });
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  if (msg.chat.type !== 'private') return;
  const text = (msg.text || '').trim();

  if (text.startsWith('/start')) return sendGreeting(chatId);
  if (text === '/id') return tg('sendMessage', { chat_id: chatId, text: `Ваш chat_id: ${chatId}` });

  const state = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.is_bot
    ? decodeState(msg.reply_to_message) : null;
  const step = state && STEPS.find((s) => s.key === state.k);

  if (!step) {
    return tg('sendMessage', {
      chat_id: chatId,
      text: 'Чтобы записаться на марафон, заполните короткую анкету 👇',
      reply_markup: { inline_keyboard: [[{ text: 'Заполнить анкету', callback_data: 'go' }]] },
    });
  }
  if (step.type === 'choice') {
    return tg('sendMessage', { chat_id: chatId, text: 'Пожалуйста, выберите вариант кнопкой под вопросом 👆' });
  }
  if (!text) {
    return tg('sendMessage', { chat_id: chatId, text: 'Пожалуйста, ответьте текстом 🙂' });
  }
  return advance(chatId, msg.from, state, text.slice(0, step.max));
}

async function onCallback(cb) {
  const msg = cb.message;
  await tg('answerCallbackQuery', { callback_query_id: cb.id });
  if (!msg || msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;

  if (cb.data === 'go') {
    await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: msg.message_id, reply_markup: { inline_keyboard: [] } });
    return askStep(chatId, 0, {});
  }

  const [key, idxStr] = String(cb.data || '').split(':');
  const state = decodeState(msg);
  const i = STEPS.findIndex((s) => s.key === key);
  const step = STEPS[i];
  const idx = Number(idxStr);
  if (!state || state.k !== key || !step || step.type !== 'choice' || !(idx in step.options)) return;

  // Показываем выбранный вариант и убираем кнопки, чтобы ответ нельзя было выбрать дважды.
  await tg('editMessageText', {
    chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML', disable_web_page_preview: true,
    text: `${questionHtml(i, state)}\n\n✅ ${esc(step.options[idx])}`,
  });
  return advance(chatId, cb.from, state, idx);
}

async function setup(req, res) {
  const url = `https://${req.headers.host}/api/telegram`;
  const hook = await tg('setWebhook', {
    url, secret_token: secretFor(TOKEN),
    allowed_updates: ['message', 'callback_query'], drop_pending_updates: true,
  });
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'Записаться на марафон' }] });
  const test = OWNER
    ? await tg('sendMessage', { chat_id: OWNER, text: '✅ Бот подключён. Заявки с анкеты будут приходить сюда.' })
    : { ok: false, description: 'TELEGRAM_CHAT_ID не задан' };
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.status(200).send(
    `Вебхук: ${hook.ok ? 'подключён ✅' : 'ошибка ❌ ' + hook.description}\n` +
    `Тестовое сообщение владельцу: ${test.ok ? 'отправлено ✅' : 'ошибка ❌ ' + test.description}\n`
  );
}

module.exports = async (req, res) => {
  if (!TOKEN) return res.status(500).send('TELEGRAM_BOT_TOKEN is not set');
  const secret = secretFor(TOKEN);

  if (req.method === 'GET') {
    if (req.query && req.query.setup === secret) return setup(req, res);
    return res.status(200).send('ok');
  }
  if (req.headers['x-telegram-bot-api-secret-token'] !== secret) return res.status(401).send('unauthorized');

  try {
    const update = req.body || {};
    if (update.message) await onMessage(update.message);
    else if (update.callback_query) await onCallback(update.callback_query);
  } catch (e) {
    console.error(e);
  }
  // Всегда 200, иначе Telegram будет повторять одно и то же обновление.
  res.status(200).send('ok');
};

module.exports.secretFor = secretFor;
