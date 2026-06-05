/**
 * 网易云音乐 Puppeteer 登录脚本
 * 启动浏览器 → 打开网易云登录页 → 用户登录 → 获取Cookie → 写入输出文件
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'netease_cookie.json');
const LOGIN_TIMEOUT = parseInt(process.env.LOGIN_TIMEOUT) || 300000; // 默认5分钟
const NETEASE_URL = 'https://music.163.com/#/login';

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

        console.log('📍 打开网易云音乐登录页...');
        
        // 访问网易云登录页
        await page.goto(NETEASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ 登录页已加载');
        
        // 等待用户登录完成
        console.log('👤 请在浏览器中完成网易云音乐登录（扫码/手机/邮箱）...');
        console.log(`⏱️  登录超时时间: ${LOGIN_TIMEOUT / 1000}秒`);

        const startTime = Date.now();
        let cookie = null;
        let uid = null;
        let checkCount = 0;

        while (Date.now() - startTime < LOGIN_TIMEOUT) {
            checkCount++;
            
            try {
                // 检查是否已登录：Cookie中包含 MUSIC_U
                const cookies = await page.cookies();
                const musicUCookie = cookies.find(c => c.name === 'MUSIC_U' && c.value);

                if (musicUCookie) {
                    console.log('🎉 检测到登录成功！');

                    // 获取所有Cookie
                    const cookieString = cookies
                        .map(c => `${c.name}=${c.value}`)
                        .join('; ');

                    // 尝试从Cookie中提取uid
                    const csrfCookie = cookies.find(c => c.name === '__csrf');
                    
                    cookie = cookieString;
                    
                    // 尝试通过API获取uid
                    try {
                        const accountResp = await page.evaluate(async () => {
                            const resp = await fetch('https://music.163.com/api/nuser/account/get', {
                                credentials: 'include'
                            });
                            return resp.json();
                        });
                        if (accountResp && accountResp.profile && accountResp.profile.userId) {
                            uid = String(accountResp.profile.userId);
                            console.log(`用户ID: ${uid}`);
                        }
                    } catch (e) {
                        console.log('⚠️ 获取用户ID失败，将通过后端API获取');
                    }
                    
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
            // 写入输出文件
            const result = {
                cookie: cookie,
                uid: uid || '',
                timestamp: new Date().toISOString(),
                source: 'puppeteer'
            };
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
            console.log(`✅ Cookie已保存到: ${OUTPUT_FILE}`);
        } else {
            console.log('⚠️ 登录超时或未获取到Cookie');
            // 写入空结果
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ cookie: null, uid: '', error: 'timeout' }, null, 2));
        }

    } catch (error) {
        console.error('❌ 登录过程出错:', error.message);
        console.error('   错误详情:', error.stack);
        // 写入错误结果
        try {
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
                cookie: null,
                uid: '',
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
        // 强制退出，避免 Node.js 清理等待
        process.exit(0);
    }
}

main().catch(console.error);
