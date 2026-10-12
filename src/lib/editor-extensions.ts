// The rich-text schema shared by the Editor component and the Markdown export,
// so exported Markdown matches exactly what the editor stores.
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Markdown } from '@tiptap/markdown'
import type { AnyExtension } from '@tiptap/react'
import { createLowlight, common } from 'lowlight'
import { BulletToTask } from './editor-task-input'
import { Tag, WikiLink } from './editor-wiki'

const lowlight = createLowlight(common)

// `wikiLink` swaps in a variant of the [[link]] node (the export renders links to file names)
export function contentExtensions({ wikiLink = WikiLink }: { wikiLink?: AnyExtension } = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight
      link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https' },
    }),
    ImageExtension,
    TaskList,
    TaskItem.configure({ nested: true }),
    BulletToTask,
    CodeBlockLowlight.configure({ lowlight }),
    wikiLink,
    Tag,
    Markdown,
  ]
}
