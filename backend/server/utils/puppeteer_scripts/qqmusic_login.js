/**
 * QQ音乐Puppeteer登录脚本
 * 启动浏览器 → 打开QQ音乐登录页 → 用户登录 → 获取Cookie → 写入输出文件
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'qqmusic_cookie.json');
const LOGIN_TIMEOUT = parseInt(process.env.LOGIN_TIMEOUT) || 300000; // 默认5分钟
const QQMUSIC_URL = 'https://y.qq.com';
const QQ_LOGIN_URL = 'https://y.qq.com/portal/login.html';

// macOS 使用系统 Chrome
function getChromePath() {
    const os = require('os');
    if (os.platform() === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    return undefined; // 其他系统使用 Puppeteer 默认
}

async function main() {
    let browser = null;
    try {
        console.log('🚀 启动浏览器...');

        const chromePath = getChromePath();
        console.log(`Chrome路径: ${chromePath || 'Puppeteer默认'}`);

        browser = await puppeteer.launch({
            headless: false, // 显示浏览器窗口，让用户登录
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-gpu',
                '--window-size=1200,800',
            ],
            defaultViewport: { width: 1200, height: 800 },
        });

        console.log('✅ 浏览器已启动');

        const page = await browser.newPage();

        // 设置User-Agent
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // 监听页面错误
        page.on('error', err => console.error('页面错误:', err.message));
        page.on('pageerror', err => console.error('页面脚本错误:', err.message));

        console.log('📍 打开QQ音乐主页...');
        
        // 访问 QQ 音乐主页
        await page.goto(QQMUSIC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ 主页已加载');
        
        // 点击登录按钮
        console.log('🔍 查找登录按钮...');
        try {
            await page.waitForSelector('.top_login__link', { timeout: 5000 });
            await page.click('.top_login__link');
            console.log('✅ 已点击登录按钮');
        } catch (e) {
            console.log('⚠️ 未找到登录按钮，尝试其他选择器...');
            // 尝试其他可能的选择器
            const clicked = await page.evaluate(() => {
                const el = document.querySelector('[class*="login"] a, a[href*="login"], .login_btn');
                if (el) { el.click(); return true; }
                return false;
            });
            if (clicked) {
                console.log('✅ 已点击备选登录按钮');
            } else {
                console.log('⚠️ 未找到登录按钮，请手动点击');
            }
        }
        
        // 等待页面跳转或弹窗
        await new Promise(r => setTimeout(r, 2000));

        // 等待用户登录完成
        console.log('👤 请在浏览器中完成QQ音乐登录...');
        console.log(`⏱️  登录超时时间: ${LOGIN_TIMEOUT / 1000}秒`);

        const startTime = Date.now();
        let cookie = null;
        let checkCount = 0;

        while (Date.now() - startTime < LOGIN_TIMEOUT) {
            checkCount++;
            
            try {
                // 检查是否已登录：Cookie中包含uin且不为0
                const cookies = await page.cookies();
                const uinCookie = cookies.find(c => c.name === 'uin' && c.value && c.value !== '0');

                if (uinCookie) {
                    console.log('🎉 检测到登录成功！');

                    // 获取所有Cookie
                    const cookieString = cookies
                        .map(c => `${c.name}=${c.value}`)
                        .join('; ');

                    cookie = cookieString;
                    break;
                }

                // 每30秒打印一次状态
                if (checkCount % 30 === 0) {
                    console.log(`⏳ 等待登录中... (已等待 ${Math.floor((Date.now() - startTime) / 1000)} 秒)`);
                }
            } catch (e) {
                console.error('检查Cookie时出错:', e.message);
                // 如果页面已关闭，退出循环
                if (e.message.includes('Target closed') || e.message.includes('Session closed')) {
                    console.log('浏览器已关闭，退出等待');
                    break;
                }
            }

            // 等待1秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (cookie) {
            // 写入输出文件（VIP检测由Python端通过API完成，避免页面跳转延迟）
            const result = {
                cookie: cookie,
                timestamp: new Date().toISOString(),
                source: 'puppeteer'
            };
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
            console.log(`✅ Cookie已保存到: ${OUTPUT_FILE}`);
        } else {
            console.log('⚠️ 登录超时或未获取到Cookie');
            // 写入空结果
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ cookie: null, error: 'timeout' }, null, 2));
        }

    } catch (error) {
        console.error('❌ 登录过程出错:', error.message);
        console.error('   错误详情:', error.stack);
        // 写入错误结果
        try {
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
                cookie: null,
                error: error.message
            }, null, 2));
        } catch (writeErr) {
            console.error('写入错误文件失败:', writeErr.message);
        }
    } finally {
        if (browser) {
            console.log('🔄 正在关闭浏览器...');
            try {
                await browser.close();
                console.log('✅ 浏览器已关闭');
            } catch (closeErr) {
                console.error('关闭浏览器时出错:', closeErr.message);
            }
        }
    }
}

main().catch(console.error);