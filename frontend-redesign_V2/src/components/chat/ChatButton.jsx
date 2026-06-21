import { MessageCircle } from "lucide-react";

export default function ChatButton({ onClick }) {
  return (
  <button
    onClick={onClick}
    className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg"
  >
    <MessageCircle size={24} />
  </button>
);
}