import { Node, InputRule } from '@tiptap/react'
import { TAG_CHAR_CLASS } from './wiki'

// [[Note]] link: an atom holding the target note id and its title at link time
// (the API rewrites the label when that note is renamed)
export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      noteId: { default: null, parseHTML: el => Number(el.getAttribute('data-note-id')) || null, renderHTML: () => ({}) },
      label: { default: '', parseHTML: el => el.textContent || '', renderHTML: () => ({}) },
    }
  },

  // Above the Link mark's a[href] rule
  parseHTML() {
    return [{ tag: 'a[data-type="wikilink"]', priority: 1000 }]
  },

  renderHTML({ node }) {
    return ['a', {
      'data-type': 'wikilink',
      'data-note-id': String(node.attrs.noteId),
      href: `/notes/${node.attrs.noteId}`,
      class: 'wikilink',
    }, node.attrs.label]
  },

  renderText({ node }) {
    return `[[${node.attrs.label}]]`
  },

  renderMarkdown: node => `[[${node.attrs?.label ?? ''}]]`,
})

// "#读书 " (a tag followed by a space) becomes a tag chip
const TAG_INPUT = new RegExp(`(?:^|\\s)#((?=${TAG_CHAR_CLASS}*[^\\p{N}\\s])${TAG_CHAR_CLASS}+)\\s$`, 'u')

export const Tag = Node.create({
  name: 'tag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: { default: '', parseHTML: el => el.getAttribute('data-tag') || '', renderHTML: () => ({}) },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="tag"]' }]
  },

  renderHTML({ node }) {
    return ['span', { 'data-type': 'tag', 'data-tag': node.attrs.name, class: 'tag' }, `#${node.attrs.name}`]
  },

  renderText({ node }) {
    return `#${node.attrs.name}`
  },

  renderMarkdown: node => `#${node.attrs?.name ?? ''}`,

  addInputRules() {
    return [
      new InputRule({
        find: TAG_INPUT,
        handler: ({ state, range, match, chain }) => {
          if (state.doc.resolve(range.from).parent.type.spec.code) return null
          // The match may start with the whitespace before "#"
          const from = range.from + (match[0].startsWith('#') ? 0 : 1)
          chain()
            .deleteRange({ from, to: range.to })
            .insertContentAt(from, [{ type: this.name, attrs: { name: match[1] } }, { type: 'text', text: ' ' }])
            .run()
        },
      }),
    ]
  },
})
