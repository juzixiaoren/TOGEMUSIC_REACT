import bcrypt

# 加密密码hash256
def hash_password(password):
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

# 验证密码，仅返回是否正确
def verify_password(input_password, hashed_password):
    return bcrypt.checkpw(input_password.encode(), hashed_password.encode())