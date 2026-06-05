"""
Puppeteer登录工具：用于QQ音乐等平台的自动登录
通过后端启动Puppeteer浏览器，用户在浏览器中登录，后端自动获取Cookie
"""

import os
import json
import time
import subprocess
import tempfile
from typing import Optional


def run_qqmusic_login(timeout: int = 300) -> Optional[dict]:
    """
    启动QQ音乐登录流程
    返回 {'cookie': str, 'is_vip': bool} 字典，超时或失败返回None
    """
    script_path = os.path.join(os.path.dirname(__file__), 'puppeteer_scripts', 'qqmusic_login.js')

    # 检查脚本是否存在
    if not os.path.exists(script_path):
        print(f"❌ Puppeteer脚本不存在: {script_path}")
        return None

    # 创建临时文件用于接收cookie
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        output_path = f.name

    try:
        # 启动Puppeteer进程
        env = os.environ.copy()
        env['OUTPUT_FILE'] = output_path
        env['LOGIN_TIMEOUT'] = str(timeout * 1000)  # 转换为毫秒

        process = subprocess.Popen(
            ['node', script_path],
            env=env,
            stdout=None,  # 直接输出到终端，方便查看日志
            stderr=None,
            text=True
        )

        # 等待进程完成或超时
        try:
            process.wait(timeout=timeout)
            if process.returncode != 0:
                print(f"❌ Puppeteer进程退出码: {process.returncode}")
                return None
        except subprocess.TimeoutExpired:
            process.kill()
            print("❌ Puppeteer登录超时")
            return None

        # 读取结果
        if os.path.exists(output_path):
            with open(output_path, 'r') as f:
                result = json.load(f)
            cookie = result.get('cookie')
            is_vip = result.get('is_vip', False)
            if cookie:
                print(f"✅ Puppeteer获取Cookie成功，长度: {len(cookie)}，VIP: {is_vip}")
                return {'cookie': cookie, 'is_vip': is_vip}
            else:
                print("⚠️ Puppeteer未返回Cookie")
                return None
        else:
            print("❌ 输出文件不存在")
            return None

    finally:
        # 清理临时文件
        try:
            os.unlink(output_path)
        except OSError:
            pass


def run_netease_login(timeout: int = 300) -> Optional[dict]:
    """
    启动网易云音乐登录流程
    返回 {'cookie': str, 'uid': str} 字典，超时或失败返回None
    """
    script_path = os.path.join(os.path.dirname(__file__), 'puppeteer_scripts', 'netease_login.js')
    
    # 检查脚本是否存在
    if not os.path.exists(script_path):
        print(f"❌ Puppeteer脚本不存在: {script_path}")
        return None
    
    # 创建临时文件用于接收cookie
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        output_path = f.name
    
    try:
        # 启动Puppeteer进程
        env = os.environ.copy()
        env['OUTPUT_FILE'] = output_path
        env['LOGIN_TIMEOUT'] = str(timeout * 1000)  # 转换为毫秒
        
        process = subprocess.Popen(
            ['node', script_path],
            env=env,
            stdout=None,  # 直接输出到终端，方便查看日志
            stderr=None,
            text=True
        )
        
        # 等待进程完成或超时
        try:
            process.wait(timeout=timeout)
            if process.returncode != 0:
                print(f"❌ Puppeteer进程退出码: {process.returncode}")
                return None
        except subprocess.TimeoutExpired:
            process.kill()
            print("❌ Puppeteer登录超时")
            return None
        
        # 读取结果
        if os.path.exists(output_path):
            with open(output_path, 'r') as f:
                result = json.load(f)
            cookie = result.get('cookie')
            uid = result.get('uid')
            if cookie:
                print(f"✅ Puppeteer获取Cookie成功，长度: {len(cookie)}，UID: {uid}")
                return {'cookie': cookie, 'uid': uid}
            else:
                print("⚠️ Puppeteer未返回Cookie")
                return None
        else:
            print("❌ 输出文件不存在")
            return None
    
    finally:
        # 清理临时文件
        try:
            os.unlink(output_path)
        except OSError:
            pass


def check_puppeteer_available() -> bool:
    """检查Puppeteer是否可用"""
    try:
        result = subprocess.run(
            ['node', '-e', 'require("puppeteer")'],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


if __name__ == '__main__':
    # 测试Puppeteer是否可用
    available = check_puppeteer_available()
    print(f"Puppeteer可用: {available}")