// components/lead-match/ui/EmptyState.tsx
"use client";

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
      <div className="mx-auto max-w-[520px]">
        <div className="text-base font-semibold text-neutral-900">{title}</div>
        {description ? <div className="mt-2 text-sm text-neutral-600">{description}</div> : null}
        {actionLabel && onAction ? (
          <button
            onClick={onAction}
            className="mt-5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
