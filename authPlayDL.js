const play = require('play-dl');

async function authenticate() {
  console.log("=== Запуск авторизации play-dl ===");
  try {
    await play.authorization();
    console.log("✅ Авторизация успешно завершена! Данные сохранены в папку .data/");
    console.log("Теперь вы можете запустить бота командой: npm start");
  } catch (error) {
    console.error("❌ Ошибка авторизации:", error);
  }
}

authenticate();
