interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="date-stamp" role="separator" aria-label={`Messages from ${date}`}>
      {date}
    </div>
  );
}
