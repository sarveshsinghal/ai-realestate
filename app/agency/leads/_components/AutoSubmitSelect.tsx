// app/agency/leads/_components/AutoSubmitSelect.tsx
"use client";

export default function AutoSubmitSelect(props: {
  name: string;
  defaultValue: string;
  className?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={props.name}
      defaultValue={props.defaultValue}
      className={props.className}
      aria-label={props["aria-label"]}
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (form) form.requestSubmit();
      }}
    >
      {props.children}
    </select>
  );
}
