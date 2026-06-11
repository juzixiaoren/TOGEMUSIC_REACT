import { useState, useEffect, useRef } from "react";
import axios from "axios"
import type { e, ek } from "../../types/alltypes";
import { UserNameInput, UserPasswordInput } from "./UserInput";
import { useNavigate } from "react-router-dom";
import { useMessage } from "../../context/MessageContext";

export default function LoginContainer({ toggleView }: { toggleView: () => void }) {
    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [userNameError, setUserNameError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const { setMessage } = useMessage();
    const navigate = useNavigate();
    const idInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const validateUserName = () => {
        if (!userId) {
            setUserNameError("用户名不能为空");
            idInputRef.current?.focus();
            return false;
        } else if (userId.length > 10) {
            setUserNameError("用户名不能超过10个字符");
            idInputRef.current?.focus();
            return false;
        }
        setUserNameError("");
        return true;
    };
    const validatePassword = () => {
        const passwordRegex = /^[a-zA-Z0-9]*$/;
        if (!password) {
            setPasswordError("密码不能为空");
            passwordInputRef.current?.focus();
            return false;
        } else if (!passwordRegex.test(password)) {
            setPasswordError("密码只能包含字母和数字");
            passwordInputRef.current?.focus();
            return false;
        } else if (password.length < 6 || password.length > 20) {
            setPasswordError("密码长度必须在6-20个字符之间");
            passwordInputRef.current?.focus();
            return false;
        }
        setPasswordError("");
        return true;
    };
    const submitLogin = async () => {
        const validUserName = validateUserName();
        const validPassword = validatePassword();
        if (!validUserName || !validPassword) {
            setMessage("请检查输入的用户名和密码", "error");
            return;
        }
        try {
            const response = await axios.post("/login", {
                userId,
                password
            });
            if (response.data.success) {
                setMessage("登录成功", "success");
                localStorage.setItem("userId", userId);
                localStorage.setItem("token", response.data.token);
                localStorage.setItem("role", response.data.role);
                navigate('/home');
            }
            else {
                setMessage(response.data.message || "登录失败，请检查用户名和密码", "error");
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            if (err.response) {
                setMessage(err.response.data?.message || "登录失败，请检查用户名和密码", "error");
            }
            else {
                setMessage("登录失败，请检查网络连接", "error");
            }
        }
    };
    const handleEnterKey = (e: ek, field: string) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (field === "userId") {
                if (validateUserName()) {
                    passwordInputRef.current?.focus();
                }
            }
            else if (field === "password") {
                submitLogin();
            }
        }
    };
    useEffect(() => {
        idInputRef.current?.focus();
    }, []);
    const handleNameChange = (e: e) => {
        setUserId(e.target.value);
    }
    const handlePasswordChange = (e: e) => {
        setPassword(e.target.value);
    }
    const errorClass = "mt-1.5 ml-1.5 text-error text-xs leading-[1.3] min-h-4";
    const loginBtnClass = "box-border w-[150px] h-[45px] text-base font-bold text-white rounded-lg border-y-2 border-solid bg-error-btn-bg border-error-btn-border hover:shadow-focus-red transition-[0.5s]";
    const registerBtnClass = "box-border w-[150px] h-[45px] text-base font-bold text-white rounded-lg border-y-2 border-solid bg-register-bg border-register-border hover:shadow-focus-blue transition-[0.5s]";

    return (
        <div className="flex flex-col justify-center">
            <h2 className="ml-[60px] mb-5 text-3xl font-bold">登录</h2>
            <div className="w-full">
                <div className="w-[60%] ml-[60px] mb-3.5">
                    <UserNameInput
                        ref={idInputRef}
                        name={userId}
                        handleChange={handleNameChange}
                        handleKeyDown={(event) => handleEnterKey(event, "userId")}
                    />
                    {userNameError && <div className={errorClass}>{userNameError}</div>}
                </div>

                <div className="w-[60%] ml-[60px] mb-3.5">
                    <UserPasswordInput
                        ref={passwordInputRef}
                        password={password}
                        handleChange={handlePasswordChange}
                        handleKeyDown={(event) => handleEnterKey(event, "password")}
                    />
                    {passwordError && <div className={errorClass}>{passwordError}</div>}
                </div>

                <div className="flex gap-3 ml-[60px] mt-2">
                    <button className={loginBtnClass} onClick={submitLogin}>登录</button>
                    <button className={registerBtnClass} onClick={toggleView}>注册</button>
                </div>
            </div>
        </div>
    )
}