"""
腾讯云 COS 存储封装
提供预签名上传/下载 URL 生成，以及文件上传功能。
"""
import os
import uuid
import time
from datetime import datetime

try:
    from qcloud_cos import CosConfig, CosS3Client
    COS_SDK_AVAILABLE = True
except ImportError:
    COS_SDK_AVAILABLE = False

# 从环境变量读取配置
_COS_SECRET_ID = os.getenv('COS_SECRET_ID', '')
_COS_SECRET_KEY = os.getenv('COS_SECRET_KEY', '')
_COS_BUCKET = os.getenv('COS_BUCKET', '')
_COS_REGION = os.getenv('COS_REGION', 'ap-guangzhou')
_COS_PRESIGN_EXPIRE = int(os.getenv('COS_PRESIGN_EXPIRE', '3600'))
_STORAGE_BACKEND = os.getenv('STORAGE_BACKEND', 'cos').lower()  # 'cos' 或 'local'


def is_cos_enabled() -> bool:
    """判断是否使用 COS 存储"""
    return (
        _STORAGE_BACKEND == 'cos'
        and COS_SDK_AVAILABLE
        and bool(_COS_SECRET_ID)
        and bool(_COS_SECRET_KEY)
        and bool(_COS_BUCKET)
    )


def _get_client() -> 'CosS3Client':
    """获取 COS 客户端实例"""
    if not COS_SDK_AVAILABLE:
        raise RuntimeError('cos-python-sdk-v5 未安装，请执行 pip install cos-python-sdk-v5')
    config = CosConfig(
        Region=_COS_REGION,
        SecretId=_COS_SECRET_ID,
        SecretKey=_COS_SECRET_KEY,
    )
    return CosS3Client(config)


def generate_cos_key(filename: str) -> str:
    """
    生成 COS 对象 key。
    格式: songs/{year}/{month}/{uuid}_{原始文件名}
    """
    now = datetime.now()
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else ''
    unique = uuid.uuid4().hex[:12]
    safe_name = filename.replace('/', '_').replace('\\', '_')
    return f"songs/{now.year}/{now.month:02d}/{unique}_{safe_name}"


def generate_presigned_upload_url(cos_key: str, expire: int = None) -> dict:
    """
    生成预签名上传 URL（PUT 方式）。
    返回 {'url': str, 'key': str, 'expire': int}
    """
    client = _get_client()
    exp = expire or _COS_PRESIGN_EXPIRE
    url = client.get_presigned_url(
        Method='PUT',
        Bucket=_COS_BUCKET,
        Key=cos_key,
        Expired=exp,
    )
    return {'url': url, 'key': cos_key, 'expire': exp}


def generate_presigned_download_url(cos_key: str, expire: int = None) -> str:
    """
    生成预签名下载 URL（GET 方式）。
    """
    client = _get_client()
    exp = expire or _COS_PRESIGN_EXPIRE
    url = client.get_presigned_url(
        Method='GET',
        Bucket=_COS_BUCKET,
        Key=cos_key,
        Expired=exp,
    )
    return url


def get_cos_public_url(cos_key: str) -> str:
    """
    拼接 COS 对象的完整 URL（不含签名，仅在桶公有读时可用）。
    """
    return f"https://{_COS_BUCKET}.cos.{_COS_REGION}.myqcloud.com/{cos_key}"


def delete_cos_object(cos_key: str) -> bool:
    """
    删除 COS 对象。
    返回 True 表示成功，False 表示失败。
    """
    try:
        client = _get_client()
        client.delete_object(
            Bucket=_COS_BUCKET,
            Key=cos_key,
        )
        return True
    except Exception as e:
        print(f"删除 COS 对象失败: {e}")
        return False


def extract_cos_key_from_path(stored_path: str) -> str:
    """
    从数据库存储的 file_path 中提取 COS key。
    约定格式: "cos:songs/2024/06/xxx.mp3"
    """
    if stored_path.startswith('cos:'):
        return stored_path[4:]
    return stored_path
