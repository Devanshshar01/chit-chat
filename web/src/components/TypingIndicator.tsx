interface TypingIndicatorProps {
  partnerName: string;
  visible: boolean;
}

export function TypingIndicator({ partnerName, visible }: TypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div className="typing-indicator" role="status" aria-live="polite" aria-label={`${partnerName} is typing`}>
      {partnerName} is typing…
    </div>
  );
}
