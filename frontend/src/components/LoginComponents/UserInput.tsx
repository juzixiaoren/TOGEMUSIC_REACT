import { IconUser } from "@arco-design/web-react/icon";
import { IconLock } from "@arco-design/web-react/icon";

const inputClass = "box-border w-full h-[50px] border-0 rounded-[30px] text-sm border-y-2 border-solid bg-input-bg border-input-border shadow-input text-black transition-[0.3s] pl-[42px] pr-4 outline-none hover:border-white/80 hover:bg-input-focus-bg focus:border-white/80 focus:bg-input-focus-bg placeholder:text-white/70";
const iconClass = "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-text-tertiary pointer-events-none [&_svg]:w-full [&_svg]:h-full";

export function UserNameInput({ ref, name, handleChange, handleKeyDown }: { ref: React.RefObject<HTMLInputElement | null>, name: string, handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void, handleKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
    return (
        <div className="relative w-full">
            <input
                className={inputClass}
                type="text"
                ref={ref}
                value={name}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="请输入用户名"
            />
            <div className={iconClass}>
                <IconUser />
            </div>
        </div>
    )
}
export function UserPasswordInput({ ref, password, handleChange, handleKeyDown }: { ref: React.RefObject<HTMLInputElement | null>, password: string, handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void, handleKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void }) {
    return (
        <div className="relative w-full">
            <input
                className={inputClass}
                type="password"
                ref={ref}
                value={password}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="请输入密码"
            />
            <div className={iconClass}>
                <IconLock />
            </div>
        </div>
    )
}