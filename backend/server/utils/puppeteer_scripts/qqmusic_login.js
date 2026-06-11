/**
 * QQ音乐Puppeteer登录脚本
 * 启动浏览器 → 打开QQ音乐登录页 → 用户登录 → 获取Cookie → 写入输出文件
 * 支持headless模式，通过Socket.IO发送截图到前端
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const io = require('socket.io-client');

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'qqmusic_cookie.json');
const LOGIN_TIMEOUT = parseInt(process.env.LOGIN_TIMEOUT) || 300000; // 默认5分钟
const QQMUSIC_URL = 'https://y.qq.com';
const QQ_LOGIN_URL = 'https://y.qq.com/portal/login.html';

// 获取Chrome/Chromium路径
function getChromePath() {
    const os = require('os');
    
    // 1. 优先使用环境变量（Docker容器中设置）
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    
    // 2. macOS 使用系统 Chrome
    if (os.platform() === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    
    // 3. 其他系统使用 Puppeteer 默认（会自动下载Chromium）
    return undefined;
}

async function main() {
    let browser = null;
    let socket = null;
    let screenshotInterval = null;
    let userDataDir = null;
    
    try {
        console.log('🚀 启动浏览器...');

        const chromePath = getChromePath();
        console.log(`Chrome路径: ${chromePath || 'Puppeteer默认'}`);

        // 检查是否使用headless模式
        const isHeadless = process.env.PUPPETEER_HEADLESS === 'true';
        console.log(`Headless模式: ${isHeadless}`);

        // 创建临时用户数据目录，确保浏览器会话隔离
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-qqmusic-'));
        console.log(`用户数据目录: ${userDataDir}`);

        browser = await puppeteer.launch({
            headless: isHeadless ? 'new' : false,
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-gpu',
                '--window-size=1200,800',
                `--user-data-dir=${userDataDir}`,
            ],
            defaultViewport: { width: 1200, height: 800 },
        });

        // 如果是headless模式，连接Socket.IO发送截图
        if (isHeadless) {
            const socketUrl = process.env.SOCKET_URL || 'http://localhost:8034';
            const authToken = process.env.AUTH_TOKEN || '';
            
            console.log(`🔗 连接Socket.IO: ${socketUrl}`);
            socket = io(socketUrl, {
                auth: { token: authToken },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 3000,
            });
            
            socket.on('connect', () => {
                console.log('✅ Socket.IO已连接');
            });
            
            socket.on('connect_error', (error) => {
                console.error('❌ Socket.IO连接失败:', error.message);
            });
            
            socket.io.on('reconnect_failed', () => {
                console.error('❌ Socket.IO重连失败，已达最大重试次数');
            });
        }

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

        // 如果是headless模式，开始定期截图（先立即截图，之后每8秒一次）
        console.log(`检查截图条件: isHeadless=${isHeadless}, socket=${socket ? '存在' : '不存在'}`);
        if (isHeadless && socket) {
            console.log('📸 开始截图模式（先立即截图，之后每8秒一次）');
            
            const SCREENSHOT_TIMEOUT = 5000;
            
            const withTimeout = (promise, ms) => Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('截图超时')), ms))
            ]);
            
            // 截图函数
            const takeScreenshot = async () => {
                try {
                    if (page.isClosed()) return;
                    
                    let screenshot = null;
                    
                    const qrSelectors = [
                        '.qrlogin_img_out',
                        '#qr-box img',
                        '.qr-box img',
                        '.login_qr_img img',
                        '#login_qr_img img',
                        'img[src*="qr"]',
                        'img[class*="qr"]',
                        '.qrcode-img',
                        '#qrcode img'
                    ];
                    
                    for (const selector of qrSelectors) {
                        try {
                            const qrElement = await withTimeout(page.$(selector), SCREENSHOT_TIMEOUT);
                            if (qrElement) {
                                screenshot = await withTimeout(qrElement.screenshot({
                                    encoding: 'base64',
                                    type: 'jpeg',
                                    quality: 90
                                }), SCREENSHOT_TIMEOUT);
                                console.log(`✅ 截取到二维码元素: ${selector}`);
                                break;
                            }
                        } catch (e) {
                            // 选择器失败或超时，继续尝试下一个
                        }
                    }
                    
                    if (!screenshot) {
                        const viewport = page.viewport();
                        const centerX = viewport.width / 2;
                        const centerY = viewport.height / 2;
                        const clipSize = 400;
                        
                        screenshot = await withTimeout(page.screenshot({
                            encoding: 'base64',
                            type: 'jpeg',
                            quality: 90,
                            clip: {
                                x: Math.max(0, centerX - clipSize / 2),
                                y: Math.max(0, centerY - clipSize / 2),
                                width: clipSize,
                                height: clipSize
                            }
                        }), SCREENSHOT_TIMEOUT);
                        console.log('✅ 截取页面中心区域');
                    }
                    
                    if (screenshot && socket.connected) {
                        socket.emit('login_screenshot', {
                            platform: 'qqmusic',
                            screenshot: screenshot
                        });
                    }
                } catch (e) {
                    console.error('❌ 截图失败:', e.message);
                }
            };
            
            // 不 await，避免首次截图挂起阻塞 setInterval 设置
            takeScreenshot();
            
            // 设置定时器，每8秒截图一次
            screenshotInterval = setInterval(takeScreenshot, 8000);
        }

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
                    
                    // 通知前端登录成功
                    if (socket && socket.connected) {
                        socket.emit('login_status_update', {
                            platform: 'qqmusic',
                            status: 'success'
                        });
                        console.log('✅ 已通知前端登录成功');
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
        // 清理截图定时器
        if (screenshotInterval) {
            clearInterval(screenshotInterval);
            screenshotInterval = null;
        }
        
        // 关闭Socket.IO连接
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        if (browser) {
            console.log('🔄 正在关闭浏览器...');
            try {
                await browser.close();
                console.log('✅ 浏览器已关闭');
            } catch (closeErr) {
                console.error('关闭浏览器时出错:', closeErr.message);
            }
        }
        
        // 清理临时用户数据目录
        if (userDataDir) {
            try {
                fs.rmSync(userDataDir, { recursive: true, force: true });
                console.log('✅ 临时用户数据目录已清理');
            } catch (e) {
                console.error('清理临时目录失败:', e.message);
            }
        }
    }
}

main().catch(console.error);