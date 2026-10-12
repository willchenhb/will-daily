import type { ReactNode } from 'react'

// Table rows are [label, description] tuples, keyed by index inside <Table>; the rule
// mistakes the JSX in those tuples for un-keyed list items.
/* eslint-disable react/jsx-key */

export const metadata = { title: '说明 · Will Daily' }

function K({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block min-w-[1.6em] rounded border border-gray-200 bg-gray-50 px-1.5 py-px text-center font-mono text-[11px] text-gray-600">
      {children}
    </kbd>
  )
}

function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-gray-100 px-1 py-px font-mono text-[12px] text-gray-700">{children}</code>
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-gray-100 pt-5 mt-6 first:mt-0 first:border-0 first:pt-0">
      <h2 className="text-[15px] font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="space-y-2 text-[13px] leading-relaxed text-gray-600">{children}</div>
    </section>
  )
}

function Table({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <table className="w-full text-[13px]">
      <tbody>
        {rows.map(([a, b], i) => (
          <tr key={i} className="border-b border-gray-50 last:border-0 align-top">
            <td className="py-1.5 pr-4 whitespace-nowrap text-gray-700">{a}</td>
            <td className="py-1.5 text-gray-500">{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const TOC = [
  ['write', '书写'],
  ['links', '链接与标签'],
  ['save', '保存与历史'],
  ['find', '查找与导航'],
  ['diary', '日记与周记'],
  ['export', '导出'],
  ['keys', '快捷键'],
]

export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-1">说明</h1>
      <p className="text-[12px] text-gray-400 mb-4">笔记、日记、周记共用同一个编辑器，下面的操作三处通用。Windows 上把 <K>⌘</K> 换成 <K>Ctrl</K>。</p>

      <nav className="flex flex-wrap gap-2 mb-6">
        {TOC.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-[12px] px-2.5 py-1 rounded-full border border-gray-100 text-gray-500 hover:bg-gray-50">
            {label}
          </a>
        ))}
      </nav>

      <Section id="write" title="书写">
        <p>直接按 Markdown 的写法输入，会自动变成格式：</p>
        <Table rows={[
          [<><C># </C> <C>## </C> <C>### </C></>, '一 / 二 / 三级标题'],
          [<><C>- </C> 或 <C>1. </C></>, '无序 / 有序列表，列表里按 Tab 缩进、⇧Tab 取消缩进'],
          [<><C>[ ] </C> 或 <C>- [ ] </C></>, '待办清单；写 [x] 则直接是已完成'],
          [<C>&gt; </C>, '引用'],
          [<><C>```</C> 或 <C>```js</C> 加空格</>, '代码块（带语法高亮，不写语言会自动识别）'],
          [<C>---</C>, '分割线'],
          [<><C>**粗体**</C> <C>`代码`</C></>, '行内格式'],
        ]} />
        <p>输入 <C>/</C> 打开插入菜单（标题、待办、代码块、链接、图片等），也可以用英文关键词，如 <C>/todo</C>、<C>/code</C>。</p>
        <p>选中文字会出现工具栏：加粗、斜体、删除线、标题、代码、🔗 链接，以及 <b>↗ 新笔记</b>——把选中内容移到一篇新笔记，原处留下指向它的链接。</p>
        <p><b>图片</b>：直接粘贴截图、拖入图片文件，或用 <C>/图片</C> 选择文件，大图会自动压缩。</p>
        <p><b>粘贴</b>：从 ChatGPT、VS Code 复制的 Markdown 会自动转成格式；从网页复制保留原格式。</p>
      </Section>

      <Section id="links" title="链接与标签">
        <Table rows={[
          [<C>[[</C>, '链接另一篇笔记：弹出笔记列表，继续输入按标题筛选；没有同名笔记时可直接「新建并链接」'],
          [<><C>#读书</C> 加空格</>, '变成标签；输入 # 会提示已有标签'],
          ['点击链接 / 标签', '跳转到该笔记或标签页；⌘+点击在新标签页打开'],
          ['鼠标停在链接上', '弹出被链接笔记的预览'],
          ['普通网址', '粘贴网址自动成为链接；选中文字按 ⌘K 设置链接，⌘+点击打开'],
        ]} />
        <p>笔记底部的 <b>反向链接</b> 列出哪些内容链接到了这篇，「未链接的提及」列出提到了标题但还没加链接的内容。笔记改名后，所有指向它的链接会自动更新成新标题。</p>
        <p>侧边栏 <b>🏷️ 标签</b> 汇总所有标签；<b>🕸️ 图谱</b> 里可以只看「双链」，点节点查看它链接到和被链接的内容。</p>
      </Section>

      <Section id="save" title="保存与历史">
        <p><b>自动保存</b>：停止输入约 1.5 秒后保存，连续输入时也至少每 5 秒保存一次；<K>⌘</K><K>S</K> 立即保存。右下角显示「已自动保存 / 保存中 / 保存失败」。日记和周记写完点「完成」即可。</p>
        <p><b>历史版本</b>：笔记底部「历史版本」，日记、周记标题行悬停出现「历史」。编辑时约每 10 分钟、或一次删掉一大段时自动保留旧版本，可预览并恢复（恢复前当前内容也会先存入历史）。</p>
        <p><b>多处同时编辑</b>：如果同一篇在另一个页面或设备上改过，会暂停自动保存并让你选择「载入最新版本」或「用我的覆盖」，两个版本都能在历史里找回。</p>
        <p><b>断网</b>：没保存上的内容会留在浏览器里，下次打开时提示「恢复草稿」。</p>
      </Section>

      <Section id="find" title="查找与导航">
        <Table rows={[
          [<><K>⌘</K><K>K</K></>, '全文搜索笔记、日记、周记，空格分隔多个关键词；不输入时列出收藏'],
          [<><K>⌘</K><K>P</K>，或搜索框输入 <C>&gt;</C></>, '命令面板：新建笔记、打开今天的日记 / 本周周记、导出、设置等，支持拼音，如 >riji'],
          ['☆ 收藏', '笔记标题右侧点星标，出现在侧边栏「收藏」和笔记列表的「★ 收藏」里'],
          ['大纲', '笔记有两个以上标题时，在右侧（窄屏在正文上方）显示目录，点击跳转'],
          ['字数', '编辑器右下角；选中文字时显示选中部分的字数'],
        ]} />
      </Section>

      <Section id="diary" title="日记与周记">
        <p>日记右上角 <b>📅 日历</b>：有日记的日子带绿点，点击跳到那天；点空白日子可以补写当天的日记。列表底部「加载更多」查看更早的内容。</p>
        <p><b>日记模板</b>：在「设置 → 日记模板」编辑，新建日记时自动填入，<C>{'{{date}}'}</C> 会替换成当天日期。只打开不修改不会生成日记。</p>
      </Section>

      <Section id="export" title="导出">
        <p>「设置 → 导出 Markdown」把全部笔记、日记、周记和图片打包成 .zip，可直接用 Obsidian 打开（双链和标签都能识别），也可作为离线备份。</p>
      </Section>

      <Section id="keys" title="快捷键">
        <Table rows={[
          [<><K>⌘</K><K>K</K></>, '搜索（选中文字时为设置链接）'],
          [<><K>⌘</K><K>P</K></>, '命令面板'],
          [<><K>⌘</K><K>S</K></>, '立即保存'],
          [<><K>⌘</K><K>B</K> / <K>⌘</K><K>I</K> / <K>⌘</K><K>U</K></>, '加粗 / 斜体 / 下划线'],
          [<><K>⌘</K><K>⇧</K><K>S</K> / <K>⌘</K><K>E</K></>, '删除线 / 行内代码'],
          [<><K>⌘</K><K>Z</K> / <K>⌘</K><K>⇧</K><K>Z</K></>, '撤销 / 重做'],
          [<><K>Tab</K> / <K>⇧</K><K>Tab</K></>, '列表缩进 / 取消缩进'],
          [<><K>↑</K><K>↓</K> <K>Enter</K> <K>Esc</K></>, '在弹出菜单（/、[[、#、搜索）中选择、确认、关闭'],
        ]} />
      </Section>
    </div>
  )
}
