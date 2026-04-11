/**
 * @file formatter.js
 * @description Преобразует текст и сущности (entities) из сообщения Telegram в Markdown формат, поддерживаемый Discord, 
 * а также извлекает ссылки в виде кнопок.
 */

function processPostText(text, entities) {
  if (!text) return { text: '', buttons: [] };
  if (!entities || entities.length === 0) return { text, buttons: [] };

  const markers = [];
  const buttons = [];
  const deleted = new Array(text.length).fill(false);

  entities.forEach((ent) => {
    let startTag = '', endTag = '';
    
    switch (ent.type) {
      case 'bold': startTag = endTag = '**'; break;
      case 'italic': startTag = endTag = '*'; break;
      case 'underline': 
        // Отключено: нижнее подчеркивание в Discord смотрится плохо и путается со ссылками
        break;
      case 'strikethrough': startTag = endTag = '~~'; break;
      case 'code': startTag = endTag = '`'; break;
      case 'pre': startTag = '```\n'; endTag = '\n```'; break;
      case 'spoiler': startTag = endTag = '||'; break;
      case 'blockquote': 
        startTag = '[[BQ_START]]'; 
        endTag = '[[BQ_END]]'; 
        break;
      case 'text_link':
      case 'url':
        let label = text.substring(ent.offset, ent.offset + ent.length);
        const originalLabel = label;
        label = label.replace(/[*\-_~`]/g, '').trim(); 
        if (label.length > 80) label = label.substring(0, 77) + '...';
        
        let linkUrl = ent.type === 'text_link' ? ent.url : originalLabel;
        if (!label || ent.type === 'url') label = 'Ссылка';
        
        buttons.push({ label, url: linkUrl });

        for (let i = ent.offset; i < ent.offset + ent.length; i++) {
          deleted[i] = true;
        }
        break;
    }

    if (startTag) {
      let startPos = ent.offset;
      let endPos = ent.offset + ent.length;

      // Не смещаем `blockquote` маркеры, так как они работают с целыми блоками текста
      if (ent.type !== 'blockquote') {
        while (startPos < endPos && /\s/.test(text[startPos])) startPos++;
        while (endPos > startPos && /\s/.test(text[endPos - 1])) endPos--;
      }

      if (startPos < endPos) {
        markers.push({ pos: startPos, tag: startTag, type: 'start' });
        markers.push({ pos: endPos, tag: endTag, type: 'end' });
      }
    }
  });

  const markersAt = {};
  for (const m of markers) {
    if (!markersAt[m.pos]) markersAt[m.pos] = [];
    markersAt[m.pos].push(m);
  }

  let result = '';
  for (let i = 0; i <= text.length; i++) {
    if (markersAt[i]) {
      const sorted = markersAt[i].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'start' ? 1 : -1;
        return 0;
      });
      for (const m of sorted) result += m.tag;
    }

    if (i < text.length && !deleted[i]) {
      result += text[i];
    }
  }

  // Обработка Blockquote: разбиваем текст внутри маркеров на строки и к каждой добавляем `> `
  let bqStart = result.indexOf('[[BQ_START]]');
  while (bqStart !== -1) {
    let bqEnd = result.indexOf('[[BQ_END]]', bqStart);
    if (bqEnd === -1) bqEnd = result.length;
    
    const before = result.substring(0, bqStart);
    const quoteContent = result.substring(bqStart + 12, bqEnd);
    const after = result.substring(bqEnd + 10);
    
    const quoted = quoteContent
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
      
    result = before + quoted + after;
    bqStart = result.indexOf('[[BQ_START]]');
  }

  // Очистка от пустых тегов. Безопасная регулярка: забираем теги, внутри которых ТОЛЬКО пробелы/новые строки
  result = result.replace(/\*\*([ \t\n\r]*)\*\*/g, '$1');
  result = result.replace(/~~([ \t\n\r]*)~~/g, '$1');
  
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  if (result.length > 4096) {
    result = result.substring(0, 4093) + '...';
  }

  return { text: result, buttons };
}

module.exports = {
  processPostText
};
