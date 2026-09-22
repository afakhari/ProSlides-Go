import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-content-inverse shadow-sm hover:bg-brand-strong",
        destructive:
          "bg-danger text-content-inverse shadow-sm hover:brightness-95",
        outline:
          "border border-border-subtle bg-surface text-content shadow-sm hover:bg-brand-soft hover:text-brand-ink",
        secondary:
          "bg-brand-soft text-brand-ink shadow-sm hover:bg-brand-muted",
        ghost:
          "text-content hover:bg-brand-soft hover:text-brand-ink",
        link:
          "text-brand underline-offset-4 hover:text-brand-strong hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
