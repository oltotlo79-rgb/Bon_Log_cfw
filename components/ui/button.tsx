import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-250 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-washi hover:shadow-washi-hover hover:bg-primary/90 active:shadow-sm",

        destructive:
          "bg-destructive text-white shadow-washi hover:shadow-washi-hover hover:bg-destructive/90 active:shadow-sm focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",

        outline:
          "border border-border/60 bg-card shadow-washi hover:bg-muted/50 hover:border-primary/40 hover:shadow-washi-hover dark:bg-input/30 dark:border-input dark:hover:bg-input/50",

        secondary:
          "bg-secondary text-secondary-foreground shadow-washi hover:bg-secondary/70 hover:shadow-washi-hover border border-border/30",

        ghost:
          "hover:bg-muted/60 hover:text-foreground dark:hover:bg-accent/50",

        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",

        // BON-LOG ブランドカラー（松葉色）の塗りつぶし CTA。
        // text 色を `text-white` で固定し、theme による `primary-foreground` の
        // 自動切替（ダーク時に黒文字になる）に巻き込まれないようにする。
        // ダークモードでも視認できるよう `--bonsai-green` は globals.css の
        // .dark で明るめに再定義済み。
        bonsai:
          "bg-bonsai-green text-white shadow-washi hover:bg-bonsai-green/90 hover:shadow-washi-hover active:shadow-sm",
      },

      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-11 rounded-lg px-7 has-[>svg]:px-5 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
