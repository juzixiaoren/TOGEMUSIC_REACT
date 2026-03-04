import type { MessageType } from "../../context/MessageContext";
export default function MessageBox({ message, type }: { message: string, type: MessageType }) {
    if (!message) return null;
    return (
        <div className={`message-box ${type}`}>{message}</div>
    )
}
