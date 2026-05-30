"use client"

import { useEffect } from "react"

import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Unlink,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

type Props = {
  value: string
  onChange: (html: string) => void
  dir?: "ltr" | "rtl"
  ariaLabel?: string
}

/**
 * Minimal WYSIWYG editor for product copy (description / additional info).
 *
 * Stores HTML constrained to a small schema — paragraphs, bold/italic, H2/H3,
 * bullet & numbered lists, and links — which the storefront re-sanitises and
 * renders with `prose` styling (see `components/product/rich-text.tsx`).
 *
 * `value` is the controlled HTML string; an empty document is normalised to
 * `""` so the database never stores a stray `<p></p>`. External value changes
 * (e.g. the AI translate button) are synced in without re-emitting `onChange`.
 */
export function RichTextEditor({
  value,
  onChange,
  dir = "ltr",
  ariaLabel,
}: Props) {
  const editor = useEditor({
    // `immediatelyRender: false` avoids an SSR hydration mismatch in Next.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Drop the heavier nodes — keep the editor to inline copy + lists.
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        dir,
        role: "textbox",
        "aria-multiline": "true",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        class: cn(
          "prose prose-sm max-w-none min-h-28 px-3 py-2",
          "focus:outline-none",
          // Render editing text in the theme foreground (black in light mode)
          // instead of prose's default light gray — point prose's color vars
          // at the foreground token so it stays readable in both themes.
          "[--tw-prose-body:var(--color-foreground)] [--tw-prose-headings:var(--color-foreground)]",
          "[--tw-prose-bold:var(--color-foreground)] [--tw-prose-bullets:var(--color-foreground)] [--tw-prose-counters:var(--color-foreground)]",
          "prose-headings:font-heading prose-headings:tracking-wide",
          "prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML())
    },
  })

  // Sync external value changes (AI translate, form reset) into the editor
  // without firing onUpdate — guard on equality to avoid a render loop.
  useEffect(() => {
    if (!editor) return
    const current = editor.isEmpty ? "" : editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [editor, value])

  return (
    <div className="border-input focus-within:border-ring focus-within:ring-ring/30 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-2">
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = (editor.getAttributes("link").href as string) ?? ""
    const url = window.prompt("Link URL", previous)
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run()
  }

  return (
    <div className="border-input flex flex-wrap items-center gap-0.5 border-b p-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Heading"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Subheading"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
      >
        <Heading3 className="size-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton
        label="Link"
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <Link2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Remove link"
        active={false}
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}
      >
        <Unlink className="size-4" />
      </ToolbarButton>
    </div>
  )
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:bg-muted grid size-7 place-items-center rounded transition-colors disabled:pointer-events-none disabled:opacity-40",
        active && "bg-foreground text-background hover:bg-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="bg-border mx-1 h-5 w-px" aria-hidden="true" />
}
