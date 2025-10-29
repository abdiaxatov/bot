import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const SITE_URL = process.env.SITE_URL || "https://abdiaxatov.uz";

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN_ID = process.env.ADMIN_ID;

// Ma'lumotlar fayllari
const CHANNELS_FILE = "channels.json";
const LINKS_FILE = "links.json";
const USERS_FILE = "users.json";

// Fayllarni yaratish
function initFiles() {
  if (!fs.existsSync(CHANNELS_FILE)) {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(LINKS_FILE)) {
    fs.writeFileSync(LINKS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
}

initFiles();

// Helper funksiyalar
function readJSON(file) {
  try {
    const data = fs.readFileSync(file, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Markdown maxsus belgilarni escape qilish
function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Userni saqlash
function saveUser(userId, username, firstName) {
  const users = readJSON(USERS_FILE);
  const userExists = users.find(u => u.userId === userId);
  
  if (!userExists) {
    users.push({
      userId,
      username: username || "Noma'lum",
      firstName: firstName || "Foydalanuvchi",
      joinedAt: new Date().toISOString()
    });
    writeJSON(USERS_FILE, users);
  }
}

console.log("🚀 Bot muvaffaqiyatli ishga tushdi!");
console.log("📊 Admin ID:", ADMIN_ID);

// ===============================================
// 🎯 START KOMANDASI
// ===============================================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  const firstName = msg.from.first_name;

  // Userni saqlash
  saveUser(userId, username, firstName);

  if (chatId.toString() === ADMIN_ID) {
    const adminKeyboard = {
      keyboard: [
        [{ text: "📢 Kanal qo'shish" }, { text: "📋 Kanallar ro'yxati" }],
        [{ text: "🔗 Link qo'shish" }, { text: "📑 Linklar ro'yxati" }],
        [{ text: "👥 Foydalanuvchilar" }, { text: "📊 Statistika" }],
        [{ text: "🧹 Tozalash" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    };

    bot.sendMessage(
      chatId,
      "👨‍💼 *Admin Paneliga Xush Kelibsiz\\!*\n\n" +
        "🎛 Botni boshqarish uchun quyidagi tugmalardan foydalaning:\n\n" +
        "📢 *Kanal qo'shish* \\- Obuna kanallari qo'shish\n" +
        "📋 *Kanallar ro'yxati* \\- Barcha kanallarni ko'rish\n" +
        "🔗 *Link qo'shish* \\- Foydalanuvchilarga linklar berish\n" +
        "📑 *Linklar ro'yxati* \\- Barcha linklarni ko'rish\n" +
        "👥 *Foydalanuvchilar* \\- Bot foydalanuvchilari\n" +
        "📊 *Statistika* \\- Bot statistikasi\n" +
        "🧹 *Tozalash* \\- Ma'lumotlarni tozalash",
      { parse_mode: "MarkdownV2", reply_markup: adminKeyboard }
    );
  } else {
    bot.sendMessage(
      chatId,
      `👋 *Assalomu alaykum\\, ${escapeMarkdown(firstName)}\\!*\n\n` +
        "🤖 Bot orqali foydali havolalarni olish uchun quyidagi kanallarga obuna bo'ling\\.\n\n" +
        "✅ Obuna bo'lgandan so'ng tekshirish tugmasini bosing\\!",
      { 
        parse_mode: "MarkdownV2",
        reply_markup: {
          keyboard: [
            [{ text: "✅ Tekshirish" }, { text: "🌐 Sayt" }],
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        }
      }
    );

    // A'zolikni tekshirish
    setTimeout(() => checkSubscription(chatId), 1000);
  }
});

// ===============================================
// 📢 KANAL QO'SHISH
// ===============================================
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Foydalanuvchi tugmalari (admin ga o'tishdan oldin)
  if (text === "🌐 Sayt") {
    bot.sendMessage(chatId, `🌐 Sayt: ${SITE_URL}`, { disable_web_page_preview: false });
    return;
  }

  if (text === "✅ Tekshirish") {
    bot.sendMessage(chatId, "🔄 Obunangiz tekshirilmoqda, iltimos kuting...");
    // Tekshirishni chaqirish
    setTimeout(() => checkSubscription(chatId), 500);
    return;
  }

  // Agar admin bo'lmasa, admin panelga oid kodni bajarmaslik uchun davom etamiz
  if (chatId.toString() !== ADMIN_ID) return;

  if (text === "📢 Kanal qo'shish") {
    bot.sendMessage(
      chatId,
      "📝 *Kanal/Guruh qo'shish*\n\n" +
        "Kanal yoki guruh username yoki linkini yuboring:\n\n" +
        "📌 Misol:\n" +
        "• @kanalim\n" +
        "• https://t\\.me/kanalim\n" +
        "• https://t\\.me/\\+ABC123xyz\n\n" +
        "❌ Bekor qilish: /cancel",
      { parse_mode: "MarkdownV2" }
    );

    const channelListener = (response) => {
      if (response.chat.id !== chatId) return;
      if (response.text === "/cancel") {
        bot.sendMessage(chatId, "❌ Bekor qilindi.");
        bot.removeListener("message", channelListener);
        return;
      }

      const channel = response.text?.trim();
      if (!channel || channel.startsWith("📢") || channel.startsWith("📋")) {
        bot.removeListener("message", channelListener);
        return;
      }

      let channels = readJSON(CHANNELS_FILE);
      
      if (channels.includes(channel)) {
        bot.sendMessage(chatId, "⚠️ Bu kanal allaqachon ro'yxatda mavjud!");
        bot.removeListener("message", channelListener);
        return;
      }

      channels.push(channel);
      writeJSON(CHANNELS_FILE, channels);

      bot.sendMessage(
        chatId,
        `✅ *Kanal muvaffaqiyatli qo'shildi\\!*\n\n📢 ${escapeMarkdown(channel)}\n\n` +
          `📊 Jami kanallar: ${channels.length}`,
        { parse_mode: "MarkdownV2" }
      );

      bot.removeListener("message", channelListener);
    };

    bot.on("message", channelListener);
  }

  // ===============================================
  // 📋 KANALLAR RO'YXATI
  // ===============================================
  if (text === "📋 Kanallar ro'yxati") {
    const channels = readJSON(CHANNELS_FILE);

    if (channels.length === 0) {
      bot.sendMessage(chatId, "📭 Hozircha kanallar yo'q\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    const buttons = channels.map((ch, i) => [
      { text: `${i + 1}. ${ch}`, callback_data: "none" },
      { text: "❌ O'chirish", callback_data: `del_ch_${i}` }
    ]);

    bot.sendMessage(
      chatId,
      `📋 *Kanallar ro'yxati*\n\n📊 Jami: ${channels.length} ta kanal`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: { inline_keyboard: buttons }
      }
    );
  }

  // ===============================================
  // 🔗 LINK QO'SHISH
  // ===============================================
  if (text === "🔗 Link qo'shish") {
    bot.sendMessage(
      chatId,
      "📝 *Link qo'shish*\n\n" +
        "1️⃣ Avval link nomini yozing:\n\n" +
        "📌 Misol: Canva Pro\\, ChatGPT\\, Netflix Premium\n\n" +
        "❌ Bekor qilish: /cancel",
      { parse_mode: "MarkdownV2" }
    );

    const titleListener = (titleMsg) => {
      if (titleMsg.chat.id !== chatId) return;
      if (titleMsg.text === "/cancel") {
        bot.sendMessage(chatId, "❌ Bekor qilindi.");
        bot.removeListener("message", titleListener);
        return;
      }

      const title = titleMsg.text?.trim();
      if (!title || title.startsWith("🔗") || title.startsWith("📑")) {
        bot.removeListener("message", titleListener);
        return;
      }

      bot.sendMessage(
        chatId,
        `2️⃣ *Endi "${escapeMarkdown(title)}" uchun URL manzilini yuboring:*\n\n` +
          "📌 Misol: https://example\\.com\n\n" +
          "❌ Bekor qilish: /cancel",
        { parse_mode: "MarkdownV2" }
      );

      const urlListener = (urlMsg) => {
        if (urlMsg.chat.id !== chatId) return;
        if (urlMsg.text === "/cancel") {
          bot.sendMessage(chatId, "❌ Bekor qilindi.");
          bot.removeListener("message", urlListener);
          bot.removeListener("message", titleListener);
          return;
        }

        let url = urlMsg.text?.trim();
        if (!url || url.startsWith("🔗") || url.startsWith("📑")) {
          bot.removeListener("message", urlListener);
          bot.removeListener("message", titleListener);
          return;
        }

        // URL ni to'g'rilash
        if (!url.startsWith("http")) {
          if (url.startsWith("@")) {
            url = `https://t.me/${url.substring(1)}`;
          } else {
            url = `https://${url}`;
          }
        }

        let links = readJSON(LINKS_FILE);
        links.push({ title, url });
        writeJSON(LINKS_FILE, links);

        bot.sendMessage(
          chatId,
          `✅ *Link muvaffaqiyatli qo'shildi\\!*\n\n` +
            `📌 Nomi: ${escapeMarkdown(title)}\n` +
            `🔗 URL: ${escapeMarkdown(url)}\n\n` +
            `📊 Jami linklar: ${links.length}`,
          { parse_mode: "MarkdownV2" }
        );

        bot.removeListener("message", urlListener);
        bot.removeListener("message", titleListener);
      };

      bot.on("message", urlListener);
      bot.removeListener("message", titleListener);
    };

    bot.on("message", titleListener);
  }

  // ===============================================
  // 📑 LINKLAR RO'YXATI
  // ===============================================
  if (text === "📑 Linklar ro'yxati") {
    const links = readJSON(LINKS_FILE);

    if (links.length === 0) {
      bot.sendMessage(chatId, "📭 Hozircha linklar yo'q\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    const buttons = links.map((link, i) => [
      { text: `${i + 1}. ${link.title}`, url: link.url },
      { text: "❌ O'chirish", callback_data: `del_link_${i}` }
    ]);

    bot.sendMessage(
      chatId,
      `📑 *Linklar ro'yxati*\n\n📊 Jami: ${links.length} ta link`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: { inline_keyboard: buttons }
      }
    );
  }

  // ===============================================
  // 👥 FOYDALANUVCHILAR
  // ===============================================
  if (text === "👥 Foydalanuvchilar") {
    const users = readJSON(USERS_FILE);

    if (users.length === 0) {
      bot.sendMessage(chatId, "📭 Hozircha foydalanuvchilar yo'q\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    let message = `👥 *Foydalanuvchilar ro'yxati*\n\n📊 Jami: ${users.length} ta\n\n`;
    
    users.slice(0, 20).forEach((user, i) => {
      const safeName = escapeMarkdown(user.firstName);
      const safeUsername = escapeMarkdown(user.username);
      message += `${i + 1}\\. ${safeName} \\(@${safeUsername}\\)\n`;
      message += `   🆔 ID: \`${user.userId}\`\n`;
      message += `   📅 Qo'shilgan: ${escapeMarkdown(new Date(user.joinedAt).toLocaleDateString('uz-UZ'))}\n\n`;
    });

    if (users.length > 20) {
      message += `\\.\\.\\.va yana ${users.length - 20} ta foydalanuvchi`;
    }

    bot.sendMessage(chatId, message, { parse_mode: "MarkdownV2" });
  }

  // ===============================================
  // 📊 STATISTIKA
  // ===============================================
  if (text === "📊 Statistika") {
    const channels = readJSON(CHANNELS_FILE);
    const links = readJSON(LINKS_FILE);
    const users = readJSON(USERS_FILE);

    const stats = `📊 *Bot Statistikasi*\n\n` +
      `📢 Kanallar: ${channels.length} ta\n` +
      `🔗 Linklar: ${links.length} ta\n` +
      `👥 Foydalanuvchilar: ${users.length} ta\n\n` +
      `📅 Sana: ${escapeMarkdown(new Date().toLocaleDateString('uz-UZ'))}\n` +
      `⏰ Vaqt: ${escapeMarkdown(new Date().toLocaleTimeString('uz-UZ'))}`;

    bot.sendMessage(chatId, stats, { parse_mode: "MarkdownV2" });
  }

  // ===============================================
  // 🧹 TOZALASH
  // ===============================================
  if (text === "🧹 Tozalash") {
    const cleanButtons = {
      inline_keyboard: [
        [{ text: "🗑 Kanallarni tozalash", callback_data: "clean_channels" }],
        [{ text: "🗑 Linklarni tozalash", callback_data: "clean_links" }],
        [{ text: "🗑 Foydalanuvchilarni tozalash", callback_data: "clean_users" }],
        [{ text: "🗑 HAMMASINI tozalash", callback_data: "clean_all" }],
        [{ text: "❌ Bekor qilish", callback_data: "cancel_clean" }]
      ]
    };

    bot.sendMessage(
      chatId,
      "🧹 *Tozalash*\n\n⚠️ Nimani tozalamoqchisiz?",
      { parse_mode: "MarkdownV2", reply_markup: cleanButtons }
    );
  }
});

// ===============================================
// ✅ A'ZOLIKNI TEKSHIRISH
// ===============================================
async function checkSubscription(userId) {
  const channels = readJSON(CHANNELS_FILE);
  const links = readJSON(LINKS_FILE);

  if (channels.length === 0) {
    bot.sendMessage(
      userId,
      "⚠️ *Hozircha obuna bo'lish uchun kanallar yo'q\\.*\n\n" +
        "📞 Iltimos\\, keyinroq urinib ko'ring\\.",
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  let notSubscribed = [];

  for (let channel of channels) {
    try {
      // Username yoki linkni tozalash
      let channelId = channel;
      
      if (channel.includes("t.me/")) {
        channelId = channel.split("t.me/")[1];
        if (channelId.includes("/")) {
          channelId = channelId.split("/")[0];
        }
      }
      
      if (channel.includes("+")) {
        // Private guruh/kanal
        channelId = channel;
      } else {
        channelId = channelId.replace("@", "");
        channelId = "@" + channelId;
      }

      const member = await bot.getChatMember(channelId, userId);
      
      if (!["member", "administrator", "creator"].includes(member.status)) {
        notSubscribed.push(channel);
      }
    } catch (error) {
      console.log("❗ Kanal tekshirishda xato:", channel, error.message);
      notSubscribed.push(channel);
    }
  }

  if (notSubscribed.length > 0) {
    // Obuna bo'lmagan
    let message = "🔒 *Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:*\n\n";
    
    const buttons = notSubscribed.map((ch, i) => {
      let url = ch;
      if (!url.startsWith("http")) {
        url = `https://t.me/${ch.replace("@", "")}`;
      }
      return [{ text: `📢 ${i + 1}. Kanal`, url: url }];
    });
    
    buttons.push([{ text: "✅ Obunani tekshirish", callback_data: "check_sub" }]);

    notSubscribed.forEach((ch, i) => {
      message += `${i + 1}\\. ${escapeMarkdown(ch)}\n`;
    });

    message += "\n👇 *Barcha kanallarga obuna bo'ling va 'Tekshirish' tugmasini bosing\\!*";

    bot.sendMessage(userId, message, {
      parse_mode: "MarkdownV2",
      reply_markup: { inline_keyboard: buttons }
    });
  } else {
    // Obuna bo'lgan - linklar ko'rsatish
    if (links.length === 0) {
      bot.sendMessage(
        userId,
        "🎉 *Tabriklaymiz\\!*\n\n" +
          "✅ Siz barcha kanallarga obuna bo'lgansiz\\!\n\n" +
          "📭 Hozircha linklar qo'shilmagan\\.",
        { parse_mode: "MarkdownV2" }
      );
    } else {
      const linkButtons = links.map(link => [
        { text: `🔗 ${link.title}`, url: link.url }
      ]);

      bot.sendMessage(
        userId,
        "🎉 *Tabriklaymiz\\!*\n\n" +
          "✅ Siz barcha kanallarga obuna bo'lgansiz\\!\n\n" +
          "👇 *Foydali havolalar:*",
        {
          parse_mode: "MarkdownV2",
          reply_markup: { inline_keyboard: linkButtons }
        }
      );
    }
  }
}

// ===============================================
// 🎯 CALLBACK QUERIES
// ===============================================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const messageId = query.message.message_id;

  try {
    // Obunani tekshirish (har doim foydalanuvchi tomonidan bosilishi mumkin)
    if (data === "check_sub") {
      await bot.answerCallbackQuery(query.id, { text: "🔄 Tekshirilmoqda..." });
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await checkSubscription(chatId);
      return;
    }

    // Admin bo'lmasa boshqa admin funksiyalariga ruxsat yo'q
    if (chatId.toString() !== ADMIN_ID) {
      await bot.answerCallbackQuery(query.id, { text: "❌ Ruxsat yo'q!" });
      return;
    }

    // Kanal o'chirish
    if (data.startsWith("del_ch_")) {
      const index = parseInt(data.split("_")[2], 10);
      const channels = readJSON(CHANNELS_FILE);
      if (channels[index]) {
        const removed = channels.splice(index, 1)[0];
        writeJSON(CHANNELS_FILE, channels);
        await bot.answerCallbackQuery(query.id, { text: "✅ O'chirildi!" });
        await bot.editMessageText(
          `✅ *Kanal o'chirildi*\n\n📢 ${escapeMarkdown(removed)}\n\n📊 Qolgan kanallar: ${channels.length}`,
          { chat_id: chatId, message_id: messageId, parse_mode: "MarkdownV2" }
        );
      } else {
        await bot.answerCallbackQuery(query.id, { text: "❌ Kanal topilmadi" });
      }
      return;
    }

    // Link o'chirish
    if (data.startsWith("del_link_")) {
      const index = parseInt(data.split("_")[2], 10);
      const links = readJSON(LINKS_FILE);
      if (links[index]) {
        const removed = links.splice(index, 1)[0];
        writeJSON(LINKS_FILE, links);
        await bot.answerCallbackQuery(query.id, { text: "✅ O'chirildi!" });
        await bot.editMessageText(
          `✅ *Link o'chirildi*\n\n📌 ${escapeMarkdown(removed.title)}\n🔗 ${escapeMarkdown(removed.url)}\n\n📊 Qolgan linklar: ${links.length}`,
          { chat_id: chatId, message_id: messageId, parse_mode: "MarkdownV2" }
        );
      } else {
        await bot.answerCallbackQuery(query.id, { text: "❌ Link topilmadi" });
      }
      return;
    }

    // Tozalash: kanallar
    if (data === "clean_channels") {
      writeJSON(CHANNELS_FILE, []);
      await bot.answerCallbackQuery(query.id, { text: "✅ Kanallar tozalandi!" });
      await bot.editMessageText("🧹 *Barcha kanallar tozalandi\\.*", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2"
      });
      return;
    }

    // Tozalash: linklar
    if (data === "clean_links") {
      writeJSON(LINKS_FILE, []);
      await bot.answerCallbackQuery(query.id, { text: "✅ Linklar tozalandi!" });
      await bot.editMessageText("🧹 *Barcha linklar tozalandi\\.*", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2"
      });
      return;
    }

    // Tozalash: foydalanuvchilar
    if (data === "clean_users") {
      writeJSON(USERS_FILE, []);
      await bot.answerCallbackQuery(query.id, { text: "✅ Foydalanuvchilar tozalandi!" });
      await bot.editMessageText("🧹 *Barcha foydalanuvchilar tozalandi\\.*", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "MarkdownV2"
      });
      return;
    }

    // Tozalash: hammasi
    if (data === "clean_all") {
      writeJSON(CHANNELS_FILE, []);
      writeJSON(LINKS_FILE, []);
      writeJSON(USERS_FILE, []);
      await bot.answerCallbackQuery(query.id, { text: "✅ Hammasi tozalandi!" });
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      await bot.sendMessage(chatId, "🧹 *Barcha ma'lumotlar tozalandi\\.*", { parse_mode: "MarkdownV2" });
      return;
    }

    // Hech nima (faqat ko'rsatish uchun yaratilgan) — oddiy javob
    if (data === "none") {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Bekor qilish
    if (data === "cancel_clean") {
      await bot.answerCallbackQuery(query.id, { text: "❌ Bekor qilindi" });
      try { await bot.deleteMessage(chatId, messageId); } catch {}
      return;
    }

    // Agar noto'g'ri callback yetib kelsa
    await bot.answerCallbackQuery(query.id, { text: "❌ Noma'lum amal" });
  } catch (err) {
    console.error("Callback error:", err);
    try { await bot.answerCallbackQuery(query.id, { text: "❌ Xato yuz berdi" }); } catch {}
  }
});

// Xatolarni ushlash va loglash
bot.on("polling_error", (error) => {
  console.error("❌ Polling error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled rejection:", error);
});