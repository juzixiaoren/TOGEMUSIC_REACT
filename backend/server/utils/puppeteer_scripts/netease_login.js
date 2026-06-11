/**
 * 网易云音乐 Puppeteer 登录脚本
 * 启动浏览器 → 打开网易云登录页 → 用户登录 → 获取Cookie → 写入输出文件
 * 支持headless模式，通过Socket.IO发送截图到前端
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const io = require('socket.io-client');

const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'netease_cookie.json');
const LOGIN_TIMEOUT = parseInt(process.env.LOGIN_TIMEOUT) || 300000; // 默认5分钟
const NETEASE_URL = 'https://music.163.com/#/login';

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
        userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-netease-'));
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

        console.log('📍 打开网易云音乐登录页...');
        
        // 访问网易云登录页
        await page.goto(NETEASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('✅ 登录页已加载');
        
        // 如果是headless模式，开始定期截图（每8秒一次）
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
                        '.qrcode-img img',
                        '.qrimg img',
                        '#qrcode img',
                        'img[src*="qr"]',
                        'img[class*="qr"]',
                        '.login-qr img',
                        '.qr-box img',
                        'img[alt*="二维码"]',
                        'img[alt*="QR"]'
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
                            platform: 'netease',
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
                    
                    // 通知前端登录成功
                    if (socket && socket.connected) {
                        socket.emit('login_status_update', {
                            platform: 'netease',
                            status: 'success'
                        });
                        console.log('✅ 已通知前端登录成功');
                    }
                    
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
        
        // 强制退出，避免 Node.js 清理等待
        process.exit(0);
    }
}

main().catch(console.error);
