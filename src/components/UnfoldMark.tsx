interface UnfoldMarkProps {
  monochrome?: boolean;
  className?: string;
}

export function UnfoldMark({ monochrome = false, className = '' }: UnfoldMarkProps) {
  return <svg className={`unfold-mark ${monochrome ? 'monochrome' : ''} ${className}`} viewBox="0 0 256 256" fill="none" aria-hidden="true" focusable="false">
    <path className="mark-branch" d="M99 126 C129 121 139 82 157 76 M99 140 C128 145 140 179 159 183" strokeWidth="8" strokeLinecap="round" />
    <circle className="mark-satellite" cx="177" cy="72" r="24" />
    <circle className="mark-satellite small" cx="178" cy="185" r="18" />
    <circle className="mark-primary" cx="69" cy="133" r="33" />
  </svg>;
}
