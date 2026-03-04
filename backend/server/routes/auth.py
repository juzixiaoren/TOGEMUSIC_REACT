from flask import Blueprint, request, jsonify
from dao.user import User

auth_bp = Blueprint('auth', __name__)

# 登录路由
@auth_bp.route('/login', methods=['POST'])
def login():
    # 从前端读入数据
    data = request.json
    username = data.get('userId')
    password = data.get('password')
    
    user = User()
    user_data = user.find_user(username)  # 获取用户信息
    if user_data and user.verify_password(user_data, password): 
        token = user.generate_token(username)  # 生成 token
        user_id = user_data[0]  # user_data[0] 是 user_id
        user.online(user_id)  # 刷新在线状态
        return jsonify({"success": True, "message": "Login successful", "token": token, "role": user.get_user_role(user_id)})  # 返回成功响应
    return jsonify({"success": False, "message": "Invalid credentials"})  # 登录失败

# 注册路由
@auth_bp.route('/register', methods=['POST'])
def register():
    # 从前端读入数据
    data = request.json
    username = data.get('userId')
    password = data.get('password')
    
    user = User()
    if user.find_user(username):  # 判断用户是否存在
        return jsonify({"success": False, "message": "Username exists"})  # 注册失败，用户已存在
    
    # 正式注册用户
    user.create(username, password)
    token = user.generate_token(username)  # 注册成功后生成 Token
    user_id = user.find_user_id_by_username(username)
    user.assign_user_role(user_id)
    return jsonify({"success": True, "message": "Registration successful", "token": token})  # 返回成功响应

# 验证token
@auth_bp.route('/protected', methods=['GET'])
def protected():
    # 从请求头中获取 Authorization
    remote_token = request.headers.get('Authorization')

    if not remote_token:
        return jsonify({"success": False, "message": "缺少 Token"}), 401

    user = User()
    user_id = user.query_token(remote_token)  # 查询 Token 对应的用户 ID,如果 token 不符合就会返回 None

    if user_id is None:
        return jsonify({"success": False, "message": "Token 无效或已过期"}), 401

    user.online(user_id)  # 刷新在线状态
    return jsonify({"success": True, "message": "Token 验证成功", "user_id": user_id})