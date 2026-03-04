import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import MessageBox from "../components/MessageBox/MessageBox";
export type MessageType = "success" | "error" | "warning";
interface MessageContextProps {
    setMessage: ((message: string, type: MessageType) => void);
}
const MessageContext = createContext<MessageContextProps | undefined>(undefined);
export const useMessage = () => {
    const context = useContext(MessageContext);
    if (!context) {
        throw new Error("useMessage must be used within a MessageProvider");
    }
    return context;
};
export const MessageProvider = ({ children }: { children: ReactNode }) => {
    const [messageState, setMessageState] = useState<{ message: string, type: MessageType }>({ message: "", type: "success" });
    const setMessage = (message: string, type: MessageType) => {
        setMessageState({ message, type });
    };
    return (
        <MessageContext.Provider value={{ setMessage }}>
            <MessageBox message={messageState.message} type={messageState.type} />
            {children}
        </MessageContext.Provider>
    )
};