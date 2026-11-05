export function RefreshIcon(props: { busy: boolean }) {
  return (
    <svg
      classList={{ "cu-spinning": props.busy }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 4v5h-5" />
      <path d="M20 9a8 8 0 1 0 .2 5M20 9l-3-3" />
    </svg>
  )
}

export function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m7 14 5-5 5 5" />
    </svg>
  )
}
