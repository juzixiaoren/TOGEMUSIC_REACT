import { useState, useEffect, useRef } from "react";
import axios from "axios"
import type { e, ek } from "../../types/alltypes";
import { UserNameInput, UserPasswordInput } from "../LoginComponents/UserInput";
import { useMessage } from "../../context/MessageContext";
import "../LoginComponents/LoginContainer.css";
export default function RegisterContainer({ toggleView }: { toggleView: () => void }) {
    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [userNameError, setUserNameError] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const { setMessage } = useMessage();
    const idInputRef = useRef<HTMLInputElement>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);
    const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
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
    const validateConfirmPassword = () => {
        if (confirmPassword !== password) {
            setConfirmPasswordError("两次输入的密码不一致");
            return false;
        }
        else {
            setConfirmPasswordError("");
            return true;
        }
    }
    const submitRegister = async () => {
        const validUserName = validateUserName();
        const validPassword = validatePassword();
        const validConfirmPassword = validateConfirmPassword();
        if (!validUserName || !validPassword) {
            setMessage("请检查输入的用户名和密码", "error");
            return;
        }
        else if (!validConfirmPassword) {
            setMessage("两次输入的密码不一致", "error");
            return;
        }
        try {
            const response = await axios.post("/register", {
                userId,
                password
            });
            if (response.data.success) {
                setMessage("注册成功，请登录", "success");
                toggleView();
            }
            else {
                setMessage(response.data.message || "注册失败，请稍后重试", "error");
            }
        } catch (error: any) {
            if (error.response) {
                setMessage(error.response.data.message || "注册失败，请稍后重试", "error");
            }
            else {
                setMessage("注册失败，请检查网络连接", "error");
            }
        }
    };
    const handleEnterKey = (e: ek, field: string) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (field === "userId") {
                validateUserName() && passwordInputRef.current?.focus();
            }
            else if (field === "password") {
                validatePassword() && confirmPasswordInputRef.current?.focus();
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
    const handleConfirmPasswordChange = (e: e) => {
        setConfirmPassword(e.target.value);
    }
    return (
        <div className="loginContainer">
            <h2>注册</h2>
            <div className="inputContainer">
                <div className="fieldBlock">
                    <UserNameInput
                        ref={idInputRef}
                        name={userId}
                        handleChange={handleNameChange}
                        handleKeyDown={(event) => handleEnterKey(event, "userId")}
                    />
                    {userNameError && <div className="errorMessage">{userNameError}</div>}
                </div>

                <div className="fieldBlock">
                    <UserPasswordInput
                        ref={passwordInputRef}
                        password={password}
                        handleChange={handlePasswordChange}
                        handleKeyDown={(event) => handleEnterKey(event, "password")}
                    />
                    {passwordError && <div className="errorMessage">{passwordError}</div>}
                </div>

                <div className="fieldBlock">
                    <UserPasswordInput
                        ref={confirmPasswordInputRef}
                        password={confirmPassword}
                        handleChange={handleConfirmPasswordChange}
                        handleKeyDown={(event) => handleEnterKey(event, "confirmPassword")}
                    />
                    {confirmPasswordError && <div className="errorMessage">{confirmPasswordError}</div>}
                </div>

                <div className="buttonRow">
                    <button className="loginButton" onClick={toggleView}>返回登录</button>
                    <button className="registerButton" onClick={submitRegister}>注册</button>
                </div>
            </div>
        </div>
    )
}