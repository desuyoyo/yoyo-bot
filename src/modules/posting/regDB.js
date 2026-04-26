const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'registrations.json');

class RegDB {
  constructor() {
    this.data = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const file = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(file);
      } else {
        this.data = {};
        this.save();
      }
    } catch (e) {
      console.error('❌ Ошибка загрузки registrations.json:', e);
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('❌ Ошибка сохранения registrations.json:', e);
    }
  }

  createEvent(messageId, title, fields) {
    if (!this.data[messageId]) {
      this.data[messageId] = {
        title,
        fields,
        registrations: {}
      };
      this.save();
    }
  }

  getEvent(messageId) {
    return this.data[messageId] || null;
  }

  cancelEvent(messageId, reason) {
    if (!this.data[messageId]) return false;
    this.data[messageId].cancelled = true;
    this.data[messageId].cancelReason = reason;
    this.save();
    return true;
  }

  findEventByTitle(title) {
    for (const [msgId, eventData] of Object.entries(this.data)) {
      if (eventData.title === title) {
        return { messageId: msgId, ...eventData };
      }
    }
    return null;
  }

  addRegistration(messageId, userId, logMessageId, answers) {
    if (!this.data[messageId]) return false;
    
    this.data[messageId].registrations[userId] = {
      logMessageId,
      answers
    };
    this.save();
    return true;
  }

  getRegistration(messageId, userId) {
    if (!this.data[messageId]) return null;
    return this.data[messageId].registrations[userId] || null;
  }
}

module.exports = new RegDB();
