export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      XiaoCai AI <span className="text-primary">小财 AI</span>
    </span>
  );
}
