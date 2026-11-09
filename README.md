# Кабаний Уголок 🌗

Простой закрытый чат для друзей. Работает в браузере, история сохраняется, можно сидеть голосом.

## Как запустить локально (для себя)

1. Установи [Node.js LTS](https://nodejs.org/)
2. Распакуй папку
3. В терминале:

```bash
npm install
npm start
```

Открой http://localhost:3000

Или просто запусти `start.bat` на Windows.

---

## Как сделать так, чтобы чат работал ВСЕГДА (для друзей)

Самый простой бесплатный способ — **Render.com**.

### Шаги (один раз, ~7 минут):

1. Зарегистрируйся на [https://render.com](https://render.com) (можно через GitHub)

2. Создай новый **Web Service**

3. Подключи репозиторий `yapr1rodka-wq/kabaniy-ugolok`

4. Настройки сервиса:
   - **Name**: `kabaniy-ugolok`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Нажми **Create Web Service**

6. Подожди 2–4 минуты

7. Получишь ссылку вида:
   `https://kabaniy-ugolok-xxxx.onrender.com`

**Эту ссылку скидываешь друзьям.**

---

## Голос (опционально)

Голосовые комнаты работают через LiveKit.

1. Зайди на [https://cloud.livekit.io](https://cloud.livekit.io) и создай бесплатный проект
2. Скопируй `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
3. В Render → Environment добавь эти три переменные
4. Перезапусти сервис

---

Приятного общения 🌗
