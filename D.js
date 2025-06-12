const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = '7788393868:AAFOisZFeTffke4boWzskHuodGj6tr3UYcM';
const CHANNEL_USERNAME = '@HAVIJ0STORE';

const SUPPORT_USERS = ['@Havij_V1', '@Depressvc'];

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  try {
    // بررسی عضویت در کانال
    const member = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);

    if (member.status === 'left' || member.status === 'kicked') {
      return ctx.reply(`برای استفاده از ربات ابتدا باید در کانال ${CHANNEL_USERNAME} عضو شوید.`);
    }
  } catch (error) {
    return ctx.reply('خطا در بررسی عضویت شما در کانال، لطفا دوباره تلاش کنید.');
  }

  // نمایش دکمه‌ها
  return ctx.reply(
    'سلام! یکی از گزینه‌ها را انتخاب کن:',
    Markup.inlineKeyboard([
      [Markup.button.callback('پشتیبانی', 'support')],
      [Markup.button.callback('اطلاعات‌یاب', 'info_finder')],
    ])
  );
});

bot.action('support', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `برای ارتباط با پشتیبانی از این اکانت‌ها استفاده کنید:\n${SUPPORT_USERS.join('\n')}`
  );
});

bot.action('info_finder', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('لطفا یوزرنیم (مثلا @username) مورد نظر را ارسال کنید:');
  // ست کردن حالت انتظار دریافت یوزرنیم
  ctx.session = ctx.session || {};
  ctx.session.awaitingUsername = true;
});

bot.on('text', async (ctx) => {
  ctx.session = ctx.session || {};
  if (ctx.session.awaitingUsername) {
    const username = ctx.message.text.trim();
    if (!username.startsWith('@')) {
      return ctx.reply('لطفا یوزرنیم را با @ وارد کنید.');
    }

    // اینجا می‌تونی اطلاعات واقعی رو بذاری یا API های دیگه وصل کنی
    const info = `یوزرنیم ${username} در کانال‌ها و گروه‌های پابلیک زیر عضو است:\n- گروه تست ۱\n- کانال تست ۲`;
    await ctx.reply(info);

    ctx.session.awaitingUsername = false;
  } else {
    await ctx.reply('لطفا ابتدا /start را بزنید.');
  }
});

bot.launch();

console.log('Bot is running...');
