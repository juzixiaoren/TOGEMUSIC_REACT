import { IconUser } from "@arco-design/web-react/icon";
import { IconLock } from "@arco-design/web-react/icon";
export function UserNameInput({ ref, name, handleChange, handleKeyDown }: { ref: React.RefObject<HTMLInputElement | null>, name: string, handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void, handleKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
    return (
        <div className="inputWrapper">
            <input
                className="customInput"
                type="text"
                ref={ref}
                value={name}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="请输入用户名"
            />
            <div className="inputIcon">
                <IconUser />
            </div>
        </div>
    )
}
export function UserPasswordInput({ ref, password, handleChange, handleKeyDown }: { ref: React.RefObject<HTMLInputElement | null>, password: string, handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void, handleKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
    return (
        <div className="inputWrapper">
            <input
                className="customInput"
                type="password"
                ref={ref}
                value={password}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="请输入密码"
            />
            <div className="inputIcon">
                <IconLock />
            </div>
        </div>
    )
}