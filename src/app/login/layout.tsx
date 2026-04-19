export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-[11px] text-gray-400">
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 transition-colors"
        >
          京ICP备2026017980号-1
        </a>
      </footer>
    </>
  )
}
