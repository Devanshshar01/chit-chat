import { useRef, useState } from 'react';
import { Icon } from './Icon';

interface ReplyPreview { id: string; sender: string; text: string; }
interface MessageComposerProps { onSendMessage: (text: string) => void; replyPreview?: ReplyPreview | null; onCancelReply?: () => void; }

export function MessageComposer({ onSendMessage, replyPreview, onCancelReply }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const interval = useRef<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const send = () => { if (!text.trim()) return; onSendMessage(text.trim()); setText(''); if (input.current) input.current.style.height = 'auto'; };
  const startRecording = () => { setRecording(true); setSeconds(0); interval.current = window.setInterval(() => setSeconds((value) => value + 1), 1000); };
  const stopRecording = () => { setRecording(false); if (interval.current) clearInterval(interval.current); interval.current = null; if (seconds > 0) onSendMessage(`[Voice note · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}]`); };
  return <div className="composer-wrap">
    {replyPreview && <div className="reply-bar"><div><span>Replying to {replyPreview.sender}</span><p>{replyPreview.text}</p></div><button onClick={onCancelReply} aria-label="Cancel reply"><Icon name="close" size={18} /></button></div>}
    {recording ? <div className="recording-bar"><span className="recording-dot" /><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong><span>Recording voice note</span><button onClick={stopRecording}>Send</button></div> : <div className="composer">
      <button className="composer-icon" aria-label="Add attachment" title="Add attachment"><Icon name="plus" size={21} /></button>
      <div className="composer-input"><textarea ref={input} rows={1} value={text} placeholder="Write a message" aria-label="Write a message" onChange={(event) => { setText(event.target.value); event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 112)}px`; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} /><Icon name="smile" size={19} /></div>
      {text.trim() ? <button className="composer-send" onClick={send} aria-label="Send message"><Icon name="send" size={18} /></button> : <button className="composer-icon" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={() => recording && stopRecording()} onTouchStart={startRecording} onTouchEnd={stopRecording} aria-label="Hold to record voice note"><Icon name="mic" size={19} /></button>}
    </div>}
  </div>;
}
