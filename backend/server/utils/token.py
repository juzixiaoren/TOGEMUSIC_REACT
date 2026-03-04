import secrets

# 生成token，默认长度为50
def generate_token(length=50):
    return secrets.token_urlsafe(length)[:length]

# 示例
if __name__ == "__main__":
    print(generate_token())  # 生成并打印一个 50 位的 token