import { Extension, InputRule } from '@tiptap/react'

// Obsidian / GitHub style "- [ ] ": typing "- " already turned the line into a bullet
// item, so the built-in "[ ] " rule (which only works outside lists) never fires.
// Turn that bullet item into a task item instead.
export const BulletToTask = Extension.create({
  name: 'bulletToTask',
  addInputRules() {
    return [
      new InputRule({
        find: /^\s*\[([ xX])?\]\s$/,
        handler: ({ state, range, match, chain }) => {
          const $from = state.doc.resolve(range.from)
          if ($from.depth < 2 || $from.node(-1).type.name !== 'listItem' || $from.node(-2).type.name !== 'bulletList') return null
          chain()
            .deleteRange(range)
            .toggleTaskList()
            .updateAttributes('taskItem', { checked: match[1]?.toLowerCase() === 'x' })
            .run()
        },
      }),
    ]
  },
})
